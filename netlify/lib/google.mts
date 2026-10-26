import { addEvent, getSettings, patchState } from "./core.mts";
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

export async function sendContractToDrive(slug: string, q: any, st: any, origin: string) {
  const settings = await getSettings();
  const r = await callGoogle("contract", {
    client: q.client?.company || q.client?.name || slug,
    date: (st.approvedAt || new Date().toISOString()).slice(0, 10),
    text: st.contractText || "", signer: st.signer || {}, signatureImage: st.signatureImage || "",
    approvedAt: st.approvedAt ? new Date(st.approvedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    hash: st.contractHash || "", link: `${origin}/${slug}`, ownerEmail: settings.issuer?.email || "",
  }, 45000);
  if (r?.ok) { await patchState(slug, { drive: { docUrl: r.docUrl, pdfUrl: r.pdfUrl, pdfId: r.pdfId, folderUrl: r.folderUrl, at: new Date().toISOString() } }); await addEvent(slug, { type: "drive" }); }
  else await addEvent(slug, { type: "drive-error", message: String(r?.error || "erro").slice(0, 200) });
  return r;
}

