// Configurações do emissor, Pix, pagamento e modelo de contrato (admin).
import type { Config, Context } from "@netlify/functions";
import { DEFAULT_SETTINGS, fail, getSettings, isAdmin, json, settingsStore } from "../lib/core.mts";

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  if (new URL(req.url).pathname.endsWith("/default-contract")) return json({ text: DEFAULT_SETTINGS.contractTemplate });
  if (req.method === "GET") return json({ ...(await getSettings()), stripeEnabled: !!Netlify.env.get("STRIPE_SECRET_KEY") });
  if (req.method === "PUT") {
    const body = await req.json().catch(() => null);
    if (!body) return fail("Dados inválidos");
    const { stripeEnabled, ...rest } = body;
    await settingsStore().setJSON("main", rest);
    return json(await getSettings());
  }
  return fail("Método não permitido", 405);
};
export const config: Config = { path: ["/api/settings", "/api/settings/default-contract"] };
