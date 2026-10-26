// Portfólio: leitura pública (site) e edição pelo admin (Studio).
//   GET    /api/portfolio              → { order, items } públicos (admin com ?all=1 recebe tudo)
//   PUT    /api/portfolio              → salva a ordem dos projetos (admin)
//   POST   /api/portfolio              → cria projeto novo { title } (admin)
//   GET    /api/portfolio/:id          → entrada completa (admin)
//   PUT    /api/portfolio/:id          → salva (admin)
//   DELETE /api/portfolio/:id          → apaga a entrada e os arquivos (admin)
//   POST   /api/portfolio/:id/upload   → envia thumb, banner, galeria, avatar ou print (admin)
//   GET    /api/media/:key             → arquivo público, cache longo (chave nunca se repete)
import type { Config, Context } from "@netlify/functions";
import { fail, isAdmin, json, shortCode, store, uid } from "../lib/core.mts";
import { cleanMood, cleanEntry, cleanSections, cleanSite, cleanOrder, ID_RE, MEDIA_MAX, MEDIA_RE, MEDIA_TYPES, mediaKeys, publicEntry, slug } from "../lib/portfolio.mts";

const data = () => store("portfolio");
const media = () => store("media");
const KINDS = ["thumb", "banner", "avatar", "print", "gallery", "page", "mood"];
const dropMedia = (keys: string[]) => Promise.all(keys.map((m) => media().delete(m).catch(() => {})));

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const { id, key } = context.params;

  if (url.pathname.startsWith("/api/media/")) {
    if (req.method !== "GET" || !MEDIA_RE.test(key || "")) return fail("Arquivo não encontrado", 404);
    const r = await media().getWithMetadata(key, { type: "arrayBuffer" });
    if (!r) return fail("Arquivo não encontrado", 404);
    return new Response(r.data, { headers: {
      "content-type": String(r.metadata?.type || "application/octet-stream"),
      "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff",
    } });
  }

  const admin = await isAdmin(context);

  // moodboard da página inicial (GET público, PUT admin; arquivos que saem da lista são apagados)
  if (url.pathname === "/api/moodboard") {
    const cur: any = (await data().get("mood", { type: "json" })) || { tiles: [] };
    if (req.method === "GET") return json(cur, 200, { "cache-control": "public, max-age=20, s-maxage=30, stale-while-revalidate=300" });
    if (!admin) return fail("Faça login", 401);
    if (req.method !== "PUT") return fail("Método não permitido", 405);
    const body = await req.json().catch(() => null);
    if (!body) return fail("Dados inválidos");
    const next = cleanMood(body);
    await data().setJSON("mood", next);
    const keep = new Set(next.tiles.map((t: any) => t.media.key));
    await dropMedia((cur.tiles || []).map((t: any) => t.media?.key).filter((k2: string) => k2 && !keep.has(k2)));
    return json(next);
  }

  // textos de Sobre e Trajetória
  if (url.pathname === "/api/site-content") {
    if (req.method === "GET") return json((await data().get("site", { type: "json" })) || null, 200, { "cache-control": "public, max-age=20, s-maxage=30, stale-while-revalidate=300" });
    if (!admin) return fail("Faça login", 401);
    if (req.method !== "PUT") return fail("Método não permitido", 405);
    const body = await req.json().catch(() => null);
    if (!body) return fail("Dados inválidos");
    const next = { ...cleanSite(body), updatedAt: new Date().toISOString() };
    await data().setJSON("site", next);
    return json(next);
  }

  if (!id) {
    if (req.method === "GET") {
      const full = admin && url.searchParams.has("all");
      const [{ blobs }, order] = await Promise.all([data().list({ prefix: "p/" }), data().get("order", { type: "json" })]);
      const items: Record<string, any> = {};
      await Promise.all(blobs.map(async (b) => {
        const e = await data().get(b.key, { type: "json" });
        const v = full ? e : publicEntry(e);
        if (v) items[b.key.slice(2)] = v;
      }));
      return json({ order: (order as any)?.ids || [], items }, 200, full ? {} : { "cache-control": "public, max-age=20, s-maxage=30, stale-while-revalidate=300" });
    }
    if (!admin) return fail("Faça login", 401);
    const body = await req.json().catch(() => null);
    if (req.method === "PUT") {
      const ids = cleanOrder(body?.order);
      await data().setJSON("order", { ids, updatedAt: new Date().toISOString() });
      return json({ order: ids });
    }
    if (req.method === "POST") {
      const base = slug(body?.title);
      let nid = base;
      for (let i = 0; i < 6 && (await data().getMetadata(`p/${nid}`)); i++) nid = `${base}-${shortCode(3)}`;
      const entry = { ...cleanEntry({ title: body?.title, fronts: body?.fronts, section: body?.section, topicOnly: body?.topicOnly }, true), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await data().setJSON(`p/${nid}`, entry);
      const order: any = (await data().get("order", { type: "json" })) || { ids: [] };
      await data().setJSON("order", { ids: [nid, ...order.ids.filter((x: string) => x !== nid)], updatedAt: new Date().toISOString() });
      return json({ id: nid, ...entry }, 201);
    }
    return fail("Método não permitido", 405);
  }

  if (!ID_RE.test(id)) return fail("Projeto inválido", 400);

  // página do projeto (seções): leitura pública, edição do admin
  if (url.pathname.endsWith("/page")) {
    const pk = `s/${id}`;
    if (req.method === "GET") {
      const e: any = await data().get(`p/${id}`, { type: "json" });
      if (e?.hidden && !admin) return fail("Projeto não encontrado", 404);
      return json((await data().get(pk, { type: "json" })) || null, 200, admin ? {} : { "cache-control": "public, max-age=20, s-maxage=30, stale-while-revalidate=300" });
    }
    if (!admin) return fail("Faça login", 401);
    if (req.method === "DELETE") { const prev: any = await data().get(pk, { type: "json" }); await data().delete(pk); await dropMedia(mediaKeys(prev)); return json({ ok: true }); }
    if (req.method !== "PUT") return fail("Método não permitido", 405);
    const body = await req.json().catch(() => null);
    let sections; try { sections = cleanSections(body?.sections); } catch (x: any) { return fail(x.message); }
    const prev: any = await data().get(pk, { type: "json" });
    const next = { sections, updatedAt: new Date().toISOString() };
    await data().setJSON(pk, next);
    const keep = new Set(mediaKeys(next));
    await dropMedia(mediaKeys(prev).filter((m) => !keep.has(m)));
    return json(next);
  }

  if (!admin) return fail("Faça login", 401);
  const k = `p/${id}`;

  if (url.pathname.endsWith("/upload")) {
    if (req.method !== "POST") return fail("Método não permitido", 405);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file") as File | null;
    const kind = String(form?.get("kind") || "");
    if (!file || !KINDS.includes(kind)) return fail("Envie um arquivo");
    if (!MEDIA_TYPES.includes(file.type)) return fail("Formato não aceito. Use GIF, MP4, WebM, JPG, PNG ou WebP.");
    if (file.size > MEDIA_MAX) return fail("Arquivo acima de 4,5 MB. Para animações, exporte em MP4: fica bem mais leve.");
    const mkey = `${id}-${kind}-${uid().toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    await media().set(mkey, await file.arrayBuffer(), { metadata: { type: file.type, name: file.name.slice(0, 120), size: file.size } });
    return json({ key: mkey, type: file.type, size: file.size, url: `/api/media/${mkey}` }, 201);
  }

  const prev: any = await data().get(k, { type: "json" });
  if (req.method === "GET") return json(prev || cleanEntry({}));
  if (req.method === "PUT") {
    const body = await req.json().catch(() => null);
    if (!body) return fail("Dados inválidos");
    const next = { ...cleanEntry(body, !!prev?.custom), createdAt: prev?.createdAt, updatedAt: new Date().toISOString() };
    await data().setJSON(k, next);
    const keep = new Set(mediaKeys(next));
    await dropMedia(mediaKeys(prev).filter((m) => !keep.has(m)));
    return json(next);
  }
  if (req.method === "DELETE") {
    await data().delete(k);
    await dropMedia(mediaKeys(prev));
    if (prev?.custom) {
      const order: any = (await data().get("order", { type: "json" })) || { ids: [] };
      await data().setJSON("order", { ids: order.ids.filter((x: string) => x !== id), updatedAt: new Date().toISOString() });
    }
    return json({ ok: true });
  }
  return fail("Método não permitido", 405);
};

export const config: Config = { path: ["/api/moodboard", "/api/site-content", "/api/portfolio", "/api/portfolio/:id", "/api/portfolio/:id/upload", "/api/portfolio/:id/page", "/api/media/:key"] };
