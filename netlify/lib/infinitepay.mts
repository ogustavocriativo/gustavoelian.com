// InfinitePay (Checkout Integrado): cria o link de pagamento (cartão em até 12x e Pix) e confere o pagamento.
// Não há sandbox nem assinatura no webhook: todo aviso é confirmado no payment_check antes de dar baixa.
// Configuração: INFINITEPAY_HANDLE (InfiniteTag sem o $) e, opcional, INFINITEPAY_API_KEY.
import { store } from "./core.mts";

const API = "https://api.checkout.infinitepay.io";
export const ipHandle = () => String(Netlify.env.get("INFINITEPAY_HANDLE") || "").trim().replace(/^\$/, "");
export const ipReady = () => !!ipHandle();
export const ipOrders = () => store("ip-orders");

export type IpOrder = { kind: "charge" | "quote"; id: string; amount: number; label: string; createdAt: string; done?: boolean; paidAt?: string; transaction?: string; method?: string };

function headers() {
  const h: Record<string, string> = { "content-type": "application/json" };
  const key = Netlify.env.get("INFINITEPAY_API_KEY");
  if (key) h["X-Api-Key"] = key;
  return h;
}

/** Cria o link de checkout. `amount` em reais. Devolve a URL para onde o cliente vai. */
export async function ipCreateLink(o: { kind: "charge" | "quote"; id: string; amount: number; label: string; origin: string; back: string; maxInstallments?: number; customer?: { name?: string; email?: string; phone?: string } }) {
  const cents = Math.round(o.amount * 100);
  if (cents < 100) throw new Error("O valor mínimo no InfinitePay é R$ 1,00");
  const nsu = `${o.kind === "charge" ? "c" : "q"}-${o.id}-${Date.now().toString(36)}`.slice(0, 60);
  await ipOrders().setJSON(nsu, { kind: o.kind, id: o.id, amount: o.amount, label: o.label, back: o.back, createdAt: new Date().toISOString() });
  const hook = `${o.origin}/api/infinitepay/webhook`;
  const body: any = {
    handle: ipHandle(),
    items: [{ description: o.label.slice(0, 120), quantity: 1, price: cents }],
    order_nsu: nsu,
    redirect_url: `${o.origin}/api/infinitepay/retorno`,
    webhook_url: hook,
  };
  const c = o.customer || {};
  if (c.name || c.email || c.phone) body.customer = { ...(c.name ? { name: c.name } : {}), ...(c.email ? { email: c.email } : {}), ...(c.phone ? { phone_number: "+55" + c.phone.replace(/\D/g, "").replace(/^55/, "") } : {}) };
  const r = await fetch(`${API}/links`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const data: any = await r.json().catch(() => ({}));
  const url = data.url || data.link || data.checkout_url || data.payment_url;
  if (!r.ok || !url) throw new Error(data?.message || data?.error || `InfinitePay recusou o link (${r.status})`);
  return { url, nsu };
}

/** Confere na InfinitePay se o pedido foi pago. */
export async function ipCheck(p: { order_nsu: string; transaction_nsu: string; slug: string }) {
  const r = await fetch(`${API}/payment_check`, { method: "POST", headers: headers(), body: JSON.stringify({ handle: ipHandle(), ...p }) });
  const d: any = await r.json().catch(() => ({}));
  return { paid: !!(d.success && d.paid), amount: Number(d.amount || 0) / 100, paidAmount: Number(d.paid_amount || d.amount || 0) / 100, installments: Number(d.installments || 1), method: String(d.capture_method || "") };
}
