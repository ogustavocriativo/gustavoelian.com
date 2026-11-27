// InfinitePay (Checkout Integrado): cria o link de pagamento (cartão em até 12x e Pix) e confere o pagamento.
// Não há sandbox nem assinatura no webhook: todo aviso é confirmado no payment_check antes de dar baixa.
// Configuração: INFINITEPAY_HANDLE (InfiniteTag sem o $) e INFINITEPAY_API_KEY (necessária para não pedir endereço de entrega).
import { store } from "./core.mts";

const API = "https://api.checkout.infinitepay.io";
export const ipHandle = () => String(Netlify.env.get("INFINITEPAY_HANDLE") || "").trim().replace(/^\$/, "");
export const ipReady = () => !!ipHandle();
export const ipNoAddress = () => !!Netlify.env.get("INFINITEPAY_API_KEY");
export const ipOrders = () => store("ip-orders");

export type IpOrder = { kind: "charge" | "quote"; id: string; amount: number; label: string; createdAt: string; done?: boolean; paidAt?: string; transaction?: string; method?: string };

function headers() {
  const h: Record<string, string> = { "content-type": "application/json" };
  const key = Netlify.env.get("INFINITEPAY_API_KEY");
  if (key) h["X-Api-Key"] = key;
  return h;
}

/** Cria o link de checkout. `amount` em reais. Devolve a URL para onde o cliente vai. */
export async function ipCreateLink(o: { kind: "charge" | "quote"; id: string; amount: number; label: string; origin: string; back: string; maxInstallments?: number; customer?: { name?: string; email?: string; phone?: string }; address?: any }) {
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
  // endereço que já temos do cadastro: vai pré-preenchido (a InfinitePay só aceita o endereço completo)
  const a = o.address;
  if (a?.cep && a.street && a.number && a.city && a.state) body.address = { cep: a.cep, street: a.street, number: a.number, neighborhood: a.neighborhood || "", city: a.city, state: a.state, ...(a.complement ? { complement: a.complement } : {}) };
  // serviço digital, sem entrega física: não pede endereço de entrega (exige a chave de API da InfinitePay)
  if (Netlify.env.get("INFINITEPAY_API_KEY")) body.options = { require_delivery_address: false };
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

/** Lê o endereço em texto (cadastros antigos: "Rua, 123 - compl, Bairro, Cidade/UF, CEP 00000-000") em partes. */
export function parseAddress(txt: any) {
  const t = String(txt || "");
  const cep = (t.match(/(\d{5})-?(\d{3})/) || []).slice(1).join("");
  const parts = t.replace(/,?\s*CEP\s*[\d.-]+/i, "").split(",").map((x) => x.trim()).filter(Boolean);
  if (cep.length !== 8 || parts.length < 3) return null;
  const cityUf = parts[parts.length - 1].match(/^(.+?)\s*[\/-]\s*([A-Za-z]{2})$/);
  if (!cityUf) return null;
  const [num, ...comp] = (parts[1] || "").split(" - ");
  return { cep, street: parts[0], number: num.trim(), complement: comp.join(" - ").trim(), neighborhood: parts.length > 3 ? parts[2] : "", city: cityUf[1], state: cityUf[2].toUpperCase() };
}
