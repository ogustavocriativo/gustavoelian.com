// Textos de destaque dos e-mails desenhados na LT Wave como imagem (o Gmail e o Outlook do celular não carregam fontes da web).
// A medição usa a própria fonte, então o e-mail já sabe a largura/altura de cada imagem e onde quebrar as linhas;
// o endpoint /api/email/txt desenha exatamente as mesmas linhas. O texto vai sempre no "alt" (aparece se as imagens forem bloqueadas).
import fontkit from "@pdf-lib/fontkit";
import { LTWaveLight, LTWaveMedium } from "./assets.mts";

export const EMAIL_ORIGIN = "https://gustavoelian.com";
type Weight = "light" | "med";
export type Kind = "titulo" | "rotulo" | "destaque" | "botao" | "codigo" | "valor";
// tamanho (px de tela), peso, entrelinha, cor, espaçamento entre letras (px), largura máxima, maiúsculas
// dot: bolinha azul antes do texto; arrow: seta depois (desenhadas como forma: a LT Wave não tem esses caracteres)
export const DOT_W = 16, ARROW_W = 24;
export const KINDS: Record<Kind, { size: number; weight: Weight; lh: number; color: string; track: number; max: number; upper?: boolean; dot?: string; arrow?: string }> = {
  titulo: { size: 34, weight: "light", lh: 39, color: "#0E0E10", track: -0.68, max: 512 },
  rotulo: { size: 12, weight: "med", lh: 16, color: "#55575E", track: 1.92, max: 512, upper: true, dot: "#6699FF" },
  destaque: { size: 17, weight: "med", lh: 22, color: "#0E0E10", track: 0, max: 440, arrow: "#2F5FD0" },
  botao: { size: 16, weight: "med", lh: 20, color: "#FFFFFF", track: 0, max: 440 },
  codigo: { size: 40, weight: "med", lh: 46, color: "#0E0E10", track: 12.8, max: 440 },
  valor: { size: 40, weight: "light", lh: 46, color: "#0E0E10", track: -0.8, max: 512 },
};

const cache: Partial<Record<Weight, any>> = {};
function font(w: Weight) {
  return (cache[w] ||= fontkit.create(Uint8Array.from(atob(w === "light" ? LTWaveLight : LTWaveMedium), (c) => c.charCodeAt(0))));
}
export function measure(text: string, w: Weight, size: number, track = 0) {
  if (!text) return 0;
  const f = font(w);
  const run = f.layout(text);
  return (run.advanceWidth / f.unitsPerEm) * size + track * Math.max(0, [...text].length - 1);
}
export function prep(kind: Kind, text: string) {
  const k = KINDS[kind];
  const s = String(text || "").replace(/\s+/g, " ").trim().slice(0, 160);
  return k.upper ? s.toLocaleUpperCase("pt-BR") : s;
}
/** Quebra em linhas que cabem na largura máxima (no máx. 4). */
export function wrapLines(kind: Kind, text: string) {
  const k = KINDS[kind], t = prep(kind, text);
  const extra = (k.dot ? DOT_W : 0) + (k.arrow ? ARROW_W : 0);
  const lines: string[] = []; let cur = "";
  for (const w of t.split(" ")) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && measure(test, k.weight, k.size, k.track) + extra > k.max) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}
/** Tamanho da imagem (px de tela) para as linhas dadas. */
export function boxOf(kind: Kind, lines: string[]) {
  const k = KINDS[kind];
  const pre = k.dot ? DOT_W : 0;
  const post = k.arrow ? ARROW_W : 0;
  const w = Math.ceil(Math.max(...lines.map((l, i) => measure(l, k.weight, k.size, k.track) + (i === 0 ? pre : 0) + (i === lines.length - 1 ? post : 0)), 1) + 4);
  const h = Math.ceil(lines.length * k.lh + Math.max(4, k.size * 0.28));
  return { w: Math.min(w, k.max + 8), h };
}
/** <img> do texto, pronto para o corpo do e-mail. */
export function textImg(kind: Kind, text: string, style = "") {
  const lines = wrapLines(kind, text);
  if (!lines.length) return "";
  const { w, h } = boxOf(kind, lines);
  const alt = String(text || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const src = `${EMAIL_ORIGIN}/api/email/txt?v=2&k=${kind}&t=${encodeURIComponent(lines.join("\n"))}`;
  return `<img src="${src}" width="${w}" height="${h}" alt="${alt}" style="display:block;border:0;outline:none;width:${w}px;max-width:100%;height:auto;${style}">`;
}
