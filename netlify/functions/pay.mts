// Pagamentos: Pix (BR Code estático gerado a partir da chave do emissor) e cartão/Apple Pay (Stripe Checkout, quando configurado).
import type { Config, Context } from "@netlify/functions";
import QRCode from "qrcode";
import { markChargePaid } from "../lib/charges.mts";
import { addEvent, brl, fail, getQuote, getSettings, getState, json, patchState, priceOf } from "../lib/core.mts";

function tlv(id: string, value: string) { return id + String(value.length).padStart(2, "0") + value; }
function crc16(str: string) {
  let crc = 0xffff;
  for (const ch of Buffer.from(str, "utf8")) {
    crc ^= ch << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
const ascii = (s: string, n: number) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, n);
export function pixPayload(key: string, name: string, city: string, amount: number, txid: string) {
  const gui = tlv("00", "br.gov.bcb.pix") + tlv("01", key.trim());
  let p = tlv("00", "01") + tlv("26", gui) + tlv("52", "0000") + tlv("53", "986");
  if (amount > 0) p += tlv("54", amount.toFixed(2));
  p += tlv("58", "BR") + tlv("59", ascii(name, 25) || "RECEBEDOR") + tlv("60", ascii(city, 15) || "BRASIL");
  p += tlv("62", tlv("05", (txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25)) || "***"));
  p += "6304";
  return p + crc16(p);
}

function amountFor(q: any, settings: any, sel: any) {
  const p = priceOf(q, sel || {});
  if (sel?.method === "cartao") return { amount: p.card, label: `${p.label} · cartão`, installments: p.installments };
  const pct = Number(settings.payments.entryPct ?? 60);
  return { amount: Math.round(p.cash * pct) / 100, label: `${p.label} · entrada de ${pct}%`, installments: 1 };
}

async function verifyStripe(raw: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  if (!parts.t || !parts.v1) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${raw}`))).toString("hex");
  return sig === parts.v1 && Math.abs(Date.now() / 1000 - Number(parts.t)) < 600;
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);

  // Webhook do Stripe: confirma pagamento com cartão/Apple Pay
  if (url.pathname === "/api/stripe-webhook") {
    const secret = Netlify.env.get("STRIPE_WEBHOOK_SECRET");
    const raw = await req.text();
    if (!secret || !(await verifyStripe(raw, req.headers.get("stripe-signature") || "", secret))) return fail("Assinatura inválida", 400);
    const evt = JSON.parse(raw);
    if (evt.type === "checkout.session.completed") {
      const s = evt.data.object;
      const slug = s.metadata?.slug;
      // cobrança avulsa por link (/pagar/<id>)
      if (s.metadata?.charge) await markChargePaid(String(s.metadata.charge), { amount: s.amount_total / 100, method: "cartao", note: "Stripe", ref: s.id });
      else if (slug) {
        const cur = await getState(slug);
        const amount = s.amount_total / 100;
        const payments = [...(cur.payments || []), { id: s.id, amount, date: new Date().toISOString().slice(0, 10), method: "cartao", note: "Stripe", at: new Date().toISOString() }];
        const paidTotal = payments.reduce((t: number, p: any) => t + Number(p.amount || 0), 0);
        await patchState(slug, { paidAt: new Date().toISOString(), payment: { method: "stripe", amount, sessionId: s.id }, payments, paidTotal });
        await addEvent(slug, { type: "paid", method: "cartão", total: s.amount_total / 100 });
      }
    }
    return json({ received: true });
  }

  const { slug, action } = context.params;
  const q = await getQuote(slug);
  if (!q || !q.published) return fail("Proposta não encontrada", 404);
  const settings = await getSettings();
  const st = await getState(slug);
  const sel = st.selection || { method: "avista" };

  if (action === "pix") {
    if (!settings.pix.key) return fail("Pix ainda não configurado", 404);
    const { amount, label } = amountFor(q, settings, { ...sel, method: "avista" });
    const payload = pixPayload(settings.pix.key, settings.pix.merchantName, settings.pix.merchantCity, amount, slug.replace(/-/g, ""));
    const svg = await QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return json({ amount, amountLabel: brl(amount), label, payload, svg });
  }

  if (action === "checkout" && req.method === "POST") {
    const key = Netlify.env.get("STRIPE_SECRET_KEY");
    if (!key) return fail("Pagamento com cartão ainda não configurado", 404);
    const { amount, label, installments } = amountFor(q, settings, { ...sel, method: "cartao" });
    const origin = url.origin;
    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "brl",
      "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
      "line_items[0][price_data][product_data][name]": `Proposta ${q.client?.name || ""} · ${label}`.slice(0, 250),
      success_url: `${origin}/${slug}?pagamento=ok`,
      cancel_url: `${origin}/${slug}?pagamento=cancelado`,
      "metadata[slug]": slug,
      locale: "pt-BR",
    });
    if (installments > 1) form.set("payment_method_options[card][installments][enabled]", "true");
    if (st.signer?.email) form.set("customer_email", st.signer.email);
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" }, body: form,
    });
    const data = await r.json();
    if (!r.ok) return fail(data?.error?.message || "Não foi possível iniciar o pagamento", 502);
    await addEvent(slug, { type: "checkout-start", total: amount });
    return json({ url: data.url });
  }
  return fail("Ação desconhecida", 404);
};

export const config: Config = { path: ["/api/pay/:slug/:action", "/api/stripe-webhook"] };
