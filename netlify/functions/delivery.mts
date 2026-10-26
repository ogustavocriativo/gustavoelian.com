// Entrega final (admin) e verificação pública do certificado.
//   GET  /api/quotes/:slug/delivery   → tipos sugeridos e entrega atual
//   POST /api/quotes/:slug/delivery   { kinds, licenses, accesses, support, send } → gera o dossiê, marca "Entregue" e avisa o cliente
//   GET  /api/certificado/:code       → verificação pública do certificado (código de integridade recalculado)
import type { Config, Context } from "@netlify/functions";
import { addEvent, fail, getQuote, getSettings, getState, isAdmin, json, patchState, sha256 } from "../lib/core.mts";
import { buildDelivery, certs, guessKinds, KINDS, publicDelivery } from "../lib/delivery.mts";
import { callGoogle, esc, firstName, googleReady } from "../lib/google.mts";

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

  if (req.method === "GET") return json({ suggested: guessKinds(q), kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.label])), delivery: publicDelivery(st.delivery) });
  if (req.method !== "POST") return fail("Método não permitido", 405);

  const body = await req.json().catch(() => ({}));
  const delivery = await buildDelivery(q, st, body);
  const work = { ...(st.work || {}) };
  if (!["entregue", "concluido"].includes(work.stage)) {
    work.stage = "entregue";
    work.history = [...(work.history || []), { stage: "entregue", at: delivery.at }].slice(-30);
  }
  await patchState(slug, { delivery, work });
  await addEvent(slug, { type: "delivery", certificate: delivery.certificate?.code || null });

  let emailed = false, emailError = "";
  const to = st.signer?.email || q.client?.email;
  if (body.send !== false && to) {
    if (!googleReady()) emailError = "Gmail ainda não ligado: a entrega ficou disponível no painel do cliente, mas o e-mail não saiu.";
    else {
      const recs = delivery.recommendations.slice(0, 6).map((r: any) => `<li><b>${esc(r.t)}.</b> ${esc(r.d)}</li>`).join("");
      const r = await callGoogle("email", {
        to, subject: `Entrega final · ${q.title || "seu projeto"}`, title: "Seu projeto foi entregue",
        html: `<p>Olá${firstName(st.signer?.name || q.client?.name) ? ", " + firstName(st.signer?.name || q.client?.name) : ""}!</p>
<p>A entrega final de <b>${esc(q.title || "seu projeto")}</b> está no seu painel, com ${delivery.files.length} arquivo(s), cada um com seu código de integridade.</p>
${delivery.certificate ? `<p>O <b>certificado de autoria e cessão de direitos</b> foi emitido com o código <b>${esc(delivery.certificate.code)}</b>. Qualquer pessoa pode verificá-lo em ${esc(url.origin)}/certificado?c=${esc(delivery.certificate.code)}.</p>` : `<p>O certificado de cessão de direitos é emitido assim que o pagamento for quitado.</p>`}
<p><b>Recomendações importantes:</b></p><ul>${recs}</ul><p>A lista completa está no painel.</p>`,
        button: { href: `${url.origin}/acompanhar`, label: "Abrir a entrega" },
      });
      emailed = !!r?.ok; if (!emailed) emailError = String(r?.error || "Falha no envio");
      await addEvent(slug, { type: emailed ? "email-sent" : "email-error", what: "entrega" });
    }
  }
  return json({ delivery: publicDelivery(delivery), emailed, emailError });
};

export const config: Config = { path: ["/api/quotes/:slug/delivery", "/api/certificado/:code"] };
