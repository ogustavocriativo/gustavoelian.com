// Cobranças avulsas: armazenamento e baixa (usado pela function de cobranças e pelo webhook do Stripe).
import { addEvent, getState, patchState, store } from "./core.mts";

export const charges = () => store("charges");
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const cardAmountOf = (c: any) => round2(Number(c.amount) * (1 + Number(c.cardFeePct || 0) / 100));

/** Registra o recebimento na cobrança e, se ela pertence a uma proposta, também no financeiro da proposta. */
export async function markChargePaid(id: string, pay: { amount: number; method: string; note?: string; ref?: string }) {
  const c: any = await charges().get(id, { type: "json" });
  if (!c || c.status === "paga") return c;
  const at = new Date().toISOString();
  const next = { ...c, status: "paga", paidAt: at, payment: { ...pay, at } };
  await charges().setJSON(id, next);
  if (c.slug) {
    const cur = await getState(c.slug);
    const payments = [...(cur.payments || []), { id: pay.ref || `chg-${id}`, amount: pay.amount, date: at.slice(0, 10), method: pay.method, note: pay.note || `Cobrança ${id}`, at }];
    const paidTotal = payments.reduce((t: number, p: any) => t + Number(p.amount || 0), 0);
    await patchState(c.slug, { payments, paidTotal, paidAt: cur.paidAt || at });
    await addEvent(c.slug, { type: "paid", method: pay.method === "cartao" ? "cartão" : pay.method, total: pay.amount });
  }
  return next;
}

