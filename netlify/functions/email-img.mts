// Título dos e-mails na tipografia oficial (LT Wave), desenhado como imagem: a maioria dos leitores de e-mail
// (Gmail, Outlook) não carrega fontes da web, então o título vira PNG e o texto vai no alt.
//   GET /api/email/titulo?t=Código%20de%20confirmação
import type { Config } from "@netlify/functions";
import { Resvg } from "@resvg/resvg-js";
import { ARROW_W, DOT_W, KINDS, boxOf, measure, prep, type Kind } from "../lib/emailtext.mts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const SIZE = 40, LH = 46, W = 504, MAXCH = 26; // em px de tela; a imagem sai em 2x

function wrap(t: string) {
  const lines: string[] = []; let cur = "";
  for (const w of t.split(/\s+/)) {
    const test = cur ? cur + " " + w : w;
    if (test.length > MAXCH && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

/* Texto de destaque (título, rótulo, botão, valor…) já quebrado em linhas pelo e-mail: /api/email/txt?k=titulo&t=linha1%0Alinha2 */
function textPng(kind: Kind, raw: string) {
  const k = KINDS[kind];
  const lines = raw.split("\n").map((l) => prep(kind, l)).filter(Boolean).slice(0, 4);
  if (!lines.length) return null;
  const { w, h } = boxOf(kind, lines);
  const wt = k.weight === "light" ? 300 : 500;
  const base = (i: number) => k.size + i * k.lh - (k.lh - k.size) * 0.2;
  const cap = k.size * 0.7; // altura das maiúsculas, para centralizar bolinha e seta
  const parts: string[] = [];
  lines.forEach((l, i) => {
    const x0 = i === 0 && k.dot ? DOT_W : 0;
    if (i === 0 && k.dot) parts.push(`<circle cx="4" cy="${base(0) - cap / 2}" r="3.5" fill="${k.dot}"/>`);
    parts.push(`<text x="${x0}" y="${base(i)}" font-family="LT Wave" font-weight="${wt}" font-size="${k.size}" letter-spacing="${k.track}" fill="${k.color}">${esc(l)}</text>`);
    if (i === lines.length - 1 && k.arrow) {
      const ax = x0 + measure(l, k.weight, k.size, k.track) + 9, ay = base(i) - cap / 2;
      parts.push(`<path d="M${ax} ${ay}h11M${ax + 6.5} ${ay - 4.5}l4.5 4.5-4.5 4.5" fill="none" stroke="${k.arrow}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join("")}</svg>`;
  return new Resvg(svg, { font: { loadSystemFonts: false, defaultFontFamily: "LT Wave" }, fitTo: { mode: "width", value: w * 2 } }).render().asPng();
}

export default async (req: Request) => {
  const u = new URL(req.url);
  if (u.pathname.endsWith("/txt")) {
    const kind = u.searchParams.get("k") as Kind;
    if (!KINDS[kind]) return new Response("", { status: 400 });
    const png = textPng(kind, String(u.searchParams.get("t") || "").slice(0, 400));
    if (!png) return new Response("", { status: 400 });
    return new Response(png, { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
  }
  const t = String(new URL(req.url).searchParams.get("t") || "").trim().slice(0, 80);
  if (!t) return new Response("", { status: 400 });
  const lines = wrap(t);
  const h = lines.length * LH + 10;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">` +
    lines.map((l, i) => `<text x="0" y="${SIZE + i * LH}" font-family="LT Wave" font-weight="300" font-size="${SIZE}" letter-spacing="-0.8" fill="#0E0E10">${esc(l)}</text>`).join("") + `</svg>`;
  const png = new Resvg(svg, { font: { loadSystemFonts: false, defaultFontFamily: "LT Wave" }, fitTo: { mode: "width", value: W * 2 } }).render().asPng();
  return new Response(png, { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
};

export const config: Config = { path: ["/api/email/titulo", "/api/email/txt"] };
