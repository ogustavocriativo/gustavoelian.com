// Caixa de entrada do app: todas as interações dos clientes, mais recentes primeiro.
import type { Config, Context } from "@netlify/functions";
import { fail, isAdmin, json, listEvents } from "../lib/core.mts";

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  const all = await listEvents();
  return json(all.filter((e) => e.type !== "view" || true).slice(0, 200));
};
export const config: Config = { path: "/api/inbox" };
