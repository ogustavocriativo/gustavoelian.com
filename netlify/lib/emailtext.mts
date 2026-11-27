// Todo o conteúdo dos e-mails desenhado na LT Wave como imagem (o Gmail e o Outlook do celular não carregam fontes da web);
// só o rodapé (nome, CNPJ e links) fica em texto. A medição usa a própria fonte, então o e-mail já sabe a largura/altura de
// cada imagem e onde quebrar as linhas; o endpoint /api/email/txt desenha exatamente as mesmas linhas.
// O texto vai sempre no "alt" (aparece se o leitor bloquear imagens).
// Texto rico (corpo, nota, sub): **negrito** e quebra de linha com "\n".
import fontkit from "@pdf-lib/fontkit";
import { LTWaveLight, LTWaveMedium, LTWaveRegular } from "./assets.mts";

export const EMAIL_ORIGIN = "https://gustavoelian.com";
export type Weight = "light" | "reg" | "med";
export type Kind = "titulo" | "rotulo" | "destaque" | "botao" | "codigo" | "valor" | "corpo" | "nota" | "sub";
type K = { size: number; weight: Weight; lh: number; color: string; track: number; max: number; upper?: boolean; dot?: string; arrow?: string; rich?: boolean; bold?: string; lines?: number };
// dot: bolinha azul antes do texto; arrow: seta depois (desenhadas como forma: a LT Wave não tem a seta)
export const DOT_W = 16, ARROW_W = 24;
// a coluna de texto tem 400 px: no celular a imagem encolhe para a largura da tela e o texto fica em ~14 px
export const KINDS: Record<Kind, K> = {
  titulo: { size: 34, weight: "light", lh: 39, color: "#0E0E10", track: -0.68, max: 512 },
  rotulo: { size: 12, weight: "med", lh: 16, color: "#55575E", track: 1.92, max: 512, upper: true, dot: "#6699FF" },
  destaque: { size: 17, weight: "med", lh: 22, color: "#0E0E10", track: 0, max: 400, arrow: "#2F5FD0" },
  botao: { size: 16, weight: "med", lh: 20, color: "#FFFFFF", track: 0, max: 400 },
  codigo: { size: 40, weight: "med", lh: 46, color: "#0E0E10", track: 12.8, max: 400 },
  valor: { size: 40, weight: "light", lh: 46, color: "#0E0E10", track: -0.8, max: 512 },
  corpo: { size: 18, weight: "reg", lh: 28, color: "#2E2F33", track: 0, max: 400, rich: true, bold: "#0E0E10", lines: 60 },
  nota: { size: 16, weight: "reg", lh: 25, color: "#2E2F33", track: 0, max: 356, rich: true, bold: "#0E0E10", lines: 40 },
  sub: { size: 14.5, weight: "reg", lh: 21, color: "#55575E", track: 0, max: 400, rich: true, bold: "#0E0E10", lines: 6 },
};

const B64: Record<Weight, string> = { light: LTWaveLight, reg: LTWaveRegular, med: LTWaveMedium };
const cache: Partial<Record<Weight, any>> = {};
const font = (w: Weight) => (cache[w] ||= fontkit.create(Uint8Array.from(atob(B64[w]), (c) => c.charCodeAt(0))));
export function measure(text: string, w: Weight, size: number, track = 0) {
  if (!text) return 0;
  const f = font(w);
  return (f.layout(text).advanceWidth / f.unitsPerEm) * size + track * Math.max(0, [...text].length - 1);
}

export type Run = { t: string; b: boolean };
/** Uma linha codificada ("**" alterna negrito) → trechos. */
export function runsOf(line: string): Run[] {
  return line.split("**").map((t, i) => ({ t, b: i % 2 === 1 })).filter((r) => r.t);
}
const encode = (runs: Run[]) => runs.map((r) => (r.b ? `**${r.t}**` : r.t)).join("");
const runW = (k: K, r: Run) => measure(r.t, r.b ? "med" : k.weight, k.size, k.track);
export const lineW = (k: K, line: string) => runsOf(line).reduce((t, r) => t + runW(k, r), 0);

export function prep(kind: Kind, text: string) {
  const k = KINDS[kind];
  if (k.rich) return String(text || "").replace(/[ \t\r\f\v]+/g, " ").replace(/ *\n */g, "\n").trim().slice(0, 4000);
  const s = String(text || "").replace(/\s+/g, " ").trim().slice(0, 160);
  return k.upper ? s.toLocaleUpperCase("pt-BR") : s;
}

/** Quebra em linhas que cabem na largura (texto rico: palavras com o seu peso, negrito preservado em cada linha). */
export function wrapLines(kind: Kind, text: string) {
  const k = KINDS[kind], t = prep(kind, text);
  if (!k.rich) {
    const extra = (k.dot ? DOT_W : 0) + (k.arrow ? ARROW_W : 0);
    const lines: string[] = []; let cur = "";
    for (const w of t.split(" ")) {
      const test = cur ? `${cur} ${w}` : w;
      if (cur && measure(test, k.weight, k.size, k.track) + extra > k.max) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 4);
  }
  const out: string[] = [];
  for (const para of t.split("\n")) {
    // palavras com o estilo de cada uma
    const words: Run[] = [];
    runsOf(para).forEach((r) => r.t.split(/(\s+)/).forEach((p) => { if (p.trim()) words.push({ t: p, b: r.b }); else if (p && words.length) words[words.length - 1].t += " "; }));
    let cur: Run[] = [], w = 0;
    const flush = () => { if (cur.length) { cur[cur.length - 1].t = cur[cur.length - 1].t.trimEnd(); out.push(encode(merge(cur))); } cur = []; w = 0; };
    for (const wd of words) {
      const ww = runW(k, { t: wd.t.trimEnd(), b: wd.b });
      if (cur.length && w + ww > k.max) flush();
      cur.push({ ...wd }); w += runW(k, wd);
    }
    flush();
    if (!words.length) out.push("");
  }
  return out.slice(0, k.lines || 40);
}
function merge(rs: Run[]) {
  const o: Run[] = [];
  for (const r of rs) { const l = o[o.length - 1]; if (l && l.b === r.b) l.t += r.t; else o.push({ ...r }); }
  return o;
}

/** Tamanho da imagem (px de tela) para as linhas dadas. */
export function boxOf(kind: Kind, lines: string[]) {
  const k = KINDS[kind];
  const pre = k.dot ? DOT_W : 0, post = k.arrow ? ARROW_W : 0;
  const widths = lines.map((l, i) => (k.rich ? lineW(k, l) : measure(l, k.weight, k.size, k.track)) + (i === 0 ? pre : 0) + (i === lines.length - 1 ? post : 0));
  const w = k.rich ? k.max + 4 : Math.ceil(Math.max(...widths, 1) + 4);
  const h = Math.ceil(lines.length * k.lh + Math.max(4, k.size * 0.28));
  return { w: Math.min(w, k.max + 8), h };
}

const escAttr = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
/** <img> do texto, pronto para o e-mail. */
export function textImg(kind: Kind, text: string, style = "") {
  const lines = wrapLines(kind, text);
  if (!lines.some(Boolean)) return "";
  const { w, h } = boxOf(kind, lines);
  const alt = escAttr(String(text || "").replace(/\*\*/g, "").replace(/\s*\n\s*/g, " "));
  const src = `${EMAIL_ORIGIN}/api/email/txt?v=3&k=${kind}&t=${encodeURIComponent(lines.join("\n"))}`;
  return `<img src="${src}" width="${w}" height="${h}" alt="${alt}" style="display:block;border:0;outline:none;width:${w}px;max-width:100%;height:auto;${style}">`;
}

/** HTML simples do corpo (<p>, <b>, <br>, <ul><li>) → texto rico para textImg. */
export function richFromHtml(html: string) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(b|strong)[^>]*>/gi, "**")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\*\*\s*\*\*/g, " ");
}
