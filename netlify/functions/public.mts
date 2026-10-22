// Página do cliente: leitura da proposta e interações (seleção, comentário, aprovação/assinatura, aviso de pagamento).
import type { Config, Context } from "@netlify/functions";
import { addEvent, fail, files, getQuote, getSettings, getState, isAdmin, json, patchState, priceOf, quotes, sha256, uid } from "../lib/core.mts";
import { buildContract, paymentLabel } from "../lib/contract.mts";

function publicView(q: any) {
  return {
    slug: q.slug, title: q.title, intro: q.intro, date: q.date, validDays: q.validDays, category: q.category,
    client: { name: q.client?.name, company: q.client?.company },
    items: q.items, packages: q.packages, defaultInstallments: q.defaultInstallments,
    bonuses: q.bonuses, notes: q.notes, projectIds: q.projectIds,
    attachments: (q.attachments || []).filter((a: any) => a.showToClient).map(({ id, name, type, size }: any) => ({ id, name, type, size })),
    contractEnabled: q.contract?.enabled !== false,
  };
}
const clip = (v: any, n: number) => String(v ?? "").trim().slice(0, n);

export default async (req: Request, context: Context) => {
  const { slug, action } = context.params;
  const q = await getQuote(slug);
  const admin = await isAdmin(context);
  if (!q || (!q.published && !admin)) return fail("Proposta não encontrada", 404);
  const settings = await getSettings();

  if (req.method === "GET" && !action) {
    let state = await getState(slug);
    if (!admin) {
      const last = state.lastViewAt ? Date.parse(state.lastViewAt) : 0;
      const patch: any = { lastViewAt: new Date().toISOString(), views: (state.views || 0) + 1 };
      if (!state.firstViewAt) patch.firstViewAt = patch.lastViewAt;
      state = await patchState(slug, patch);
      if (Date.now() - last > 30 * 60 * 1000) await addEvent(slug, { type: "view", city: context.geo?.city || "" });
    }
    const contractPreview = q.contract?.enabled !== false ? buildContract(q, settings, null, state.selection || {}) : "";
    return json({
      quote: publicView(q),
      state: { selection: state.selection || null, approvedAt: state.approvedAt || null, signer: state.signer ? { name: state.signer.name } : null, paidAt: state.paidAt || null, paymentNotice: state.paymentNotice || null },
      issuer: settings.issuer,
      payments: { entryPct: settings.payments.entryPct, pix: !!settings.pix.key, card: !!Netlify.env.get("STRIPE_SECRET_KEY") },
      contractPreview,
      preview: admin && !q.published,
    });
  }

  if (req.method !== "POST") return fail("Método não permitido", 405);

  // Comprovante de pagamento (multipart)
  if (action === "receipt") {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file || file.size > 4 * 1024 * 1024) return fail("Envie um arquivo de até 4 MB");
    const id = "rec-" + uid();
    await files().set(`${slug}/${id}`, await file.arrayBuffer());
    const meta = { id, name: file.name, type: file.type, size: file.size, showToClient: false, uploadedAt: new Date().toISOString(), fromClient: true };
    await quotes().setJSON(`quotes/${slug}`, { ...q, attachments: [...(q.attachments || []), meta] });
    const notice = { method: "pix", at: new Date().toISOString(), fileId: id };
    await patchState(slug, { paymentNotice: notice });
    await addEvent(slug, { type: "payment-notice", method: "pix", fileId: id, fileName: file.name });
    return json({ ok: true });
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("Dados inválidos");

  if (action === "select") {
    const sel = {
      packageId: body.packageId ? clip(body.packageId, 30) : null,
      itemIds: Array.isArray(body.itemIds) ? body.itemIds.map((x: any) => clip(x, 30)).slice(0, 30) : [],
      method: body.method === "cartao" ? "cartao" : "avista",
    };
    const st = await getState(slug);
    if (st.approvedAt) return fail("Proposta já aprovada", 409);
    await patchState(slug, { selection: sel });
    const p = priceOf(q, sel);
    await addEvent(slug, { type: "select", label: p.label, method: sel.method, total: sel.method === "cartao" ? p.card : p.cash });
    return json({ ok: true, selection: sel, contractPreview: buildContract(q, settings, null, sel) });
  }

  if (action === "comment") {
    const message = clip(body.message, 2000);
    if (!message) return fail("Escreva uma mensagem");
    const ev = await addEvent(slug, { type: "comment", name: clip(body.name, 120) || q.client?.name, message });
    return json({ ok: true, event: ev });
  }

  if (action === "approve") {
    const st = await getState(slug);
    if (st.approvedAt) return fail("Esta proposta já foi aprovada", 409);
    const signer = { name: clip(body.name, 120), doc: clip(body.doc, 30), email: clip(body.email, 160), phone: clip(body.phone, 40) };
    if (signer.name.length < 5 || !signer.doc || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signer.email)) return fail("Preencha nome completo, CPF ou CNPJ e e-mail válidos");
    if (!body.accept) return fail("É preciso aceitar os termos");
    const sig = String(body.signature || "");
    if (sig && (!/^data:image\/(png|jpeg);base64,/.test(sig) || sig.length > 300_000)) return fail("Assinatura inválida");
    const sel = st.selection || { packageId: null, itemIds: (q.items || []).map((i: any) => i.id), method: "avista" };
    const contract = q.contract?.enabled !== false ? buildContract(q, settings, signer, sel) : "";
    const pay = paymentLabel(q, settings, sel);
    const acceptance = {
      approvedAt: new Date().toISOString(),
      signer: { ...signer, ip: context.ip, userAgent: clip(req.headers.get("user-agent"), 300), city: context.geo?.city || "" },
      selection: sel,
      total: pay.total,
      paymentText: pay.text,
      contractText: contract,
      contractHash: contract ? await sha256(contract) : "",
      signatureImage: sig || null,
    };
    await patchState(slug, acceptance);
    await addEvent(slug, { type: "approve", name: signer.name, total: pay.total, method: sel.method });
    return json({ ok: true, approvedAt: acceptance.approvedAt, contractHash: acceptance.contractHash });
  }

  return fail("Ação desconhecida", 404);
};

export const config: Config = {
  path: ["/api/p/:slug", "/api/p/:slug/:action"],
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
