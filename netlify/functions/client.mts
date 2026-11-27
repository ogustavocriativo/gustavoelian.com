// Painel "Acompanhar" do cliente: acesso por link enviado ao e-mail cadastrado na proposta/contrato.
//   POST /api/acompanhar/entrar  { email }  → envia o link (resposta é sempre a mesma, para não revelar quem é cliente)
//   GET  /api/acompanhar?t=<token>          → projetos do cliente: etapa, prazos, pagamentos e arquivos liberados
import type { Config, Context } from "@netlify/functions";
import { clientToken, fail, getState, json, quotes, readClientToken } from "../lib/core.mts";
import { sendMail, callGoogle, esc, firstName, googleReady } from "../lib/google.mts";
import { mails } from "../lib/mails.mts";
import { publicDelivery, respondDelivery } from "../lib/delivery.mts";
import { submitReview } from "../lib/reviews.mts";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const STAGES: Record<string, string> = { aprovado: "Aprovado", producao: "Produção", revisao: "Revisão", entregue: "Entregue", concluido: "Concluído" };

async function quotesFor(email: string) {
  const { blobs } = await quotes().list({ prefix: "quotes/" });
  const out: any[] = [];
  await Promise.all(blobs.map(async (b) => {
    const q: any = await quotes().get(b.key, { type: "json" });
    if (!q?.published) return;
    const st: any = await getState(q.slug);
    const emails = [q.client?.email, st.signer?.email].filter(Boolean).map((x: string) => x.toLowerCase().trim());
    if (emails.includes(email)) out.push({ q, st });
  }));
  return out;
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/entrar")) {
    if (req.method !== "POST") return fail("Método não permitido", 405);
    const { email: raw } = await req.json().catch(() => ({}));
    const email = String(raw || "").toLowerCase().trim().slice(0, 160);
    if (!EMAIL_RE.test(email)) return fail("Digite um e-mail válido");
    if (!googleReady()) return fail("O envio de acesso ainda está sendo configurado. Fale comigo pelo WhatsApp.", 503);
    const found = await quotesFor(email);
    // acesso direto liberado no Studio para este cliente: abre o painel sem esperar o e-mail
    if (found.some((x) => x.st.directAccess)) return json({ ok: true, link: `/acompanhar?t=${await clientToken(email)}` });
    if (found.length) {
      const link = `${url.origin}/acompanhar?t=${await clientToken(email)}`;
      const name = found[0].st.signer?.name || found[0].q.client?.name || "";
      await sendMail(email, mails.acesso({ name, link }));
    }
    await new Promise((r) => setTimeout(r, 400));
    return json({ ok: true });
  }

  /* Avaliação do cliente, no painel (só depois da conclusão): { t, slug, rating, message, name, role, consent } */
  if (url.pathname.endsWith("/avaliacao")) {
    if (req.method !== "POST") return fail("Método não permitido", 405);
    const b = await req.json().catch(() => ({}));
    const who = await readClientToken(String(b.t || ""));
    if (!who) return fail("Seu acesso expirou. Peça um novo link no painel.", 401);
    const mine = (await quotesFor(who)).find((x) => x.q.slug === String(b.slug || ""));
    if (!mine) return fail("Projeto não encontrado", 404);
    const r: any = await submitReview(mine.q.slug, b);
    if (r.error) return fail(r.error, 409);
    return json({ ok: true });
  }

  /* Resposta à entrega final, no painel: { t, slug, kind: "aprovar" | "ajustes", message } */
  if (url.pathname.endsWith("/entrega")) {
    if (req.method !== "POST") return fail("Método não permitido", 405);
    const b = await req.json().catch(() => ({}));
    const who = await readClientToken(String(b.t || ""));
    if (!who) return fail("Seu acesso expirou. Peça um novo link no painel.", 401);
    const mine = (await quotesFor(who)).find((x) => x.q.slug === String(b.slug || ""));
    if (!mine) return fail("Projeto não encontrado", 404);
    const kind = b.kind === "aprovar" ? "aprovar" : b.kind === "ajustes" ? "ajustes" : "";
    if (!kind) return fail("Resposta inválida");
    const r: any = await respondDelivery(mine.q.slug, kind, String(b.message || ""), url.origin);
    if (r.error) return fail(r.error, 409);
    return json(r);
  }

  if (req.method !== "GET") return fail("Método não permitido", 405);
  const email = await readClientToken(url.searchParams.get("t") || "");
  if (!email) return fail("Link expirado ou inválido. Peça um novo acesso.", 401);
  const list = (await quotesFor(email)).sort((a, b) => ((a.st.approvedAt || a.q.createdAt) < (b.st.approvedAt || b.q.createdAt) ? 1 : -1));
  return json({
    email,
    name: list[0]?.st.signer?.name || list[0]?.q.client?.name || "",
    projects: list.map(({ q, st }) => {
      const stage = st.approvedAt ? st.work?.stage || "aprovado" : "proposta";
      return {
        slug: q.slug, title: q.title || "Projeto", company: q.client?.company || "",
        status: stage, statusLabel: stage === "proposta" ? "Proposta aguardando aprovação" : STAGES[stage] || stage,
        stages: Object.entries(STAGES).map(([id, label]) => ({ id, label })),
        history: (st.work?.history || []).map((h: any) => ({ stage: h.stage, label: STAGES[h.stage] || h.stage, at: h.at })),
        approvedAt: st.approvedAt || null, dueDate: st.work?.dueDate || "",
        total: Number(st.total || 0), paid: Number(st.paidTotal || 0),
        payments: (st.payments || []).map((p: any) => ({ amount: p.amount, date: p.date, method: p.method, receipt: `/api/pdf/${q.slug}/recibo-${p.id}?download` })),
        amendments: (st.amendments || []).map((a: any) => ({ n: a.n, at: a.at, text: a.next?.text || "", pdf: `/api/pdf/${q.slug}/aditivo-${a.n}?download` })),
        files: (q.attachments || []).filter((a: any) => a.showToClient && !a.fromClient).map((a: any) => ({ name: a.name, size: a.size, url: `/api/quotes/${q.slug}/files/${a.id}?download` })),
        contractPdf: st.approvedAt && st.contractText ? `/api/pdf/${q.slug}/contrato?download` : "",
        page: `/${q.slug}`,
        delivery: publicDelivery(st.delivery),
        concluded: !!st.delivery?.certificate,
        canPay: !!st.approvedAt && (st.signing?.mode !== "google" || st.signing.status === "assinado") && Number(st.total || 0) - Number(st.paidTotal || 0) >= 1,
        review: st.review ? { rating: st.review.rating, message: st.review.message, name: st.review.name, role: st.review.role, consent: st.review.consent, status: st.review.status, at: st.review.at } : null,
        signerName: st.signer?.name || q.client?.name || "",
      };
    }),
  }, 200, { "cache-control": "no-store" });
};

export const config: Config = {
  path: ["/api/acompanhar", "/api/acompanhar/entrar", "/api/acompanhar/entrega", "/api/acompanhar/avaliacao"],
  rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
