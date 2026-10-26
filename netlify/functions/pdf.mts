// PDFs gerados no servidor: orçamento e contrato assinado (texto selecionável, links clicáveis, fontes TrueType).
import type { Config, Context } from "@netlify/functions";
import { PDFDocument, PDFName, PDFString, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { LTWaveBold, LTWaveLight, LTWaveMedium, LTWaveRegular, pdf_logo_on_white } from "../lib/assets.mts";
import { brl, fail, getQuote, getSettings, getState, isAdmin, priceOf } from "../lib/core.mts";
import catalog from "../../public/data/projects.json" with { type: "json" };
import { buildProposalPdf } from "../lib/proposal-pdf.mts";

const A4: [number, number] = [595.28, 841.89];
const M = 56; // margem
const C = { ink: rgb(0.18, 0.184, 0.2), soft: rgb(0.35, 0.365, 0.39), line: rgb(0.84, 0.86, 0.9), accent: rgb(0.184, 0.373, 0.816), ice: rgb(0.902, 0.941, 0.988) };

class Doc {
  doc!: PDFDocument; page!: PDFPage; y = 0; f: Record<string, PDFFont> = {}; logo: any; footer = ""; pages: PDFPage[] = [];
  static async create(footer: string) {
    const d = new Doc(); d.doc = await PDFDocument.create(); d.doc.registerFontkit(fontkit); d.footer = footer;
    const b = (s: string) => Buffer.from(s, "base64");
    d.f.light = await d.doc.embedFont(b(LTWaveLight), { subset: true });
    d.f.reg = await d.doc.embedFont(b(LTWaveRegular), { subset: true });
    d.f.med = await d.doc.embedFont(b(LTWaveMedium), { subset: true });
    d.f.bold = await d.doc.embedFont(b(LTWaveBold), { subset: true });
    d.logo = await d.doc.embedJpg(b(pdf_logo_on_white));
    d.newPage(); return d;
  }
  newPage() {
    this.page = this.doc.addPage(A4); this.pages.push(this.page); this.y = A4[1] - M;
    const w = 120, h = (w * this.logo.height) / this.logo.width;
    this.page.drawImage(this.logo, { x: M, y: A4[1] - 34 - h, width: w, height: h });
    this.y = A4[1] - 34 - h - 30;
  }
  ensure(h: number) { if (this.y - h < M + 30) this.newPage(); }
  wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    for (const para of String(text || "").split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const test = line ? line + " " + word : word;
        if (font.widthOfTextAtSize(test, size) > width && line) { lines.push(line); line = word; } else line = test;
      }
      lines.push(line);
    }
    return lines;
  }
  text(t: string, o: { font?: string; size?: number; color?: any; x?: number; width?: number; gap?: number; lh?: number } = {}) {
    const font = this.f[o.font || "reg"], size = o.size || 10.5, x = o.x ?? M, width = o.width ?? A4[0] - M - x, lh = o.lh || size * 1.45;
    for (const line of this.wrap(t, font, size, width)) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: o.color || C.ink });
      this.y -= lh;
    }
    this.y -= o.gap ?? 0;
  }
  label(t: string, gap = 8) { this.ensure(24); this.text(t.toUpperCase(), { font: "med", size: 8, color: C.accent, gap }); }
  rule(gap = 14) { this.ensure(gap); this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4[0] - M, y: this.y }, thickness: 0.6, color: C.line }); this.y -= gap; }
  right(t: string, y: number, font = "bold", size = 11, color = C.ink) {
    const f = this.f[font]; this.page.drawText(t, { x: A4[0] - M - f.widthOfTextAtSize(t, size), y, size, font: f, color });
  }
  link(t: string, url: string, o: { size?: number; font?: string } = {}) {
    const size = o.size || 10, font = this.f[o.font || "med"]; this.ensure(size * 1.6);
    const y = this.y - size, w = font.widthOfTextAtSize(t, size);
    this.page.drawText(t, { x: M, y, size, font, color: C.accent });
    const annot = this.doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: [M, y - 2, M + w, y + size], Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) } });
    const ref = this.doc.context.register(annot);
    const annots = this.page.node.lookup(PDFName.of("Annots")) as any;
    if (annots) annots.push(ref); else this.page.node.set(PDFName.of("Annots"), this.doc.context.obj([ref]));
    this.y -= size * 1.6;
  }
  async save() {
    const total = this.pages.length;
    this.pages.forEach((p, i) => {
      p.drawText(this.footer, { x: M, y: 28, size: 7.5, font: this.f.reg, color: C.soft });
      const n = `${i + 1}/${total}`; p.drawText(n, { x: A4[0] - M - this.f.reg.widthOfTextAtSize(n, 7.5), y: 28, size: 7.5, font: this.f.reg, color: C.soft });
    });
    return this.doc.save();
  }
}

const fmtDate = (iso: string) => { try { return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }); } catch { return iso; } };
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

async function quotePdf(q: any, s: any, st: any, origin: string) {
  const link = `${origin}/${q.slug}`;
  const d = await Doc.create(`${s.issuer.name} · ${s.issuer.doc} · ${s.issuer.email} · ${s.issuer.site}`);
  d.label(`Proposta · ${fmtDate(q.date)}`, 6);
  d.text(q.client?.name || "", { font: "bold", size: 30, lh: 34 });
  if (q.client?.company) d.text(q.client.company, { font: "light", size: 14, color: C.soft });
  d.y -= 6;
  if (q.title) d.text(q.title, { font: "med", size: 13, gap: 8 });
  if (q.intro) d.text(q.intro, { font: "light", size: 11, color: C.soft, gap: 6 });
  d.text(`Válida por ${q.validDays || 15} dias. Versão interativa: `, { size: 9, color: C.soft, lh: 12 });
  d.link(link.replace(/^https?:\/\//, ""), link, { size: 9 });
  d.y -= 10;

  d.label("Serviços orçados");
  (q.items || []).forEach((it: any, i: number) => {
    d.ensure(70); d.rule(12);
    const top = d.y;
    d.text(`${String(i + 1).padStart(2, "0")}  ${it.title}`, { font: "bold", size: 12.5, width: A4[0] - 2 * M - 120 });
    d.right(brl(it.price), top - 12.5, "bold", 12.5);
    if (it.deadline) d.right(`Prazo: ${it.deadline}`, top - 27, "reg", 8.5, C.soft);
    if (it.description) d.text(it.description, { font: "light", size: 10, color: C.soft, width: A4[0] - 2 * M - 120 });
    for (const del of it.deliverables || []) d.text(`•  ${del}`, { size: 9.5, x: M + 8 });
    if (it.deadline && d.y > top - 34) d.y = top - 34;
    d.y -= 4;
  });
  const sum = (q.items || []).reduce((t: number, i: any) => t + Number(i.price || 0), 0);
  d.rule(14);
  { const y = d.y - 12; d.page.drawText("Soma dos serviços avulsos", { x: M, y, size: 10.5, font: d.f.med, color: C.ink }); d.right(brl(sum), y, "bold", 12); d.y -= 28; }

  if ((q.packages || []).length) {
    d.y -= 6; d.label("Pacotes e condições");
    for (const p of q.packages) {
      const pr = priceOf(q, { packageId: p.id });
      d.ensure(78); d.rule(12);
      if (p.highlight) d.text(p.tag || "Maior economia", { font: "med", size: 8, color: C.accent, lh: 12 });
      d.text(p.name, { font: "bold", size: 12 });
      d.text(`De ${brl(pr.full)} por:`, { size: 9, color: C.soft, lh: 13 });
      d.text(`À vista: ${brl(pr.cash)} (entrada de ${s.payments.entryPct}% e o restante na entrega)`, { font: "med", size: 10.5 });
      d.text(`Cartão: ${brl(pr.card)} em até ${pr.installments}x de ${brl(pr.card / pr.installments)}`, { font: "med", size: 10.5 });
      if (pr.full > pr.cash) d.text(`Economia à vista: ${brl(pr.full - pr.cash)}`, { size: 9, color: C.accent });
    }
    d.y -= 6;
  }
  if ((q.bonuses || []).length) {
    d.label("Bônus ao fechar");
    for (const b of q.bonuses) { d.text(`•  ${b.title}`, { font: "med", size: 10.5, lh: 14 }); if (b.text) d.text(b.text, { size: 9.5, color: C.soft, x: M + 12 }); }
    d.y -= 8;
  }
  if (q.notes) { d.label("Observações"); d.text(q.notes, { size: 9.5, color: C.soft, gap: 8 }); }

  const projs = (catalog as any).projects.filter((p: any) => (q.projectIds || []).includes(p.id));
  if (projs.length) {
    d.label("Trabalhos relacionados");
    for (const p of projs) {
      d.ensure(30);
      d.text(`${p.title} · ${p.kind}`, { font: "med", size: 10, lh: 13 });
      if (p.url) d.link(p.url.replace(/^https?:\/\//, ""), p.url, { size: 8.5, font: "reg" });
      else d.y -= 4;
    }
    d.y -= 6;
  }
  if (st.approvedAt) {
    d.label("Aprovação");
    d.text(`Aprovada por ${st.signer?.name} em ${fmtDateTime(st.approvedAt)}. Condição escolhida: ${st.paymentText}.`, { size: 10 });
  }
  d.ensure(80); d.y -= 10; d.rule(16);
  d.text("Fale comigo", { font: "bold", size: 14, lh: 20 });
  d.link(`WhatsApp ${s.issuer.whatsappLabel}`, `https://wa.me/${s.issuer.whatsapp}?text=${encodeURIComponent(`Olá, Gustavo! Sobre a proposta ${q.slug}`)}`);
  d.link(s.issuer.email, `mailto:${s.issuer.email}`);
  d.link(s.issuer.site, `https://${s.issuer.site}`);
  d.doc.setTitle(`Proposta ${q.client?.name || ""} · ${s.issuer.name}`); d.doc.setAuthor(s.issuer.name);
  return d.save();
}

// caixa de cantos arredondados (origem do svg no canto superior esquerdo)
function round(d: Doc, x: number, yTop: number, w: number, h: number, r: number, fill: any, stroke?: any) {
  const path = `M${r} 0H${w - r}Q${w} 0 ${w} ${r}V${h - r}Q${w} ${h} ${w - r} ${h}H${r}Q0 ${h} 0 ${h - r}V${r}Q0 0 ${r} 0Z`;
  d.page.drawSvgPath(path, { x, y: yTop, color: fill, borderColor: stroke, borderWidth: stroke ? 0.6 : 0 });
}
function linkArea(d: Doc, x: number, y: number, w: number, h: number, url: string) {
  const annot = d.doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, y, x + w, y + h], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) } });
  const ref = d.doc.context.register(annot);
  const annots = d.page.node.lookup(PDFName.of("Annots")) as any;
  if (annots) annots.push(ref); else d.page.node.set(PDFName.of("Annots"), d.doc.context.obj([ref]));
}
// botão em pílula com link clicável; devolve a largura usada
function pill(d: Doc, x: number, yTop: number, label: string, url: string, dark = false) {
  const size = 9, f = d.f.med, tw = f.widthOfTextAtSize(label, size), w = tw + 40, h = 24, ink = dark ? rgb(1, 1, 1) : C.ink;
  round(d, x, yTop, w, h, 12, dark ? C.ink : rgb(1, 1, 1), dark ? undefined : C.line);
  d.page.drawText(label, { x: x + 14, y: yTop - 15.5, size, font: f, color: ink });
  // seta ↗ desenhada (a fonte não tem o glifo)
  d.page.drawSvgPath("M0 7L7 0M2 0H7V5", { x: x + 14 + tw + 6, y: yTop - 8.5, borderColor: ink, borderWidth: 1.1 });
  linkArea(d, x, yTop - h, w, h, url);
  return w;
}

async function contractPdf(q: any, s: any, st: any, origin: string) {
  const code = String(st.contractHash || "").slice(0, 16);
  const d = await Doc.create(`Contrato ${q.slug} · verificação ${code} · ${s.issuer.site}`);
  const W = A4[0] - 2 * M;
  const links = { painel: `${origin}/acompanhar`, acervo: `${origin}/acompanhar#acervo`, proposta: `${origin}/${q.slug}`, contato: `https://wa.me/${s.issuer.whatsapp}?text=${encodeURIComponent(`Olá, Gustavo! Sobre o contrato ${q.slug}`)}` };

  // número do contrato no topo, alinhado ao logo
  d.right(`Contrato nº ${q.slug}`, A4[1] - 50, "med", 8.5, C.soft);
  d.label("Contrato de prestação de serviços", 6);
  d.text(q.client?.company || q.client?.name || "", { font: "bold", size: 24, lh: 30 });
  if (q.title) d.text(q.title, { font: "light", size: 13, color: C.soft, gap: 14 });

  // cartão-resumo com os atalhos clicáveis
  const top = d.y, h = 104;
  round(d, M, top, W, h, 14, C.ice);
  const col = (i: number, k: string, v: string) => {
    const x = M + 18 + i * ((W - 36) / 3);
    d.page.drawText(k.toUpperCase(), { x, y: top - 24, size: 7.5, font: d.f.med, color: C.accent });
    d.page.drawText(v, { x, y: top - 40, size: 11, font: d.f.bold, color: C.ink });
  };
  col(0, "Valor", brl(Number(st.total || 0)));
  col(1, "Assinado em", fmtDate(String(st.approvedAt).slice(0, 10)));
  col(2, "Contratante", String(st.signer?.name || q.client?.name || "").split(" ").slice(0, 2).join(" "));
  let px = M + 18;
  px += pill(d, px, top - 62, "Acompanhar a demanda", links.painel, true) + 8;
  px += pill(d, px, top - 62, "Acervo de materiais", links.acervo) + 8;
  px += pill(d, px, top - 62, "Proposta online", links.proposta) + 8;
  if (px + d.f.med.widthOfTextAtSize("WhatsApp", 9) + 40 <= M + W - 12) pill(d, px, top - 62, "WhatsApp", links.contato);
  d.y = top - h - 22;

  // corpo: títulos de cláusula destacados, parágrafos com respiro
  const lines = String(st.contractText || "").split("\n").filter((l, i) => !(i === 0 && /^CONTRATO DE/i.test(l)));
  for (const line of lines) {
    const t = line.trim();
    if (!t) { d.y -= 4; continue; }
    if (/^\d{1,2}\. [A-ZÀ-Ú][A-ZÀ-Ú ,()º.\/0-9-]{3,}$/.test(t) && t === t.toUpperCase()) {
      d.ensure(40); d.y -= 8;
      d.text(t, { font: "med", size: 10.5, color: C.accent, lh: 16, gap: 2 });
    } else if (/^(CONTRATANTE|CONTRATADO):/.test(t)) {
      const [k, ...v] = t.split(":");
      d.text(k, { font: "med", size: 8, color: C.soft, lh: 11 });
      d.text(v.join(":").trim(), { size: 10, lh: 14.5, gap: 6 });
    } else d.text(t, { size: 9.8, lh: 14.6, gap: 3 });
  }

  // assinaturas lado a lado
  d.y -= 16; d.ensure(170); d.rule(18);
  d.label("Assinaturas", 12);
  const sy = d.y, half = (W - 24) / 2;
  if (st.signatureImage) {
    const raw = Buffer.from(st.signatureImage.split(",")[1], "base64");
    const img = st.signatureImage.startsWith("data:image/jpeg") ? await d.doc.embedJpg(raw) : await d.doc.embedPng(raw);
    const iw = Math.min(170, half), ih = Math.min(60, (iw * img.height) / img.width);
    d.page.drawImage(img, { x: M, y: sy - ih, width: (ih * img.width) / img.height, height: ih });
  }
  const sig = (x: number, name: string, role: string, note: string) => {
    d.page.drawLine({ start: { x, y: sy - 66 }, end: { x: x + half, y: sy - 66 }, thickness: 0.6, color: C.ink });
    d.page.drawText(name, { x, y: sy - 80, size: 10, font: d.f.med, color: C.ink });
    d.page.drawText(role, { x, y: sy - 93, size: 8, font: d.f.reg, color: C.soft });
    d.page.drawText(note, { x, y: sy - 105, size: 7.5, font: d.f.reg, color: C.soft });
  };
  sig(M, st.signer?.name || "", `CONTRATANTE · ${st.signer?.doc || ""}`, `Assinado eletronicamente em ${fmtDateTime(st.approvedAt)}`);
  d.page.drawText("Assinado eletronicamente", { x: M + half + 24, y: sy - 52, size: 13, font: d.f.light, color: C.accent });
  sig(M + half + 24, s.issuer.name, `CONTRATADO · ${s.issuer.doc}`, `Ao emitir a proposta em ${fmtDate(String(q.createdAt || st.approvedAt).slice(0, 10))}`);
  d.y = sy - 124;

  // trilha de auditoria em duas colunas
  d.ensure(200); d.rule(16);
  d.label("Registro de aceite eletrônico (Lei 14.063/2020)", 10);
  const rows: [string, string][] = [
    ["Nome", st.signer?.name], ["CPF/CNPJ", st.signer?.doc], ["E-mail", st.signer?.email], ["WhatsApp", st.signer?.phone || "—"],
    ["Endereço", st.signer?.address || "—"], ["Data e hora", fmtDateTime(st.approvedAt) + " (Brasília)"],
    ["Endereço IP", (st.signer?.ip || "—") + (st.signer?.city ? ` · ${st.signer.city}` : "")], ["Proposta", `${origin}/${q.slug}`],
  ];
  for (let i = 0; i < rows.length; i += 2) {
    d.ensure(30); const y0 = d.y;
    for (const [j, [k, v]] of [rows[i], rows[i + 1]].filter(Boolean).entries()) {
      const x = M + j * (half + 24);
      d.page.drawText(k, { x, y: y0 - 8, size: 7.5, font: d.f.med, color: C.soft });
      const val = d.wrap(String(v || "—"), d.f.reg, 9, half)[0];
      d.page.drawText(val, { x, y: y0 - 21, size: 9, font: d.f.reg, color: C.ink });
    }
    d.y = y0 - 32;
  }
  d.text("Condição de pagamento", { font: "med", size: 7.5, color: C.soft, lh: 11 });
  d.text(st.paymentText || "—", { size: 9, lh: 12.5, gap: 6 });
  d.text("Navegador", { font: "med", size: 7.5, color: C.soft, lh: 11 });
  d.text(st.signer?.userAgent || "—", { size: 8, color: C.soft, lh: 11, gap: 6 });
  d.text("Código de integridade do texto aceito (SHA-256)", { font: "med", size: 7.5, color: C.soft, lh: 11 });
  d.text(st.contractHash || "—", { size: 8.5, lh: 12, gap: 14 });

  d.doc.setTitle(`Contrato ${q.client?.company || q.client?.name || ""} · ${s.issuer.name}`); d.doc.setAuthor(s.issuer.name);
  d.doc.setSubject(`Contrato vinculado à proposta ${q.slug}`);
  return d.save();
}

export default async (req: Request, context: Context) => {
  const { slug, kind } = context.params;
  const q = await getQuote(slug);
  if (!q || (!q.published && !(await isAdmin(context)))) return fail("Proposta não encontrada", 404);
  const s = await getSettings();
  const st = await getState(slug);
  const origin = new URL(req.url).origin;
  let bytes: Uint8Array, name: string;
  if (kind === "contrato") {
    if (!st.approvedAt || !st.contractText) return fail("Contrato disponível após a aprovação", 404);
    bytes = await contractPdf(q, s, st, origin); name = `Contrato-${q.slug}.pdf`;
  } else {
    const projs = (catalog as any).projects.filter((p: any) => (q.projectIds || []).includes(p.id)).map((p: any) => (p.case ? { ...p, url: `${origin}/projetos/${p.id}` } : p));
    const withImg = await Promise.all(projs.slice(0, 4).map(async (p: any) => {
      if (!p.cover) return p;
      try { const r = await fetch(`${origin}/${p.cover}`); if (!r.ok) return p; return { ...p, _bytes: new Uint8Array(await r.arrayBuffer()), _type: p.cover.endsWith(".png") ? "png" : "jpg" }; }
      catch { return p; }
    }));
    bytes = await buildProposalPdf(q, s, st, origin, withImg); name = `Orcamento-${q.slug}.pdf`;
  }
  return new Response(bytes, { headers: { "content-type": "application/pdf", "content-disposition": `${new URL(req.url).searchParams.has("download") ? "attachment" : "inline"}; filename="${name}"`, "cache-control": "no-store" } });
};

export const config: Config = { path: "/api/pdf/:slug/:kind" };
