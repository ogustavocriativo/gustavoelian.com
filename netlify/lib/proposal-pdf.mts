// PDF da proposta no formato vertical 9:16 (810 × 1440 pt), na ID atual de @gustavoelian.
// Estrutura estratégica: Capa → Apresentação → Serviços → Trabalhos que comprovam → Condições → Bônus → Próximos passos.
import { PDFDocument, PDFName, PDFString, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import * as A from "./assets.mts";
import { brl, priceOf } from "./core.mts";

const W = 810, H = 1440, M = 66; // 88 px de margem no grid de 8
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  ink: hex("#2E2F33"), ink2: hex("#3C3F43"), soft: hex("#5A5E63"), gray: hex("#8C9095"), silver: hex("#C9CBCE"),
  ice: hex("#E6F0FC"), white: hex("#F7F9FC"), accent: hex("#6699FF"), accentInk: hex("#2F5FD0"), slate: hex("#6B7F99"), card: hex("#FFFFFF"),
};
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type F = Record<"thin" | "light" | "reg" | "med" | "bold" | "hand", PDFFont>;

class P {
  doc!: PDFDocument; f!: F; img: Record<string, PDFImage> = {}; page!: PDFPage;
  static async create() {
    const p = new P(); p.doc = await PDFDocument.create(); p.doc.registerFontkit(fontkit);
    const b = (s: string) => Buffer.from(s, "base64");
    p.f = {
      thin: await p.doc.embedFont(b(A.LTWaveThin), { subset: true }), light: await p.doc.embedFont(b(A.LTWaveLight), { subset: true }),
      reg: await p.doc.embedFont(b(A.LTWaveRegular), { subset: true }), med: await p.doc.embedFont(b(A.LTWaveMedium), { subset: true }),
      bold: await p.doc.embedFont(b(A.LTWaveBold), { subset: true }), hand: await p.doc.embedFont(b(A.Alisiya), { subset: true }),
    };
    for (const k of ["dark2", "light1", "light2", "light3", "bg_cover", "bg_intro", "bg_contact"]) p.img[k] = await p.doc.embedJpg(b((A as any)["pdf_" + k]));
    return p;
  }
  add(bg: string) { this.page = this.doc.addPage([W, H]); this.page.drawImage(this.img[bg], { x: 0, y: 0, width: W, height: H }); return this.page; }
  // texto com quebra automática; retorna a altura usada (top = distância do topo)
  text(s: string, x: number, top: number, o: { size?: number; font?: keyof F; color?: RGB; w?: number; lh?: number; align?: "left" | "right" | "center" } = {}) {
    const font = this.f[o.font || "reg"], size = o.size || 16, lh = o.lh || size * 1.4, w = o.w || W - x - M;
    const lines = this.wrap(String(s ?? ""), font, size, w);
    lines.forEach((ln, i) => {
      const tw = font.widthOfTextAtSize(ln, size);
      const dx = o.align === "right" ? w - tw : o.align === "center" ? (w - tw) / 2 : 0;
      this.page.drawText(ln, { x: x + dx, y: H - top - size - i * lh + size * 0.12, size, font, color: o.color || C.ink });
    });
    return lines.length ? (lines.length - 1) * lh + size * 1.25 : 0;
  }
  measure(s: string, size: number, font: keyof F, w: number, lh?: number) {
    const n = this.wrap(String(s ?? ""), this.f[font], size, w).length; return n ? (n - 1) * (lh || size * 1.4) + size * 1.25 : 0;
  }
  wrap(text: string, font: PDFFont, size: number, width: number) {
    const out: string[] = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const t = line ? line + " " + word : word;
        if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out.filter((l, i) => l || i < out.length - 1);
  }
  spaced(s: string, x: number, top: number, size: number, color: RGB, track = size * 0.42, font: keyof F = "med") {
    let cx = x; const f = this.f[font];
    for (const ch of s.toUpperCase()) { this.page.drawText(ch, { x: cx, y: H - top - size, size, font: f, color }); cx += f.widthOfTextAtSize(ch, size) + track; }
    return cx - x - track;
  }
  rrect(x: number, top: number, w: number, h: number, r: number, o: { fill?: RGB; border?: RGB; bw?: number; opacity?: number; bo?: number }) {
    const p = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    this.page.drawSvgPath(p, { x, y: H - top, color: o.fill, borderColor: o.border, borderWidth: o.border ? o.bw || 1 : 0 });
  }
  shadow(_x: number, _top: number, _w: number, _h: number, _r: number) { /* sombras removidas: o PDF não usa transparência */ }
  link(x: number, top: number, w: number, h: number, url: string) {
    const annot = this.doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, H - top - h, x + w, H - top], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) } });
    const ref = this.doc.context.register(annot);
    const ann = this.page.node.lookup(PDFName.of("Annots")) as any;
    if (ann) ann.push(ref); else this.page.node.set(PDFName.of("Annots"), this.doc.context.obj([ref]));
  }
  pageNo(n: number, dark: boolean) {
    const s = String(n).padStart(2, "0");
    this.page.drawText(s, { x: W - M - this.f.med.widthOfTextAtSize(s, 12), y: 44, size: 12, font: this.f.med, color: dark ? C.silver : C.gray });
  }
}

export async function buildProposalPdf(q: any, s: any, st: any, origin: string, projects: any[]) {
  const p = await P.create();
  const link = `${origin}/${q.slug}`;
  const d = new Date((q.date || new Date().toISOString().slice(0, 10)) + "T12:00:00");
  const monthYear = `${MONTHS[d.getMonth()]} · ${d.getFullYear()}`;
  const name = (q.client?.name || "Cliente").trim();
  const parts = name.split(/\s+/);
  const firstLine = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  const lastLine = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const items = q.items || [];
  const pkgs = q.packages || [];
  const sumAll = items.reduce((t: number, i: any) => t + Number(i.price || 0), 0);
  const minPrice = Math.min(sumAll || Infinity, ...pkgs.map((k: any) => Number(k.cash) || Infinity), ...items.map((i: any) => Number(i.price) || Infinity));
  const entryPct = Number(s.payments?.entryPct ?? 60);
  const sel = st?.selection;
  const sections = ["Serviços orçados", projects.length ? "Trabalhos que comprovam a entrega" : "", "Condições e pacotes", (q.bonuses || []).length ? "Bônus inclusos" : "", "Próximos passos"].filter(Boolean);
  let pageN = 0;

  /* 1 · CAPA */
  p.add("bg_cover"); pageN++;
  p.spaced(`Proposta · ${monthYear}`, M, 66, 12, C.silver);
  const nameW = W - 2 * M;
  let ns = 92; while (ns > 48 && Math.max(p.f.thin.widthOfTextAtSize(firstLine, ns), p.f.bold.widthOfTextAtSize(lastLine, ns)) > nameW) ns -= 4;
  let top = 860;
  if (firstLine) top += p.text(firstLine, M, top, { size: ns, font: "thin", color: C.white, lh: ns * 1.02 }) - ns * 0.2;
  top += p.text(lastLine, M, top, { size: ns, font: "bold", color: C.white, lh: ns * 1.02 }) + 22;
  p.spaced("Orçamento", M, top, 15, C.accent); top += 40;
  p.page.drawLine({ start: { x: M, y: H - top }, end: { x: M + 48, y: H - top }, thickness: 1.2, color: C.silver }); top += 24;
  if (q.title) p.text(q.title, M, top, { size: 19, font: "light", color: C.silver, w: 470, lh: 27 });
  p.text("com pitadas de historiografia e pesquisa", M, H - 176, { size: 30, font: "hand", color: C.slate });
  p.link(M, H - 118, 170, 32, `https://${s.issuer.site}`); // logo da capa clicável

  /* 2 · APRESENTAÇÃO */
  p.add("bg_intro"); pageN++;
  p.spaced("Apresentação", M, 66, 12, C.accentInk);
  top = 210;
  top += p.text(`Olá, ${parts[0]}.`, M, top, { size: 57, font: "bold", lh: 60 }) + 28;
  const intro = q.intro || `Esta proposta reúne as soluções pensadas para ${q.client?.company || name}: ${items.map((i: any) => i.title.toLowerCase()).join(", ")}.`;
  top += p.text(intro, M, top, { size: 21, font: "light", color: C.soft, w: 600, lh: 31 }) + 52;
  p.spaced("Nesta proposta", M, top, 12, C.gray); top += 30;
  sections.forEach((sec, i) => {
    p.rrect(M, top, W - 2 * M, 40, 10, { fill: C.ink });
    p.text(`${String(i + 1).padStart(2, "0")}`, M + 18, top + 12, { size: 13, font: "med", color: C.accent });
    p.text(sec, M + 58, top + 12, { size: 14.5, font: "reg", color: C.white });
    top += 48;
  });
  top += 36;
  const facts: [string, string][] = [
    ["Investimento a partir de", brl(isFinite(minPrice) ? minPrice : 0)],
    ["Serviços", `${items.length} ${items.length > 1 ? "entregas" : "entrega"}`],
    ["Validade", `${q.validDays || 15} dias`],
  ];
  const fw = (W - 2 * M - 2 * 14) / 3;
  facts.forEach(([k, v], i) => {
    const x = M + i * (fw + 14);
    p.rrect(x, top, fw, 104, 18, { fill: C.card, border: hex("#D5DCE6") });
    p.text(k, x + 18, top + 20, { size: 12.5, font: "med", color: C.gray, w: fw - 36 });
    p.text(v, x + 18, top + 54, { size: 22, font: "bold", w: fw - 36 });
  });
  p.text("Vamos conhecer cada serviço?", M, H - 210, { size: 14, font: "med", color: C.soft });
  p.spaced("Siga para a próxima página", M, H - 182, 10, C.gray, 4);
  p.text(firstLine || lastLine, M, H - 140, { size: 30, font: firstLine ? "thin" : "bold", lh: 30 });
  if (firstLine) p.text(lastLine, M + p.f.thin.widthOfTextAtSize(firstLine + " ", 30), H - 140, { size: 30, font: "bold" });
  p.link(W - M - 130, H - 102, 130, 24, `https://${s.issuer.site}`); // logo clicável
  p.pageNo(pageN, false);

  /* 3 · SERVIÇOS (pagina automaticamente) */
  const cardW = W - 2 * M, pad = 28, innerW = cardW - 2 * pad;
  const cardH = (it: any) => {
    let h = pad + 14 + 18 + p.measure(`| ${it.title}`, 21, "med", innerW, 27) + 10;
    if (it.description) h += p.measure(it.description, 15, "light", innerW, 22) + 10;
    if (it.deliverables?.length) h += 22 + it.deliverables.reduce((t: number, dl: string) => t + p.measure("•  " + dl, 15, "reg", innerW - 10, 21) + 4, 0);
    return h + 24 + 1 + 20 + 28 + pad;
  };
  let idx = 0;
  while (idx < items.length || idx === 0) {
    p.add(idx === 0 ? "light2" : "light3"); pageN++;
    p.spaced(idx === 0 ? "Serviços" : "Serviços · continuação", M, 66, 12, C.accentInk);
    top = 150;
    if (idx === 0) {
      top += p.text("Serviços orçados", M, top, { size: 52, font: "bold" }) + 16;
      top += p.text(pkgs.length ? "Valores individuais de cada entrega. Em Condições, você encontra os pacotes com preço reduzido." : "Valores e prazos de cada entrega.", M, top, { size: 18, font: "light", color: C.soft, w: 600, lh: 26 }) + 34;
    }
    const limit = H - 120;
    let placed = 0;
    while (idx < items.length) {
      const it = items[idx], h = cardH(it);
      if (placed > 0 && top + h > limit) break;
      p.shadow(M, top, cardW, h, 22);
      p.rrect(M, top, cardW, h, 22, { fill: C.ink });
      let y = top + pad;
      p.spaced(String(idx + 1).padStart(2, "0"), M + pad, y, 11, C.gray, 4); y += 32;
      y += p.text(`| ${it.title}`, M + pad, y, { size: 21, font: "med", color: C.white, w: innerW, lh: 27 }) + 10;
      if (it.description) y += p.text(it.description, M + pad, y, { size: 15, font: "light", color: C.silver, w: innerW, lh: 22 }) + 10;
      if (it.deliverables?.length) {
        y += p.text("Entregáveis", M + pad, y, { size: 12.5, font: "med", color: C.gray }) + 8;
        for (const dl of it.deliverables) y += p.text("•  " + dl, M + pad + 4, y, { size: 15, font: "reg", color: C.white, w: innerW - 10, lh: 21 }) + 4;
      }
      y += 18;
      p.page.drawLine({ start: { x: M + pad, y: H - y }, end: { x: M + cardW - pad, y: H - y }, thickness: 0.6, color: C.soft }); y += 20;
      p.text(brl(it.price), M + pad, y, { size: 24, font: "bold", color: C.white });
      if (it.deadline) {
        const t = `Prazo de entrega: ${it.deadline}`;
        p.text(t, M + pad, y + 6, { size: 13, font: "reg", color: C.silver, w: innerW, align: "right" });
      }
      top += h + 18; idx++; placed++;
    }
    if (idx >= items.length) {
      p.text(`Soma dos serviços avulsos: ${brl(sumAll)}`, M, Math.min(top + 6, H - 112), { size: 15, font: "med", color: C.soft });
    }
    p.pageNo(pageN, false);
    if (items.length === 0) break;
  }

  /* 4 · TRABALHOS QUE COMPROVAM A ENTREGA */
  if (projects.length) {
    p.add("light1"); pageN++;
    p.spaced("Portfólio", M, 66, 12, C.accentInk);
    top = 150;
    top += p.text("Trabalhos que comprovam a entrega", M, top, { size: 46, font: "bold", w: 600, lh: 50 }) + 16;
    top += p.text("Projetos próximos ao que vamos construir juntos. Toque em cada um para ver no ar.", M, top, { size: 18, font: "light", color: C.soft, w: 600, lh: 26 }) + 34;
    const list = projects.slice(0, 4), gw = (W - 2 * M - 18) / 2, imgH = (gw - 24) * 0.625 + 12, ch = imgH + 210;
    for (let i = 0; i < list.length; i++) {
      const pr = list[i], x = M + (i % 2) * (gw + 18), y0 = top + Math.floor(i / 2) * (ch + 18);
      p.shadow(x, y0, gw, ch, 20);
      p.rrect(x, y0, gw, ch, 20, { fill: C.card });
      let im: PDFImage | null = null;
      try { if (pr._bytes) im = pr._type === "png" ? await p.doc.embedPng(pr._bytes) : await p.doc.embedJpg(pr._bytes); } catch { im = null; }
      if (im) {
        // recorta a imagem em 16:10 a partir do topo
        const bw = gw - 24, bh = imgH - 12, ratio = im.width / im.height, boxR = bw / bh;
        const dw = ratio > boxR ? bh * ratio : bw, dh = ratio > boxR ? bh : bw / ratio;
        p.page.drawRectangle({ x: x + 12, y: H - y0 - 12 - bh, width: bw, height: bh, color: C.ice });
        p.page.drawImage(im, { x: x + 12 - (dw - bw) / 2, y: H - y0 - 12 - dh, width: dw, height: dh });
      }
      else p.rrect(x + 12, y0 + 12, gw - 24, imgH - 12, 12, { fill: C.ice });
      let y = y0 + imgH + 16;
      p.spaced(pr.kind || "", x + 20, y, 9.5, C.accentInk, 3); y += 24;
      y += p.text(pr.title, x + 20, y, { size: 19, font: "bold", w: gw - 40, lh: 23 }) + 8;
      const sm = p.wrap(pr.summary || "", p.f.light, 13, gw - 40).slice(0, 3);
      p.text(sm.join(" ") + (p.wrap(pr.summary || "", p.f.light, 13, gw - 40).length > 3 ? "…" : ""), x + 20, y, { size: 13, font: "light", color: C.soft, w: gw - 40, lh: 18.5 });
      if (pr.url) {
        const u = pr.url.replace(/^https?:\/\//, "");
        p.text(u, x + 20, y0 + ch - 34, { size: 11.5, font: "med", color: C.accentInk, w: gw - 40 });
        p.link(x, y0, gw, ch, pr.url);
      }
    }
    p.text("Portfólio completo: " + s.issuer.site, M, H - 112, { size: 14, font: "med", color: C.soft });
    p.link(M, H - 112, 300, 20, `https://${s.issuer.site}`);
    p.pageNo(pageN, false);
  }

  /* 5 · CONDIÇÕES */
  p.add("dark2"); pageN++;
  p.spaced("Condições", M, 66, 12, C.accent);
  top = 150;
  top += p.text("Condições", M, top, { size: 52, font: "bold", color: C.white }) + 16;
  top += p.text(pkgs.length ? "Ao fechar os serviços em conjunto, o investimento total é reduzido." : "Formas de pagamento para os serviços desta proposta.", M, top, { size: 18, font: "light", color: C.silver, w: 600, lh: 26 }) + 34;
  const avulso = { k: { name: "Serviços avulsos", itemIds: items.map((i: any) => i.id), avulso: true }, pr: priceOf(q, {}) };
  // pacotes primeiro (destaque no topo); os avulsos entram como âncora de comparação quando há espaço
  const blocks = pkgs.length ? [...pkgs.slice(0, 3).map((k: any) => ({ k, pr: priceOf(q, { packageId: k.id }) })).sort((a: any, b: any) => (b.k.highlight ? 1 : 0) - (a.k.highlight ? 1 : 0)), ...(pkgs.length < 3 ? [avulso] : [])] : [avulso];
  const avail = H - 140 - top - (q.notes ? 150 : 0);
  const bh = Math.min(300, (avail - (blocks.length - 1) * 22) / blocks.length);
  for (const { k, pr } of blocks) {
    const hl = !!k.highlight, fg = hl ? C.ink : C.white, sub = hl ? C.soft : C.silver;
    if (hl) { p.shadow(M, top, cardW, bh, 22); p.rrect(M, top, cardW, bh, 22, { fill: hex("#E9EEF5") }); }
    else p.rrect(M, top, cardW, bh, 22, { fill: hex("#34363B"), border: hex("#5B5E63"), bw: 0.8 });
    if (hl) {
      const tag = `${k.tag || "Maior economia"}${pr.full > pr.cash ? " · " + brl(pr.full - pr.cash) : ""}`.toUpperCase();
      const tw = p.f.med.widthOfTextAtSize(tag, 10) + tag.length * 1.6 + 28;
      p.rrect(M + cardW - tw - 24, top - 13, tw, 26, 13, { fill: C.ink });
      p.spaced(tag, M + cardW - tw - 10, top - 5, 10, C.white, 1.6);
    }
    let y = top + 26;
    y += p.text(`| ${k.name}`, M + pad, y, { size: 20, font: "med", color: fg, w: innerW }) + 6;
    const nums = items.map((i: any, n: number) => (k.itemIds || []).includes(i.id) ? String(n + 1).padStart(2, "0") : null).filter(Boolean);
    p.text(`Serviços ${nums.join(", ").replace(/, ([^,]*)$/, " e $1")}`, M + pad, y, { size: 13, font: "reg", color: sub }); y += 22;
    if (pr.full > pr.cash) {
      const t = `De ${brl(pr.full)}`; p.text(t, M + pad, y, { size: 13, font: "reg", color: sub });
      const tw2 = p.f.reg.widthOfTextAtSize(t, 13); p.page.drawLine({ start: { x: M + pad, y: H - y - 8 }, end: { x: M + pad + tw2, y: H - y - 8 }, thickness: 0.8, color: sub });
    }
    y += 34;
    const colW = (innerW - 24) / 2, cx2 = M + pad + colW + 24;
    p.spaced("À vista", M + pad, y, 10, sub, 3); p.spaced("A prazo", cx2, y, 10, sub, 3); y += 20;
    p.text(brl(pr.cash), M + pad, y, { size: 32, font: "bold", color: fg }); p.text(brl(pr.card), cx2, y, { size: 32, font: "bold", color: fg }); y += 46;
    const entry = (pr.cash * entryPct) / 100;
    p.text(`Entrada de ${entryPct}% (${brl(entry)}) + ${100 - entryPct}% (${brl(pr.cash - entry)}) na entrega final e aprovação`, M + pad, y, { size: 12.5, font: "reg", color: sub, w: colW, lh: 17 });
    p.text(`Em até ${pr.installments}x de ${brl(pr.card / pr.installments)} no cartão de crédito`, cx2, y, { size: 12.5, font: "reg", color: sub, w: colW, lh: 17 });
    if (sel && ((sel.packageId && sel.packageId === k.id) || (!sel.packageId && k.avulso)) && st?.approvedAt) {
      p.spaced("Condição aprovada", M + pad, top + bh - 30, 10, hl ? C.accentInk : C.accent, 3);
    }
    top += bh + 22;
  }
  if (q.notes) {
    p.rrect(M, top, cardW, 128, 22, { border: hex("#5B5E63"), bw: 0.8, fill: hex("#303236") });
    p.text("| Observações", M + pad, top + 24, { size: 17, font: "med", color: C.white });
    const nl = p.wrap(q.notes, p.f.light, 14, innerW).slice(0, 3);
    p.text(nl.join("\n"), M + pad, top + 56, { size: 14, font: "light", color: C.silver, w: innerW, lh: 20 });
  }
  p.text("*Valores válidos durante o prazo desta proposta.", M, H - 104, { size: 12, font: "light", color: C.gray });
  p.pageNo(pageN, true);

  /* 6 · BÔNUS */
  if ((q.bonuses || []).length) {
    p.add("light3"); pageN++;
    p.spaced("Bônus", M, 66, 12, C.accentInk);
    top = 150;
    top += p.text("Bônus", M, top, { size: 52, font: "bold" }) + 16;
    top += p.text("Incluídos automaticamente ao fechar, sem custo adicional.", M, top, { size: 18, font: "light", color: C.soft, w: 600, lh: 26 }) + 34;
    const list = q.bonuses.slice(0, 6), gw = (W - 2 * M - 18) / 2, bh2 = 210;
    list.forEach((b: any, i: number) => {
      const x = M + (i % 2) * (gw + 18), y0 = top + Math.floor(i / 2) * (bh2 + 18);
      p.shadow(x, y0, gw, bh2, 22); p.rrect(x, y0, gw, bh2, 22, { fill: C.ink });
      p.spaced(String(i + 1).padStart(2, "0"), x + 24, y0 + 26, 10, C.accent, 3);
      const th = p.text(`| ${b.title}`, x + 24, y0 + 60, { size: 18, font: "med", color: C.white, w: gw - 48, lh: 23 });
      if (b.text) p.text(b.text, x + 24, y0 + 72 + th, { size: 13.5, font: "light", color: C.silver, w: gw - 48, lh: 19 });
    });
    p.pageNo(pageN, false);
  }

  /* 7 · PRÓXIMOS PASSOS + CONTATO */
  p.add("bg_contact"); pageN++;
  p.spaced("Próximos passos", M, 66, 12, C.accentInk);
  top = 150;
  top += p.text("Próximos passos", M, top, { size: 52, font: "bold" }) + 34;
  const steps: [string, string][] = [
    ["Aprove online", "Abra a proposta interativa, escolha o pacote e a forma de pagamento e assine digitalmente."],
    ["Pague a entrada", `Pix ou cartão, direto na página. À vista, a entrada é de ${entryPct}% e o restante na entrega.`],
    ["Começamos", "Recebo o seu aceite, agendamos o briefing e iniciamos o cronograma combinado."],
  ];
  const qrSize = 196, stepsW = W - 2 * M - qrSize - 36;
  const stTop = top;
  steps.forEach(([t, dsc], i) => {
    p.text(String(i + 1).padStart(2, "0"), M, top, { size: 13, font: "med", color: C.accentInk });
    top += p.text(t, M + 44, top - 4, { size: 21, font: "bold", w: stepsW - 44 }) + 2;
    top += p.text(dsc, M + 44, top, { size: 15, font: "light", color: C.soft, w: stepsW - 44, lh: 21 }) + 22;
  });
  const qx = W - M - qrSize;
  p.rrect(qx - 12, stTop - 12, qrSize + 24, qrSize + 64, 20, { fill: C.card });
  // QR Code desenhado em vetor (nítido e sem transparência)
  const qm = QRCode.create(link, { errorCorrectionLevel: "M" }).modules, n = qm.size, cell = qrSize / n;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qm.get(r, c)) p.page.drawRectangle({ x: qx + c * cell, y: H - stTop - (r + 1) * cell, width: cell + 0.3, height: cell + 0.3, color: C.ink });
  p.text("Proposta interativa", qx - 12, stTop + qrSize + 12, { size: 12, font: "med", color: C.soft, w: qrSize + 24, align: "center" });
  p.link(qx - 12, stTop - 12, qrSize + 24, qrSize + 64, link);
  top = Math.max(top, stTop + qrSize + 70) + 10;
  const shortLink = link.replace(/^https?:\/\//, "");
  p.rrect(M, top, W - 2 * M, 54, 27, { fill: C.card, border: hex("#D5DCE6") });
  p.text(shortLink, M + 24, top + 18, { size: 15, font: "med", color: C.accentInk, w: W - 2 * M - 48 });
  p.link(M, top, W - 2 * M, 54, link);

  // contato
  const cTop = H - 470;
  p.spaced("Contato", (W - p.f.med.widthOfTextAtSize("CONTATO", 12) - 7 * 5) / 2, cTop + 110, 12, C.soft, 5);
  const bw = 300, bx = (W - bw) / 2, by = cTop + 150;
  p.text("Fale comigo no WhatsApp", bx + 64, by + 19, { size: 16, font: "med", color: C.white });
  p.link(bx, by, bw, 56, `https://wa.me/${s.issuer.whatsapp}?text=${encodeURIComponent(`Olá, Gustavo! Vi a proposta ${q.slug} e quero conversar.`)}`);
  p.text(s.issuer.whatsappLabel, 0, by + 70, { size: 13, font: "reg", color: C.soft, w: W, align: "center" });
  p.text(s.issuer.email, 0, by + 104, { size: 16, font: "reg", w: W, align: "center" });
  p.link(W / 2 - 130, by + 100, 260, 24, `mailto:${s.issuer.email}`);
  p.link((W - 330) / 2, cTop, 330, 62, `https://${s.issuer.site}`); // logo do contato clicável
  p.text(`${s.issuer.name} · ${s.issuer.doc}`, 0, H - 92, { size: 11.5, font: "reg", color: C.gray, w: W, align: "center" });
  p.text(`Proposta elaborada para ${name} em ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()} · válida por ${q.validDays || 15} dias.`, 0, H - 74, { size: 11.5, font: "reg", color: C.gray, w: W, align: "center" });
  if (st?.approvedAt) p.text(`Aprovada por ${st.signer?.name} em ${new Date(st.approvedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`, 0, H - 56, { size: 11.5, font: "med", color: C.accentInk, w: W, align: "center" });

  p.doc.setTitle(`Orçamento · ${name} · ${s.issuer.name}`); p.doc.setAuthor(s.issuer.name); p.doc.setCreator("gustavoelian.com");
  return p.doc.save();
}

