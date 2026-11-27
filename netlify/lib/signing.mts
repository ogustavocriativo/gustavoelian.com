// Assinatura pelo Google (eSignature do Drive):
// 1) o cliente aprova a proposta no site → o sistema salva o "Contrato para assinatura" (PDF no layout aprovado) na pasta do cliente
//    e avisa o Gustavo (e-mail + WhatsApp, se configurado) para ele pedir a assinatura no Drive;
// 2) o Google salva o PDF assinado na mesma pasta, com o nome do original + " - dd/mm/aaaa, hh:mm.pdf";
// 3) a cada 10 minutos (ou pelo botão "Verificar agora" no Studio) o sistema procura esse PDF, anexa ao contrato
//    e libera o pagamento da entrada.
import { addEvent, getQuote, getSettings, getState, patchState, quotes, store, uid } from "./core.mts";
import { sendMail, callGoogle, contractPdfBase64, esc, firstName, googleReady } from "./google.mts";
import { mails } from "./mails.mts";

const SITE = "https://gustavoelian.com";

/* Aviso para o Gustavo: e-mail e, se as chaves do CallMeBot estiverem cadastradas, WhatsApp. */
export async function notifyOwner(subject: string, lines: string[], link?: { href: string; label: string }) {
  const settings = await getSettings();
  const out: any = {};
  if (googleReady() && settings.issuer?.email) {
    const r = await callGoogle("email", { to: settings.issuer.email, subject, title: subject, eyebrow: "Aviso do Studio", html: lines.map((l) => `<p>${esc(l)}</p>`).join(""), button: link || null });
    out.email = !!r?.ok;
  }
  const phone = (globalThis as any).Netlify?.env.get("CALLMEBOT_PHONE"), key = (globalThis as any).Netlify?.env.get("CALLMEBOT_APIKEY");
  if (phone && key) {
    const text = [`*${subject}*`, ...lines, link ? link.href : ""].filter(Boolean).join("\n");
    try { const r = await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(key)}`); out.whatsapp = r.ok; } catch { out.whatsapp = false; }
  }
  return out;
}

const clientLabel = (q: any, slug: string) => q.client?.company || q.client?.name || slug;
const brl = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Depois da aprovação: gera o PDF para assinatura, salva na pasta do cliente e avisa. */
export async function prepareGoogleSigning(slug: string, origin: string) {
  const q: any = await getQuote(slug); if (!q) return;
  const st: any = await getState(slug);
  const pdfName = `${st.contractNumber ? st.contractNumber + " · " : ""}${clientLabel(q, slug)} · Contrato para assinatura.pdf`;
  const pdf = await contractPdfBase64(q, st, origin);
  const r = pdf ? await callGoogle("contract", { client: clientLabel(q, slug), pdf, pdfName, sendEmail: false, signer: st.signer || {}, link: `${origin}/${slug}` }, 45000) : { ok: false, error: "Não foi possível gerar o PDF" };
  if (!r?.ok) {
    await patchState(slug, { signing: { ...(st.signing || {}), mode: "google", status: "erro", error: String(r?.error || "erro").slice(0, 200) } });
    await addEvent(slug, { type: "signing-error", message: String(r?.error || "erro").slice(0, 200) });
    await notifyOwner(`Aprovada, mas o contrato não foi para o Drive · ${clientLabel(q, slug)}`, ["Abra o Studio e toque em \"Preparar contrato para assinatura\" para tentar de novo."], { href: `${SITE}/app/#/c/${slug}`, label: "Abrir no Studio" });
    return;
  }
  await patchState(slug, { signing: { mode: "google", status: "aguardando", pdfName, pdfId: r.pdfId, pdfUrl: r.pdfUrl, folderUrl: r.folderUrl, preparedAt: new Date().toISOString() } });
  await addEvent(slug, { type: "signing-ready" });
  await notifyOwner(`Proposta aprovada · ${clientLabel(q, slug)}${st.contractNumber ? " · " + st.contractNumber : ""}`, [
    `${st.signer?.name || q.client?.name || "O cliente"} aprovou "${q.title || "a proposta"}" · ${brl(st.total)}.`,
    `Abra o PDF no Drive e toque em "Solicitar assinatura": seu campo e o do cliente (${st.signer?.email || "e-mail do cliente"}).`,
  ], { href: r.pdfUrl, label: "Abrir o contrato no Drive" });
  const to = st.signer?.email || q.client?.email;
  if (to) await sendMail(to, mails.aprovada({ name: st.signer?.name || q.client?.name, title: q.title, link: `${origin}/${slug}`, contractNumber: st.contractNumber }));
}

/* Procura os PDFs assinados pelo Google dos contratos que aguardam assinatura. */
export async function checkGoogleSignatures(onlySlug?: string) {
  if (!googleReady()) return { checked: 0, signed: [] as string[], error: "Google não configurado" };
  const pending: { slug: string; st: any }[] = [];
  if (onlySlug) { const st: any = await getState(onlySlug); if (st.signing?.status === "aguardando") pending.push({ slug: onlySlug, st }); }
  else {
    const { blobs } = await store("state").list();
    await Promise.all(blobs.map(async (b) => { const st: any = await store("state").get(b.key, { type: "json" }); if (st?.signing?.mode === "google" && st.signing.status === "aguardando") pending.push({ slug: b.key, st }); }));
  }
  if (!pending.length) return { checked: 0, signed: [] };
  const names = pending.map((p) => String(p.st.signing.pdfName || "").replace(/\.pdf$/i, "")).filter(Boolean);
  const r = await callGoogle("signed", { names }, 45000);
  if (!r?.ok) return { checked: pending.length, signed: [], error: String(r?.error || "erro") };
  const signed: string[] = [];
  for (const p of pending) {
    const base = String(p.st.signing.pdfName || "").replace(/\.pdf$/i, "");
    // o Google cria uma cópia "- data, hora" já ao pedir a assinatura; só a versão concluída tem a assinatura digital (/ByteRange)
    const hit = (r.files || []).filter((f: any) => String(f.name || "").startsWith(base + " - ") && Buffer.from(String(f.data || ""), "base64").includes("/ByteRange")).sort((a: any, b: any) => (a.created < b.created ? 1 : -1))[0];
    if (!hit) continue;
    const q: any = await getQuote(p.slug); if (!q) continue;
    const id = uid(), bytes = Buffer.from(String(hit.data || ""), "base64");
    await store("files").set(`${p.slug}/${id}`, bytes);
    const meta = { id, name: hit.name, type: "application/pdf", size: bytes.length, showToClient: true, kind: "contrato-assinado", uploadedAt: new Date().toISOString() };
    await quotes().setJSON(`quotes/${p.slug}`, { ...q, attachments: [...(q.attachments || []), meta], updatedAt: meta.uploadedAt });
    const signedAt = hit.created || meta.uploadedAt;
    await patchState(p.slug, { signing: { ...p.st.signing, status: "assinado", signedAt, signedFileId: id, signedDriveUrl: hit.url } });
    await addEvent(p.slug, { type: "signed-google" });
    signed.push(p.slug);
    const to = p.st.signer?.email || q.client?.email;
    if (to) await sendMail(to, mails.assinado({ name: p.st.signer?.name, title: q.title, payLink: `${SITE}/${p.slug}#pagamento`, contractNumber: p.st.contractNumber }));
    await notifyOwner(`Contrato assinado · ${clientLabel(q, p.slug)}`, [`${p.st.signer?.name || "O cliente"} assinou pelo Google. A entrada já pode ser paga.`], { href: `${SITE}/app/#/c/${p.slug}`, label: "Abrir no Studio" });
  }
  return { checked: pending.length, signed };
}
