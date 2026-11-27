import { addEvent, getSettings, patchState } from "./core.mts";
import { emailHtml } from "./email.mts";
// Ponte com o Google (Apps Script publicado na conta do Gustavo): Gmail e Drive.
// Configuração no Netlify: GOOGLE_SCRIPT_URL (termina em /exec) e GOOGLE_SCRIPT_SECRET.
export const googleReady = () => !!(Netlify.env.get("GOOGLE_SCRIPT_URL") && (Netlify.env.get("GOOGLE_SCRIPT_SECRET") || "").length >= 24);

export async function callGoogle(action: string, payload: Record<string, any> = {}, timeoutMs = 25000): Promise<any> {
  const url = Netlify.env.get("GOOGLE_SCRIPT_URL"), secret = Netlify.env.get("GOOGLE_SCRIPT_SECRET");
  if (!url || !secret) return { ok: false, error: "Ligação com o Google ainda não configurada" };
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return { ok: false, error: "Endereço do script inválido" };
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    // o Apps Script responde com um redirecionamento; o fetch segue e lê o JSON
    // e-mails saem com o layout da identidade do site (o script do Google usa fullHtml quando recebe)
    if (action === "email" && !payload.fullHtml) payload = { ...payload, fullHtml: emailHtml({ title: payload.title, subject: payload.subject, html: payload.html, button: payload.button, eyebrow: payload.eyebrow }) };
    const r = await fetch(url, { method: "POST", headers: { "content-type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...payload, action, secret }), redirect: "follow", signal: ctl.signal });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { return { ok: false, error: "Resposta inesperada do Google" }; }
  } catch (x: any) {
    return { ok: false, error: x?.name === "AbortError" ? "O Google demorou para responder" : "Falha ao falar com o Google" };
  } finally { clearTimeout(t); }
}

const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
export const firstName = (n: any) => esc(String(n || "").trim().split(/\s+/)[0] || "");
export { esc };

/** Envia um dos modelos de mails.mts (com anexo opcional de um arquivo do Drive). */
export async function sendMail(to: string, m: { subject: string; title: string; eyebrow: string; html: string; button?: any }, extra: Record<string, any> = {}) {
  return callGoogle("email", { to, subject: m.subject, title: m.title, eyebrow: m.eyebrow, html: m.html, button: m.button || null, ...extra }, 30000);
}

/* PDF do contrato no layout aprovado (o mesmo de /api/pdf/:slug/contrato), em base64, para o Drive e o e-mail. */
export async function contractPdfBase64(q: any, st: any, origin: string) {
  try {
    const { loadPdfImages } = await import("./assets.mts");
    await (loadPdfImages as any)?.(origin);
    const { contractPdf } = await import("../functions/pdf.mts");
    const bytes = await contractPdf(q, await getSettings(), st, origin);
    return Buffer.from(bytes).toString("base64");
  } catch { return ""; }
}

/** Gera um documento no layout do contrato (aditivo, recibo, certificado), salva na pasta do cliente no Drive e devolve o id para anexar ao e-mail. */
export async function docToDrive(kind: "aditivo" | "recibo" | "certificado", q: any, st: any, origin: string, arg: any, sub: string, name: string) {
  try {
    const { loadPdfImages } = await import("./assets.mts");
    await (loadPdfImages as any)?.(origin);
    const pdf: any = await import("../functions/pdf.mts");
    const s = await getSettings();
    const bytes = kind === "aditivo" ? await pdf.aditivoPdf(q, s, st, arg, origin) : kind === "recibo" ? await pdf.reciboPdf(q, s, st, arg, origin) : await pdf.certificadoPdf(q, s, st, origin);
    const r = await callGoogle("file", { client: q.client?.company || q.client?.name || q.slug, sub, name, mime: "application/pdf", data: Buffer.from(bytes).toString("base64") }, 45000);
    return r?.ok ? { id: r.id as string, url: r.url as string } : null;
  } catch { return null; }
}

export async function sendContractToDrive(slug: string, q: any, st: any, origin: string) {
  const settings = await getSettings();
  const pdf = await contractPdfBase64(q, st, origin);
  // sem o PDF no layout aprovado não envia nada (nunca cai no modelo antigo do Google Docs)
  if (!pdf) { await addEvent(slug, { type: "drive-error", message: "Não consegui gerar o PDF do contrato" }); return { ok: false, error: "Não consegui gerar o PDF do contrato. Tente de novo." }; }
  const r = await callGoogle("contract", {
    client: q.client?.company || q.client?.name || slug,
    date: (st.approvedAt || new Date().toISOString()).slice(0, 10),
    text: st.contractText || "", signer: st.signer || {}, signatureImage: st.signatureImage || "",
    approvedAt: st.approvedAt ? new Date(st.approvedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    hash: st.contractHash || "", link: `${origin}/${slug}`, ownerEmail: settings.issuer?.email || "",
    pdf, pdfName: `${(st.approvedAt || new Date().toISOString()).slice(0, 10)} · ${q.client?.company || q.client?.name || slug} · Contrato assinado.pdf`,
    emailHtml: emailHtml({ title: "Contrato assinado", eyebrow: "Contrato", html: `<p>Olá${st.signer?.name ? ", " + firstName(st.signer.name) : ""}!</p><p>Segue em anexo a cópia do contrato assinado. O próximo passo é o pagamento da entrada, pelo mesmo link da proposta.</p>`, button: { href: `${origin}/${slug}`, label: "Abrir a proposta" } }),
  }, 45000);
  if (r?.ok) { await patchState(slug, { drive: { docUrl: r.docUrl, pdfUrl: r.pdfUrl, pdfId: r.pdfId, folderUrl: r.folderUrl, at: new Date().toISOString() } }); await addEvent(slug, { type: "drive" }); }
  else await addEvent(slug, { type: "drive-error", message: String(r?.error || "erro").slice(0, 200) });
  return r;
}

