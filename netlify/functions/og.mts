// Prévia de link (WhatsApp, Instagram, LinkedIn) personalizada por proposta.
//   GET /api/og/:slug        → { title, description, image } para a borda montar as metatags
//   GET /api/og/:slug/image  → PNG 1200×630: "Júlia, sua proposta está pronta."
// Não conta visita nem gera evento: os robôs das redes também passam por aqui.
import type { Config, Context } from "@netlify/functions";
import { Resvg } from "@resvg/resvg-js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { getQuote } from "../lib/core.mts";
import { LOGO_LIGHT } from "../lib/og-logo.mts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const first = (n: string) => String(n || "").trim().split(/\s+/)[0].slice(0, 16);
const cap = (s: string) => s ? s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1) : s;

function fontFiles() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const tries = [path.join(process.cwd(), "public/fonts"), path.join(here, "../../public/fonts"), path.join(here, "public/fonts")];
  const dir = tries.find((d) => fs.existsSync(path.join(d, "LTWave-Light.otf"))) || tries[0];
  return ["LTWave-Light.otf", "LTWave-Medium.otf"].map((f) => path.join(dir, f));
}

async function info(slug: string, para: string | null) {
  if (slug === "demonstracao") return { name: cap(first(para || "Marina")), title: "Identidade visual e site", demo: true };
  const q: any = await getQuote(slug);
  if (!q || !q.published) return null;
  return { name: cap(first(q.client?.name)), title: String(q.title || "Proposta").slice(0, 70), demo: false };
}

function svg(name: string, title: string) {
  const size = name.length > 11 ? 74 : name.length > 8 ? 86 : 96;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#C5DD63" stop-opacity=".55"/><stop offset=".5" stop-color="#56631C" stop-opacity=".25"/><stop offset="1" stop-color="#0A0A0B" stop-opacity="0"/></radialGradient>
  <linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#9DB441"/><stop offset="1" stop-color="#D3EA77"/></linearGradient></defs>
  <rect width="1200" height="630" fill="#0A0A0B"/>
  <circle cx="990" cy="210" r="420" fill="url(#g)"/>
  <image href="${LOGO_LIGHT}" x="80" y="68" width="300" height="55"/>
  <text x="80" y="${210 + size * 0.75}" font-family="LT Wave" font-weight="300" font-size="${size}" fill="#D3EA77" letter-spacing="-2">${esc(name)},</text>
  <text x="80" y="${215 + size * 0.75 + 78}" font-family="LT Wave" font-weight="300" font-size="66" fill="#F1F1EC" letter-spacing="-1.5">sua proposta está pronta.</text>
  <text x="84" y="500" font-family="LT Wave" font-weight="300" font-size="28" fill="#B9BAB2">${esc(title)}</text>
  <text x="84" y="540" font-family="LT Wave" font-weight="300" font-size="24" fill="#8A8B84">Escolha a condição e aprove online.</text>
  <rect x="820" y="470" width="300" height="80" rx="40" fill="url(#b)"/>
  <text x="950" y="520" text-anchor="middle" font-family="LT Wave" font-weight="500" font-size="26" fill="#0A0A0B">Abrir proposta</text>
  <path d="M1052 510h26M1068 500l10 10-10 10" stroke="#0A0A0B" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const slug = String(context.params.slug || "").toLowerCase();
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return new Response("Não encontrado", { status: 404 });
  const para = url.searchParams.get("para");
  const i = await info(slug, para);
  if (!i) return new Response(JSON.stringify({ error: "Não encontrado" }), { status: 404, headers: { "content-type": "application/json" } });
  if (url.pathname.endsWith("/image")) {
    const png = new Resvg(svg(i.name, i.title), { font: { fontFiles: fontFiles(), loadSystemFonts: false, defaultFontFamily: "LT Wave" }, fitTo: { mode: "width", value: 1200 } }).render().asPng();
    return new Response(png, { headers: { "content-type": "image/png", "cache-control": "public, max-age=600, s-maxage=3600" } });
  }
  const q = para ? `?para=${encodeURIComponent(para)}` : "";
  return new Response(JSON.stringify({
    title: `${i.name}, sua proposta está pronta · Gustavo Elian`,
    description: `${i.title}. Escopo, prazo e investimento. Escolha a condição e aprove online.`,
    image: `${url.origin}/api/og/${slug}/image${q}`,
  }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } });
};

export const config: Config = { path: ["/api/og/:slug", "/api/og/:slug/image"] };
