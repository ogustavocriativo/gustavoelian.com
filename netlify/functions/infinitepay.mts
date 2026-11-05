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
  if (o.kind === "charge") await markChargePaid(o.id, { amount, method, note, ref: `ip-${transaction_nsu}` });
  else {
    const cur = await getState(o.id);
    if (!(cur.payments || []).some((p: any) => p.id === `ip-${transaction_nsu}`)) {
      const payments = [...(cur.payments || []), { id: `ip-${transaction_nsu}`, amount, date: at.slice(0, 10), method, note, at }];
      const paidTotal = payments.reduce((t: number, p: any) => t + Number(p.amount || 0), 0);
      await patchState(o.id, { paidAt: cur.paidAt || at, payment: cur.payment || { method: "infinitepay", amount }, payments, paidTotal });
      await addEvent(o.id, { type: "paid", method: method === "pix" ? "Pix (InfinitePay)" : "cartão (InfinitePay)", total: amount });
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
