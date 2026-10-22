// Núcleo compartilhado pelas functions: armazenamento, sessão do admin, utilidades.
import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

/* ---------- Armazenamento (Netlify Blobs) ----------
   quotes   → quotes/<slug>          orçamento completo (escrito só pelo admin)
   state    → <slug>                 estado público (visto, seleção, aprovado, pago)
   events   → <slug>/<ts>-<rand>     linha do tempo de interações (append-only)
   files    → <slug>/<fileId>        anexos binários
   settings → main                   configurações do emissor */
export const store = (name: string) => getStore({ name, consistency: "strong" });
export const quotes = () => store("quotes");
export const states = () => store("state");
export const events = () => store("events");
export const files = () => store("files");
export const settingsStore = () => store("settings");

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
export const fail = (message: string, status = 400) => json({ error: message }, status);

/* ---------- Sessão do admin (cookie assinado com HMAC) ---------- */
const COOKIE = "ge_session";
const secret = () => Netlify.env.get("SESSION_SECRET") || "dev-secret-troque-em-producao";
const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
export async function createSession(context: Context) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 dias
  const payload = `admin.${exp}`;
  const token = `${payload}.${await hmac(payload)}`;
  context.cookies.set({ name: COOKIE, value: token, httpOnly: true, secure: true, sameSite: "Lax", path: "/", expires: new Date(exp) });
}
export function clearSession(context: Context) {
  context.cookies.delete({ name: COOKIE, path: "/" });
}
export async function isAdmin(context: Context) {
  const token = context.cookies.get(COOKIE);
  if (!token) return false;
  const i = token.lastIndexOf(".");
  const payload = token.slice(0, i), sig = token.slice(i + 1);
  if ((await hmac(payload)) !== sig) return false;
  const exp = Number(payload.split(".")[1]);
  return exp > Date.now();
}
export function checkPassword(pw: string) {
  const expected = Netlify.env.get("ADMIN_PASSWORD");
  if (!expected) return false;
  // comparação em tempo constante
  const a = enc.encode(pw), b = enc.encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ---------- Identificadores ---------- */
export function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cliente";
}
export function shortCode(n = 3) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // sem caracteres ambíguos
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
export const uid = () => Date.now().toString(36) + shortCode(4);
export const SLUG_RE = /^[a-z0-9-]{3,60}$/;

/* ---------- Leitura de dados ---------- */
export type Quote = Record<string, any>;
export async function getQuote(slug: string): Promise<Quote | null> {
  if (!SLUG_RE.test(slug)) return null;
  return (await quotes().get(`quotes/${slug}`, { type: "json" })) as Quote | null;
}
export async function getState(slug: string) {
  return ((await states().get(slug, { type: "json" })) as Record<string, any>) || {};
}
export async function patchState(slug: string, patch: Record<string, any>) {
  const cur = await getState(slug);
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  await states().setJSON(slug, next);
  return next;
}
export async function addEvent(slug: string, ev: Record<string, any>) {
  const at = new Date().toISOString();
  const key = `${slug}/${Date.now().toString().padStart(15, "0")}-${shortCode(4)}`;
  const full = { ...ev, slug, at, id: key };
  await events().setJSON(key, full);
  return full;
}
export async function listEvents(slug?: string) {
  const { blobs } = await events().list(slug ? { prefix: `${slug}/` } : {});
  const out = await Promise.all(blobs.map((b) => events().get(b.key, { type: "json" })));
  return (out.filter(Boolean) as any[]).sort((a, b) => (a.at < b.at ? 1 : -1));
}

export const DEFAULT_SETTINGS = {
  issuer: {
    name: "Gustavo Elian",
    doc: "CNPJ 56.891.693/0001-04",
    email: "contato@gustavoelian.com",
    site: "gustavoelian.com",
    whatsapp: "5538984120719",
    whatsappLabel: "(38) 98412-0719",
    city: "Montes Claros",
  },
  pix: { key: "", merchantName: "GUSTAVO ELIAN", merchantCity: "MONTES CLAROS" },
  payments: { entryPct: 60, maxInstallments: 5 },
  contractTemplate: `CONTRATANTE: {{cliente}}{{documento}}.
CONTRATADO: {{emissor}}, {{emissor_doc}}.

1. OBJETO. O CONTRATADO prestará ao CONTRATANTE os seguintes serviços: {{servicos}}.

2. VALOR E PAGAMENTO. O valor total é de {{valor}}, na condição {{pagamento}}.

3. PRAZOS. Os prazos de entrega são os descritos na proposta e começam a contar a partir da confirmação do pagamento da entrada e do envio dos materiais necessários pelo CONTRATANTE.

4. AJUSTES. Estão incluídas as rodadas de ajuste previstas na proposta. Novas demandas fora do escopo serão orçadas à parte.

5. DIREITOS DE USO. Após a quitação integral, o CONTRATANTE recebe o direito de uso das peças entregues. O CONTRATADO pode exibir o trabalho em seu portfólio, salvo pedido expresso em contrário.

6. CANCELAMENTO. Em caso de cancelamento pelo CONTRATANTE após o início dos trabalhos, o valor da entrada não será devolvido.

7. ACEITE ELETRÔNICO. As partes reconhecem a validade do aceite eletrônico deste instrumento, com registro de nome, documento, e-mail, data, hora, endereço IP e código de verificação do documento.`,
};
export async function getSettings() {
  const saved = ((await settingsStore().get("main", { type: "json" })) as any) || {};
  return {
    ...DEFAULT_SETTINGS, ...saved,
    issuer: { ...DEFAULT_SETTINGS.issuer, ...(saved.issuer || {}) },
    pix: { ...DEFAULT_SETTINGS.pix, ...(saved.pix || {}) },
    payments: { ...DEFAULT_SETTINGS.payments, ...(saved.payments || {}) },
  };
}

/* ---------- Cálculos de preço (mesma regra no app, na página e no PDF) ---------- */
export function priceOf(q: Quote, sel: { packageId?: string | null; itemIds?: string[] }) {
  const items = q.items || [];
  if (sel.packageId) {
    const p = (q.packages || []).find((x: any) => x.id === sel.packageId);
    if (p) {
      const full = items.filter((i: any) => p.itemIds.includes(i.id)).reduce((s: number, i: any) => s + Number(i.price || 0), 0);
      return { label: p.name, itemIds: p.itemIds, full, cash: Number(p.cash || full), card: Number(p.card || p.cash || full), installments: Number(p.installments || 1) };
    }
  }
  const ids = sel.itemIds?.length ? sel.itemIds : items.map((i: any) => i.id);
  const chosen = items.filter((i: any) => ids.includes(i.id));
  const full = chosen.reduce((s: number, i: any) => s + Number(i.price || 0), 0);
  return { label: chosen.map((i: any) => i.title).join(" + "), itemIds: ids, full, cash: full, card: full, installments: Number(q.defaultInstallments || 1) };
}
export const brl = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function sha256(text: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", enc.encode(text))).toString("hex");
}
