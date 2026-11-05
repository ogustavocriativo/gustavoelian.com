// Cartão de prévia de link (1200×630) com a logo do cliente. Usado nas prévias e nas propostas.
import { Resvg } from "@resvg/resvg-js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { LOGO_LIGHT } from "./og-logo.mts";

export const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function fontFiles() {
  const here = (() => { try { return path.dirname(fileURLToPath(import.meta.url)); } catch { return "."; } })(); // no Cloudflare as fontes vêm da memória
  const tries = [path.join(process.cwd(), "public/fonts"), path.join(here, "../../public/fonts"), path.join(here, "public/fonts")];
  const dir = tries.find((d) => fs.existsSync(path.join(d, "LTWave-Light.otf"))) || tries[0];
  return ["LTWave-Light.otf", "LTWave-Medium.otf"].map((f) => path.join(dir, f));
}

/** Detecta o tipo de imagem pelos primeiros bytes. */
export function sniff(b: Uint8Array): "png" | "jpeg" | "webp" | "" {
  if (b[0] === 0x89 && b[1] === 0x50) return "png";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return "webp";
  return "";
}
export const dataUri = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  return `data:image/${sniff(u) || "png"};base64,${Buffer.from(u).toString("base64")}`;
};

/** Quebra o texto em linhas de no máximo `n` caracteres. */
function wrap(s: string, n: number, max = 2) {
  const out: string[] = []; let cur = "";
  for (const w of String(s).split(/\s+/).filter(Boolean)) {
    if ((cur + " " + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/\s*\S*$/, "") + "…"; }
  return out;
}

export interface Card { kicker: string; headline: string; sub?: string; cta: string; logo?: ArrayBuffer | Uint8Array | null }

export function cardSvg(c: Card) {
  const hasLogo = !!c.logo;
  const textW = hasLogo ? 24 : 30; // caracteres por linha
  const head = wrap(c.headline, textW, 3);
  const size = head.length > 2 ? 54 : 62;
  const kick = esc(String(c.kicker).slice(0, 34));
  const y0 = 190;
  const lines = head.map((l, i) => `<text x="80" y="${y0 + 80 + i * (size + 10)}" font-family="LT Wave" font-weight="300" font-size="${size}" fill="#F1F1EC" letter-spacing="-1.5">${esc(l)}</text>`).join("");
  const subY = y0 + 80 + (head.length - 1) * (size + 10) + 52;
  const sub = c.sub ? wrap(c.sub, hasLogo ? 40 : 56, 1).map((l) => `<text x="82" y="${subY + 20}" font-family="LT Wave" font-weight="300" font-size="28" fill="#B9BAB2">${esc(l)}</text>`).join("") : "";
  const plate = hasLogo
    ? `<rect x="800" y="150" width="320" height="320" rx="40" fill="#FFFFFF"/>
  <image href="${dataUri(c.logo as Uint8Array)}" x="830" y="180" width="260" height="260" preserveAspectRatio="xMidYMid meet"/>` : "";
  const ctaX = 80, ctaW = 300;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#C5DD63" stop-opacity=".5"/><stop offset=".5" stop-color="#56631C" stop-opacity=".22"/><stop offset="1" stop-color="#0A0A0B" stop-opacity="0"/></radialGradient>
  <linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#9DB441"/><stop offset="1" stop-color="#D3EA77"/></linearGradient></defs>
  <rect width="1200" height="630" fill="#0A0A0B"/>
  <circle cx="${hasLogo ? 960 : 990}" cy="${hasLogo ? 310 : 210}" r="420" fill="url(#g)"/>
  ${plate}
  <image href="${LOGO_LIGHT}" x="80" y="68" width="240" height="44"/>
  <text x="80" y="${y0}" font-family="LT Wave" font-weight="500" font-size="34" fill="#D3EA77" letter-spacing="1">${kick}</text>
  ${lines}${sub}
  <rect x="${ctaX}" y="500" width="${ctaW}" height="80" rx="40" fill="url(#b)"/>
  <text x="${ctaX + 130}" y="550" text-anchor="middle" font-family="LT Wave" font-weight="500" font-size="26" fill="#0A0A0B">${esc(c.cta)}</text>
  <path d="M${ctaX + 242} 540h26M${ctaX + 258} 530l10 10-10 10" stroke="#0A0A0B" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

export function renderCard(c: Card) {
  return new Resvg(cardSvg(c), { font: { fontFiles: fontFiles(), loadSystemFonts: false, defaultFontFamily: "LT Wave" }, fitTo: { mode: "width", value: 1200 } }).render().asPng();
}

export const hash = (s: string) => { let x = 5381; for (const ch of s) x = ((x << 5) + x + ch.charCodeAt(0)) >>> 0; return x.toString(36); };

/** Mude ao alterar o desenho do cartão: invalida as imagens já guardadas. */
export const CARD_V = "3";
