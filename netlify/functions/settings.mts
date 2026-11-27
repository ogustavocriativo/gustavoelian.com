// Configurações do emissor, Pix, pagamento e modelo de contrato (admin).
import type { Config, Context } from "@netlify/functions";
import { DEFAULT_SETTINGS, fail, getSettings, isAdmin, json, settingsStore } from "../lib/core.mts";
import { ipApiKey, secrets } from "../lib/infinitepay.mts";

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  if (new URL(req.url).pathname.endsWith("/default-contract")) return json({ text: DEFAULT_SETTINGS.contractTemplate });
  // chave secreta colada pelo Gustavo: só entra (ou sai); nunca é devolvida
  if (new URL(req.url).pathname.endsWith("/chave")) {
    if (req.method !== "PUT") return fail("Método não permitido", 405);
    const b = await req.json().catch(() => ({}));
    if (b?.name !== "INFINITEPAY_API_KEY") return fail("Chave desconhecida");
    const v = String(b.value || "").trim();
    if (!v) { await secrets().delete("INFINITEPAY_API_KEY"); return json({ ok: true, set: false }); }
    if (v.length < 16 || v.length > 400 || /\s/.test(v)) return fail("Essa chave não parece válida. Copie de novo na InfinitePay.");
    await secrets().set("INFINITEPAY_API_KEY", v);
    return json({ ok: true, set: true });
  }
  if (req.method === "GET") return json({ ...(await getSettings()), stripeEnabled: !!Netlify.env.get("STRIPE_SECRET_KEY"), ipEnabled: !!Netlify.env.get("INFINITEPAY_HANDLE"), ipApiKey: !!(await ipApiKey()) });
  if (req.method === "PUT") {
    const body = await req.json().catch(() => null);
    if (!body) return fail("Dados inválidos");
    const { stripeEnabled, ipEnabled, ipApiKey, ...rest } = body;
    await settingsStore().setJSON("main", rest);
    return json(await getSettings());
  }
  return fail("Método não permitido", 405);
};
export const config: Config = { path: ["/api/settings", "/api/settings/default-contract", "/api/settings/chave"] };
