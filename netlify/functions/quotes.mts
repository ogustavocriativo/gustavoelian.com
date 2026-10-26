// CRUD de orçamentos (somente admin).
import type { Config, Context } from "@netlify/functions";
import { aliases, aliasOf, fail, files, getQuote, getState, isAdmin, json, listEvents, quotes, shortCode, slugify, states, events, store, SLUG_RE } from "../lib/core.mts";

// endereços que pertencem ao site e não podem virar link de proposta
const RESERVED = new Set(["demonstracao", "acompanhar", "certificado", "projeto", "projetos", "proposta", "pagar", "index", "app", "api", "img", "fonts", "video", "data", "assets", "admin", "studio"]);

function clean(input: any, prev: any = {}) {
  const num = (v: any) => (v === "" || v === null || v === undefined ? 0 : Number(String(v).replace(/\./g, "").replace(",", ".")) || Number(v) || 0);
  const str = (v: any, max = 4000) => String(v ?? "").slice(0, max);
  return {
    ...prev,
    title: str(input.title, 200),
    intro: str(input.intro),
    date: str(input.date, 20) || new Date().toISOString().slice(0, 10),
    validDays: Number(input.validDays) || 15,
    category: str(input.category, 40),
    client: {
      name: str(input.client?.name, 120), company: str(input.client?.company, 120),
      email: str(input.client?.email, 160), phone: str(input.client?.phone, 40),
    },
    items: (input.items || []).slice(0, 30).map((i: any) => ({
      id: str(i.id, 30) || shortCode(5), title: str(i.title, 160), description: str(i.description, 1000),
      deliverables: (Array.isArray(i.deliverables) ? i.deliverables : String(i.deliverables || "").split("\n"))
        .map((d: string) => str(d, 200).trim()).filter(Boolean).slice(0, 20),
      price: typeof i.price === "number" ? i.price : num(i.price), deadline: str(i.deadline, 80),
    })),
    packages: (input.packages || []).slice(0, 10).map((p: any) => ({
      id: str(p.id, 30) || shortCode(5), name: str(p.name, 160), itemIds: (p.itemIds || []).map(String),
      cash: typeof p.cash === "number" ? p.cash : num(p.cash), card: typeof p.card === "number" ? p.card : num(p.card),
      installments: Math.max(1, Math.min(12, Number(p.installments) || 1)), highlight: !!p.highlight, tag: str(p.tag, 60),
    })),
    defaultInstallments: Math.max(1, Math.min(12, Number(input.defaultInstallments) || 1)),
    bonuses: (input.bonuses || []).slice(0, 12).map((b: any) => ({ title: str(b.title, 120), text: str(b.text, 400) })).filter((b: any) => b.title),
    notes: str(input.notes),
    projectIds: (input.projectIds || []).map(String).slice(0, 12),
    attachments: (input.attachments || prev.attachments || []).map((a: any) => ({ ...a, showToClient: a.showToClient !== false })),
    contract: { enabled: input.contract?.enabled !== false, text: str(input.contract?.text, 20000), extra: str(input.contract?.extra, 4000) },
    published: !!input.published,
  };
}

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  const slug = context.params.slug;

  if (!slug) {
    if (req.method === "GET") {
      const { blobs } = await quotes().list({ prefix: "quotes/" });
      const list = await Promise.all(blobs.map(async (b) => {
        const q: any = await quotes().get(b.key, { type: "json" });
        if (!q) return null;
        // estado sem os campos pesados (assinatura e texto do contrato ficam só no detalhe)
        const { signatureImage, contractText, ...st } = await getState(q.slug);
        return { slug: q.slug, client: q.client, title: q.title, category: q.category, date: q.date, validDays: q.validDays, updatedAt: q.updatedAt, createdAt: q.createdAt, published: q.published, total: (q.items || []).reduce((s: number, i: any) => s + Number(i.price || 0), 0), state: st };
      }));
      return json((list.filter(Boolean) as any[]).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)));
    }
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body?.client?.name) return fail("Informe o nome do cliente");
      let newSlug = "";
      for (let i = 0; i < 5; i++) {
        const candidate = `${slugify(body.client.name)}-${shortCode(3)}`;
        if (!(await quotes().getMetadata(`quotes/${candidate}`))) { newSlug = candidate; break; }
      }
      const now = new Date().toISOString();
      const q = { ...clean(body), slug: newSlug, createdAt: now, updatedAt: now };
      await quotes().setJSON(`quotes/${newSlug}`, q);
      return json(q, 201);
    }
    return fail("Método não permitido", 405);
  }

  const q = await getQuote(slug);
  if (!q) return fail("Orçamento não encontrado", 404);
  if (req.method === "GET") {
    return json({ quote: q, state: await getState(slug), events: await listEvents(slug) });
  }
  if (req.method === "PUT") {
    const body = await req.json().catch(() => null);
    if (!body) return fail("Dados inválidos");
    const next = { ...clean(body, q), slug, createdAt: q.createdAt, updatedAt: new Date().toISOString() };
    await quotes().setJSON(`quotes/${slug}`, next);
    return json(next);
  }
  // Trocar o link da proposta: move proposta, estado, histórico e arquivos; o link antigo segue funcionando
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/rename")) {
    const body = await req.json().catch(() => ({}));
    const to = slugify(String(body.slug || "")).slice(0, 60);
    if (!SLUG_RE.test(to)) return fail("Use de 3 a 60 letras, números ou hífens");
    if (to === slug) return json(q);
    if (RESERVED.has(to)) return fail("Esse endereço é reservado do site. Escolha outro.");
    if (await getQuote(to)) return fail("Já existe uma proposta com esse link");
    const taken = await aliasOf(to);
    if (taken && taken !== slug) return fail("Esse link já foi usado por outra proposta");
    const at = new Date().toISOString();
    const next = { ...q, slug: to, updatedAt: at, previousSlugs: [...new Set([...(q.previousSlugs || []), slug])] };
    await quotes().setJSON(`quotes/${to}`, next);
    const st = await getState(slug);
    if (Object.keys(st).length) await states().setJSON(to, st);
    for (const s0 of [events(), files()]) {
      const { blobs } = await s0.list({ prefix: `${slug}/` });
      for (const b of blobs) {
        const k = `${to}/${b.key.slice(slug.length + 1)}`;
        if (s0 === events()) { const ev: any = await s0.get(b.key, { type: "json" }); if (ev) await s0.setJSON(k, { ...ev, slug: to, id: k }); }
        else { const r = await s0.getWithMetadata(b.key, { type: "arrayBuffer" }); if (r) await s0.set(k, r.data as ArrayBuffer, { metadata: r.metadata || {} }); }
        await s0.delete(b.key);
      }
    }
    // certificados e cobranças que apontam para a proposta
    for (const name of ["certs", "charges"]) {
      const st0 = store(name); const { blobs } = await st0.list();
      for (const b of blobs) { const v: any = await st0.get(b.key, { type: "json" }); if (v?.slug === slug) await st0.setJSON(b.key, { ...v, slug: to }); }
    }
    await quotes().delete(`quotes/${slug}`); await states().delete(slug);
    // o link antigo (e os anteriores) passam a apontar para o novo
    for (const old of next.previousSlugs) await aliases().setJSON(old, { to, at });
    await aliases().delete(to);
    return json(next);
  }
  if (req.method === "DELETE") {
    await quotes().delete(`quotes/${slug}`);
    await states().delete(slug);
    for (const s of [events(), files()]) {
      const { blobs } = await s.list({ prefix: `${slug}/` });
      await Promise.all(blobs.map((b) => s.delete(b.key)));
    }
    return json({ ok: true });
  }
  return fail("Método não permitido", 405);
};

export const config: Config = { path: ["/api/quotes", "/api/quotes/:slug", "/api/quotes/:slug/rename"] };
