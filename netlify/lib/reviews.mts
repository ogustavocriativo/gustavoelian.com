// Avaliações dos clientes: pedidas por e-mail 3 dias depois da conclusão (entrega aprovada + contrato quitado),
// escritas pelo cliente no painel, aprovadas pelo Gustavo no Studio e só então publicadas no site.
// A avaliação fica no estado do contrato (st.review); as publicadas também vão para store("reviews"), que o site lê.
import { addEvent, clientToken, getQuote, getState, patchState, store } from "./core.mts";

export const reviews = () => store("reviews");
export const REVIEW_DELAY_DAYS = 3;
const str = (v: any, n: number) => String(v ?? "").trim().slice(0, n);

/** Versão pública (o que aparece no site). */
export function publicReview(slug: string, q: any, r: any) {
  return { id: slug, name: r.name, role: r.role || "", rating: r.rating, message: r.message, highlight: r.highlight || "", project: q?.title || "", date: (r.at || "").slice(0, 10) };
}

/** Cliente envia ou atualiza a avaliação (só depois da conclusão). */
export async function submitReview(slug: string, input: any) {
  const q: any = await getQuote(slug); const st: any = await getState(slug);
  if (!q || !st.delivery?.certificate) return { error: "A avaliação fica disponível quando o projeto for concluído" };
  if (st.review?.status === "publicada") return { error: "Sua avaliação já está publicada. Para mudar, fale comigo." };
  const rating = Math.round(Number(input.rating));
  if (!(rating >= 1 && rating <= 5)) return { error: "Escolha uma nota de 1 a 5" };
  const message = str(input.message, 1500);
  if (message.length < 10) return { error: "Escreva pelo menos uma frase sobre a experiência" };
  const name = str(input.name, 80) || st.signer?.name || q.client?.name || "";
  const review = { rating, message, name, role: str(input.role, 80), consent: input.consent === true, status: "pendente", at: new Date().toISOString(), highlight: "" };
  await patchState(slug, { review });
  await addEvent(slug, { type: "review", rating, consent: review.consent });
  const { notifyOwner } = await import("./signing.mts");
  await notifyOwner(`Nova avaliação (${rating}/5) · ${q.client?.company || name}`, [`"${message}"`, review.consent ? "O cliente autorizou publicar no site. Aprove no Studio para ela aparecer." : "O cliente NÃO autorizou publicar: ela fica só no Studio."], { href: `https://gustavoelian.com/app/#/c/${slug}`, label: "Avaliar no Studio" });
  return { ok: true, review };
}

/** Gustavo publica, oculta ou recusa; pode ajustar a frase em destaque e como o nome aparece. */
export async function moderateReview(slug: string, input: any) {
  const q: any = await getQuote(slug); const st: any = await getState(slug);
  const r = st.review;
  if (!q || !r) return { error: "Este cliente ainda não enviou avaliação" };
  const next = { ...r, highlight: input.highlight !== undefined ? str(input.highlight, 160) : r.highlight || "", name: input.name !== undefined ? str(input.name, 80) || r.name : r.name, role: input.role !== undefined ? str(input.role, 80) : r.role };
  const action = String(input.action || "");
  if (action === "publicar") {
    if (!r.consent) return { error: "O cliente não autorizou a publicação" };
    next.status = "publicada"; next.decidedAt = new Date().toISOString();
    await reviews().setJSON(slug, publicReview(slug, q, next));
  } else if (action === "recusar" || action === "ocultar") {
    next.status = action === "recusar" ? "recusada" : "oculta"; next.decidedAt = new Date().toISOString();
    await reviews().delete(slug);
  } else if (r.status === "publicada") {
    await reviews().setJSON(slug, publicReview(slug, q, next)); // só edição de destaque/nome
  }
  await patchState(slug, { review: next });
  if (action) await addEvent(slug, { type: "review-" + next.status });
  return { ok: true, review: next };
}

/** Envia o pedido de avaliação (automático após 3 dias, ou na hora pelo Studio). */
export async function requestReview(slug: string, origin = "https://gustavoelian.com") {
  const q: any = await getQuote(slug); const st: any = await getState(slug);
  if (!q || !st.delivery?.certificate) return { error: "O projeto ainda não foi concluído" };
  const to = st.signer?.email || q.client?.email;
  if (!to) return { error: "Cliente sem e-mail" };
  const { googleReady, sendMail } = await import("./google.mts");
  if (!googleReady()) return { error: "Gmail ainda não ligado" };
  const { mails } = await import("./mails.mts");
  const r = await sendMail(to, mails.avaliacao({ name: st.signer?.name || q.client?.name, title: q.title, link: `${origin}/acompanhar?t=${await clientToken(to, 30)}#avaliar` }));
  if (!r?.ok) return { error: String(r?.error || "Falha no envio") };
  await patchState(slug, { reviewRequest: { at: new Date().toISOString(), to } });
  await addEvent(slug, { type: "email-sent", what: "avaliacao", to });
  return { ok: true, to };
}

/** Rotina (cron): pede avaliação a quem concluiu há 3 dias ou mais e ainda não recebeu o pedido. */
export async function requestDueReviews(origin = "https://gustavoelian.com") {
  const { blobs } = await store("state").list();
  const due: string[] = [];
  await Promise.all(blobs.map(async (b) => {
    const st: any = await store("state").get(b.key, { type: "json" });
    const done = st?.delivery?.certificateIssuedAt || st?.delivery?.certificate?.at;
    if (done && !st.reviewRequest && !st.review && Date.now() - Date.parse(done) >= REVIEW_DELAY_DAYS * 864e5) due.push(b.key);
  }));
  const sent: string[] = [];
  for (const slug of due) { const r = await requestReview(slug, origin); if ((r as any).ok) sent.push(slug); }
  return { due: due.length, sent };
}
