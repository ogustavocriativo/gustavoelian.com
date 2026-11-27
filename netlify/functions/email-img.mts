// Título dos e-mails na tipografia oficial (LT Wave), desenhado como imagem: a maioria dos leitores de e-mail
// (Gmail, Outlook) não carrega fontes da web, então o título vira PNG e o texto vai no alt.
//   GET /api/email/titulo?t=Código%20de%20confirmação
import type { Config } from "@netlify/functions";
import { Resvg } from "@resvg/resvg-js";

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

export default async (req: Request) => {
  const t = String(new URL(req.url).searchParams.get("t") || "").trim().slice(0, 80);
  if (!t) return new Response("", { status: 400 });
  const lines = wrap(t);
  const h = lines.length * LH + 10;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">` +
    lines.map((l, i) => `<text x="0" y="${SIZE + i * LH}" font-family="LT Wave" font-weight="300" font-size="${SIZE}" letter-spacing="-0.8" fill="#0E0E10">${esc(l)}</text>`).join("") + `</svg>`;
  const png = new Resvg(svg, { font: { loadSystemFonts: false, defaultFontFamily: "LT Wave" }, fitTo: { mode: "width", value: W * 2 } }).render().asPng();
  return new Response(png, { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" } });
};

export const config: Config = { path: "/api/email/titulo" };
