// Retorno e webhook da InfinitePay. Os dois caminhos confirmam no payment_check e dão baixa uma única vez.
//   POST /api/infinitepay/webhook   { order_nsu, transaction_nsu, invoice_slug, capture_method, paid_amount, ... }
//   GET  /api/infinitepay/retorno?order_nsu=&transaction_nsu=&slug=&capture_method=  → volta para a página do cliente
import type { Config, Context } from "@netlify/functions";
import { addEvent, getState, json, patchState } from "../lib/core.mts";
import { markChargePaid } from "../lib/charges.mts";
import { ipCheck, ipOrders, type IpOrder } from "../lib/infinitepay.mts";

const methodOf = (m: string) => (/pix/i.test(m) ? "pix" : "cartao");

async function settle(order_nsu: string, transaction_nsu: string, slug: string) {
  if (!order_nsu || !transaction_nsu || !slug) return { ok: false, reason: "dados incompletos" } as const;
  const S = ipOrders();
  const o = (await S.get(order_nsu, { type: "json" })) as (IpOrder & { back?: string }) | null;
  if (!o) return { ok: false, reason: "pedido desconhecido" } as const;
  if (o.done) return { ok: true, order: o } as const;
  const chk = await ipCheck({ order_nsu, transaction_nsu, slug });
  if (!chk.paid) return { ok: false, order: o, reason: "pagamento não confirmado" } as const;
  const method = methodOf(chk.method);
  const amount = chk.paidAmount || o.amount;
  const note = `InfinitePay${chk.installments > 1 ? ` · ${chk.installments}x` : ""}`;
  // trava antes de lançar, para webhook e retorno simultâneos não lançarem duas vezes
  const at = new Date().toISOString();
  await S.setJSON(order_nsu, { ...o, done: true, paidAt: at, transaction: transaction_nsu, method });
  if (o.kind === "charge") {
    const c: any = await markChargePaid(o.id, { amount, method, note, ref: `ip-${transaction_nsu}` });
    try { const { notifyOwner } = await import("../lib/signing.mts");
      await notifyOwner(`Cobrança paga · R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · ${c?.name || o.id}`, [`${method === "pix" ? "Pix" : "Cartão"} pela InfinitePay${chk.installments > 1 ? ` em ${chk.installments}x` : ""}. Baixa feita automaticamente.`, c?.desc || ""].filter(Boolean), { href: "https://gustavoelian.com/app/#/financeiro", label: "Abrir o Financeiro" }); } catch {}
  }
  else {
    const cur = await getState(o.id);
    if (!(cur.payments || []).some((p: any) => p.id === `ip-${transaction_nsu}`)) {
      const payments = [...(cur.payments || []), { id: `ip-${transaction_nsu}`, amount, date: at.slice(0, 10), method, note, at }];
      const paidTotal = payments.reduce((t: number, p: any) => t + Number(p.amount || 0), 0);
      await patchState(o.id, { paidAt: cur.paidAt || at, payment: cur.payment || { method: "infinitepay", amount }, payments, paidTotal });
      await addEvent(o.id, { type: "paid", method: method === "pix" ? "Pix (InfinitePay)" : "cartão (InfinitePay)", total: amount });
      // recibo automático (o comprovante da transação a InfinitePay envia à parte); o certificado, se for o caso, vem depois
      try {
        const { getQuote, clientToken } = await import("../lib/core.mts");
        const { googleReady, sendMail } = await import("../lib/google.mts");
        const { mails } = await import("../lib/mails.mts");
        const q: any = await getQuote(o.id); const to = cur.signer?.email || q?.client?.email;
        if (q && to && googleReady()) {
          const origin = "https://gustavoelian.com";
          const { docToDrive } = await import("../lib/google.mts");
          const fresh: any = await getState(o.id);
          const rec = await docToDrive("recibo", q, fresh, origin, `ip-${transaction_nsu}`, "Recibos", `${at.slice(0, 10)} · Recibo R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · Contrato ${cur.contractNumber || o.id}.pdf`);
          const r = await sendMail(to, mails.recibo({ name: cur.signer?.name || q.client?.name, title: q.title, contractNumber: cur.contractNumber, amount, date: at.slice(0, 10), method: method === "pix" ? "Pix" : `cartão de crédito${chk.installments > 1 ? ` em ${chk.installments}x` : ""}`, paid: paidTotal, total: Number(cur.total || 0), id: `ip-${transaction_nsu}`, panel: `${origin}/acompanhar?t=${await clientToken(to)}` }), rec ? { pdfFileId: rec.id } : {});
          await addEvent(o.id, { type: r?.ok ? "email-sent" : "email-error", what: "recibo", to });
        }
        const { notifyOwner } = await import("../lib/signing.mts");
        await notifyOwner(`Pagamento confirmado · R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · ${q?.client?.company || q?.client?.name || o.id}`, [`${method === "pix" ? "Pix" : "Cartão"} pela InfinitePay${chk.installments > 1 ? ` em ${chk.installments}x` : ""}. Baixa e recibo feitos automaticamente.`, `Pago: R$ ${paidTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de R$ ${Number(cur.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`], { href: `https://gustavoelian.com/app/#/c/${o.id}`, label: "Abrir no Studio" });
      } catch {}
      await (await import("../lib/delivery.mts")).issueCertificateIfPaid(o.id).catch(() => {});
    }
  }
  return { ok: true, order: o } as const;
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/webhook")) {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
    const b: any = await req.json().catch(() => null);
    if (!b) return json({ error: "Corpo inválido" }, 400);
    const r = await settle(String(b.order_nsu || ""), String(b.transaction_nsu || ""), String(b.invoice_slug || b.slug || ""));
    // pedido desconhecido ou não pago: 200 para não ficar reenviando; confirmação real vem do payment_check
    return json({ ok: r.ok, reason: (r as any).reason || null });
  }
  // retorno do cliente
  const q = url.searchParams;
  const r = await settle(q.get("order_nsu") || "", q.get("transaction_nsu") || "", q.get("slug") || q.get("invoice_slug") || "");
  const back = (r as any).order?.back || "/";
  const dest = new URL(back, url.origin);
  dest.searchParams.set("pagamento", r.ok ? "ok" : "pendente");
  return Response.redirect(dest.toString(), 302);
};

export const config: Config = { path: ["/api/infinitepay/webhook", "/api/infinitepay/retorno"] };
