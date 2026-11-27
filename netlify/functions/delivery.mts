// Entrega final (admin) e verificação pública do certificado.
//   GET  /api/quotes/:slug/delivery   → tipos sugeridos e entrega atual
//   GET  /api/quotes/:slug/delivery?painel → link do painel do cliente (ver como o cliente)
//   POST /api/quotes/:slug/delivery   { kinds, systemUrl, systemLabel, manualId, note, licenses, accesses, support, send } → gera o dossiê, marca "Entregue" e avisa o cliente
//   GET  /api/certificado/:code       → verificação pública do certificado (código de integridade recalculado)
import type { Config, Context } from "@netlify/functions";
import { addEvent, fail, files, getQuote, getSettings, getState, isAdmin, json, patchState, sha256, clientToken } from "../lib/core.mts";
import { buildDelivery, certs, guessKinds, KINDS, publicDelivery } from "../lib/delivery.mts";
import { callGoogle, googleReady, sendMail } from "../lib/google.mts";
import { mails } from "../lib/mails.mts";

const mask = (doc: string) => { const d = String(doc || ""); return d.length > 6 ? d.slice(0, 3) + "•".repeat(Math.max(0, d.length - 5)) + d.slice(-2) : d; };

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);

  if (url.pathname.startsWith("/api/certificado/")) {
    const code = String(context.params.code || "").toUpperCase().slice(0, 20);
    const ref: any = await certs().get(code, { type: "json" });
    if (!ref) return fail("Certificado não encontrado", 404);
    const [q, st, settings] = await Promise.all([getQuote(ref.slug), getState(ref.slug), getSettings()]);
    const c = st?.delivery?.certificate;
    if (!q || !c || c.code !== code) return fail("Certificado não encontrado", 404);
    const valid = (await sha256(c.canonical)) === c.hash;
    const d = st.delivery;
    return json({
      valid, code, at: c.at, hash: c.hash, text: c.text,
      issuer: { name: settings.issuer.name, doc: settings.issuer.doc, site: settings.issuer.site },
      holder: { name: d.holder?.name || "", doc: mask(d.holder?.doc), company: d.holder?.company || "" },
      project: q.title || "", items: d.items || [], files: (d.files || []).map((f: any) => ({ name: f.name, size: f.size, hash: f.hash })),
    }, 200, { "cache-control": "no-store" });
  }

  if (!(await isAdmin(context))) return fail("Faça login", 401);
  const { slug } = context.params;
  const q: any = await getQuote(slug);
  if (!q) return fail("Orçamento não encontrado", 404);
  const st: any = await getState(slug);
  if (!st.approvedAt) return fail("A entrega só existe depois do contrato assinado", 409);

  if (req.method === "GET" && url.searchParams.has("painel")) {
    const to = st.signer?.email || q.client?.email;
    if (!to) return fail("Cliente sem e-mail cadastrado");
    return json({ url: `${url.origin}/acompanhar?t=${await clientToken(to)}`, email: to });
  }
  if (req.method === "GET") return json({ suggested: guessKinds(q), kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.label])), delivery: publicDelivery(st.delivery) });
  if (req.method !== "POST") return fail("Método não permitido", 405);

  if (st.delivery?.certificate) return fail("Projeto concluído: a entrega foi aprovada e o certificado já foi emitido", 409);
  const body = await req.json().catch(() => ({}));
  const delivery = await buildDelivery(q, st, body);
  const work = { ...(st.work || {}) };
  if (!["entregue", "concluido"].includes(work.stage)) {
    work.stage = "entregue";
    work.history = [...(work.history || []), { stage: "entregue", at: delivery.at }].slice(-30);
  }
  await patchState(slug, { delivery, work });
  await addEvent(slug, { type: "delivery", version: delivery.version });

  let emailed = false, emailError = "";
  const to = st.signer?.email || q.client?.email;
  if (body.send !== false && to) {
    if (!googleReady()) emailError = "Gmail ainda não ligado: a entrega ficou disponível no painel do cliente, mas o e-mail não saiu.";
    else {
      // o manual vai anexado ao e-mail: uma cópia segue para a pasta do cliente no Drive (Entrega) e o Gmail anexa de lá
      let pdfFileId = "";
      if (delivery.manual) {
        const bytes = await files().get(`${slug}/${delivery.manual.id}`, { type: "arrayBuffer" });
        if (bytes) {
          const up = await callGoogle("file", { client: q.client?.company || q.client?.name || slug, sub: "Entrega", name: delivery.manual.name, mime: "application/pdf", data: Buffer.from(bytes as ArrayBuffer).toString("base64") }, 45000);
          if (up?.ok) pdfFileId = up.id;
        }
      }
      const panel = `${url.origin}/acompanhar?t=${await clientToken(to)}`;
      const m = mails.entrega({ name: st.signer?.name || q.client?.name, title: q.title, version: delivery.version, systemUrl: delivery.systemUrl, systemLabel: delivery.systemLabel, manualName: delivery.manual?.name, manualAttached: !!pdfFileId, manualUrl: delivery.manual ? `${url.origin}/api/quotes/${slug}/files/${delivery.manual.id}?download` : "", filesCount: delivery.files.length, note: delivery.note, panel, paid: delivery.paid });
      const r = await sendMail(to, m, pdfFileId ? { pdfFileId } : {});
      emailed = !!r?.ok; if (!emailed) emailError = String(r?.error || "Falha no envio");
      await addEvent(slug, { type: emailed ? "email-sent" : "email-error", what: "entrega", to });
    }
  }
  return json({ delivery: publicDelivery(delivery), emailed, emailError });
};

export const config: Config = { path: ["/api/quotes/:slug/delivery", "/api/certificado/:code"] };
