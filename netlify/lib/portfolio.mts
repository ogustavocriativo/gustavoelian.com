// Dados do portfólio editados no Studio. Funções puras (sem I/O), testáveis fora da Netlify.
// Cada projeto do site = dados base (public/data/projects.json) + esta entrada (sobrescreve o que vier preenchido).
// Projetos criados no painel têm custom:true e existem só aqui.

export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "video/mp4", "video/webm"];
export const MEDIA_MAX = 4.5 * 1024 * 1024; // limite de corpo das functions
export const ID_RE = /^[a-z0-9-]{2,80}$/;
export const MEDIA_RE = /^[a-z0-9-]{2,80}-(thumb|banner|avatar|print|gallery|page|mood)-[a-z0-9]{6,24}$/;
// moodboard da página inicial: lista própria, montada do zero no Studio
export const MOOD_SIZES = ["auto", "s", "wide", "tall", "l"];
export function cleanMood(body: any) {
  const tiles = (Array.isArray(body?.tiles) ? body.tiles : []).slice(0, 60).map((t: any) => {
    const media = mediaRef(t?.media);
    if (!media || !/-mood-/.test(media.key)) return null;
    return { media, size: MOOD_SIZES.includes(t.size) ? t.size : "auto", alt: str(t.alt, 140), link: ID_RE.test(String(t.link || "")) ? String(t.link) : "" };
  }).filter(Boolean);
  return { tiles, updatedAt: new Date().toISOString() };
}
export const FRAMES = ["none", "laptop", "phone", "browser", "tablet"];
export const SIZES = ["s", "wide", "tall", "l"];
export const FRONTS = ["web", "social", "trade", "branding"];
const HEX = /^#[0-9a-fA-F]{6}$/;
const CHANNELS = ["whatsapp", "email", "instagram", "reuniao", "outro"];

const str = (v: any, n: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, n);
const opt = (v: any, n: number) => (v == null || v === "" ? undefined : str(v, n));
const pick = (v: any, list: string[], d: string) => (list.includes(v) ? v : d);
export const mediaRef = (m: any) => {
  if (!m || typeof m !== "object") return null;
  const key = str(m.key, 120);
  if (!MEDIA_RE.test(key)) return null;
  const pct = (v: any) => (v == null || v === "" || isNaN(Number(v)) ? undefined : Math.max(0, Math.min(100, Math.round(Number(v)))));
  const fx = pct(m.fx), fy = pct(m.fy);
  const z = Number(m.z) > 1 ? Math.min(4, Math.round(Number(m.z) * 100) / 100) : 0;
  const o = (v: any) => Math.max(-400, Math.min(500, Math.round(Number(v) * 10) / 10 || 0));
  return { key, type: MEDIA_TYPES.includes(m.type) ? m.type : "image/jpeg", w: Number(m.w) || null, h: Number(m.h) || null, ...(fx != null && fy != null ? { fx, fy } : {}), ...(z ? { z, ox: o(m.ox), oy: o(m.oy) } : {}) };
};
const url = (v: any) => { const s = str(v, 300); return /^https:\/\/[^\s<>"]+$/.test(s) ? s : undefined; };

/** Limpa o que chega do editor. Nunca confia no cliente. */
export function cleanEntry(input: any, custom = false) {
  const i = input || {};
  const out: any = {
    hidden: i.hidden === true,
    section: ["creative", "list"].includes(i.section) ? i.section : undefined, // vitrine: projetos criativos (cards) ou lista de experiência (tópicos)
    topicOnly: i.topicOnly === true,
    // interesses do visitante que este projeto atende (pop-up "o que você precisa?")
    needs: Array.isArray(i.needs) ? i.needs.filter((n: any) => ["reposicionar", "criar-marca", "site", "sistema"].includes(n)).slice(0, 4) : undefined, // na lista: só o tópico, sem página própria
    custom,
    // campos do card (no projeto base só sobrescrevem quando preenchidos)
    title: opt(i.title, 120), kind: opt(i.kind, 120), client: opt(i.client, 120), year: opt(i.year, 20),
    summary: opt(i.summary, 600), url: url(i.url),
    fronts: Array.isArray(i.fronts) ? i.fronts.filter((f: any) => FRONTS.includes(f)).slice(0, 4) : undefined,
    thumb: mediaRef(i.thumb),
    banner: mediaRef(i.banner),
    bannerFrame: pick(i.bannerFrame, FRAMES, "laptop"),
    bannerAlt: str(i.bannerAlt, 200),
    bannerBg: HEX.test(i.bannerBg || "") ? i.bannerBg : "", // fundo atrás do banner (vazio = sem fundo)
    bannerPad: i.bannerPad !== false,
    gallery: (Array.isArray(i.gallery) ? i.gallery : []).slice(0, 24).map((g: any) => ({
      media: mediaRef(g?.media), frame: pick(g?.frame, FRAMES, "none"), bg: HEX.test(g?.bg || "") ? g.bg : "", size: pick(g?.size, SIZES, "s"), caption: str(g?.caption, 120),
      mood: g?.mood !== false,
    })).filter((g: any) => g.media),
    // fotos do próprio projeto escolhidas no painel para o moodboard da página inicial (caminhos do acervo do site)
    moodPicks: [...new Set((Array.isArray(i.moodPicks) ? i.moodPicks : []).map((x: any) => String(x)).filter((x: string) => /^img\/[a-z0-9/._-]+\.(jpe?g|png|webp)$/i.test(x) && !x.includes("..")))].slice(0, 16),
    metrics: (Array.isArray(i.metrics) ? i.metrics : []).slice(0, 8).map((s: any) => ({
      title: str(s?.title, 60), note: str(s?.note, 240),
      items: (Array.isArray(s?.items) ? s.items : []).slice(0, 8).map((it: any) => ({
        value: str(it?.value, 16), unit: str(it?.unit, 12), label: str(it?.label, 80), note: str(it?.note, 140),
        progress: it?.progress === "" || it?.progress == null ? null : Math.max(0, Math.min(100, Number(it.progress) || 0)),
      })).filter((it: any) => it.value && it.label),
    })).filter((s: any) => s.items.length),
    // publicações do Instagram (post, reel ou IGTV) exibidas com o embed oficial: vídeo toca com som ao tocar
    insta: (Array.isArray(i.insta) ? i.insta : []).map((x: any) => {
      const m = String(x?.url || x || "").trim().match(/^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/);
      return m ? { url: `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/`, caption: str(x?.caption, 140) } : null;
    }).filter(Boolean).filter((x: any, k: number, a: any[]) => a.findIndex((y: any) => y.url === x.url) === k).slice(0, 12),
    instaTitle: str(i.instaTitle, 80),
    instaCredit: str(i.instaCredit, 80),
    feedback: (Array.isArray(i.feedback) ? i.feedback : []).slice(0, 12).map((f: any) => ({
      id: str(f?.id, 24) || Math.random().toString(36).slice(2, 10),
      name: str(f?.name, 80), role: str(f?.role, 120), channel: pick(f?.channel, CHANNELS, "whatsapp"),
      date: /^\d{4}-\d{2}-\d{2}$/.test(f?.date || "") ? f.date : "",
      message: str(f?.message, 2400), highlight: str(f?.highlight, 220),
      avatar: mediaRef(f?.avatar), print: mediaRef(f?.print), authorized: f?.authorized === true,
    })).filter((f: any) => f.name && (f.message || f.print)),
  };
  if (out.fronts && !out.fronts.length) out.fronts = undefined;
  if (custom) { out.section = out.section || "creative"; out.title = out.title || "Novo projeto"; out.fronts = out.fronts?.length ? out.fronts : ["web"]; }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

/** O que o público vê: tira projetos ocultos e depoimentos sem autorização. */
export function publicEntry(e: any) {
  if (!e || e.hidden) return e?.hidden ? { hidden: true } : null;
  const { feedback, ...rest } = e;
  return { ...rest, feedback: (feedback || []).filter((f: any) => f.authorized).map(({ authorized, ...f }: any) => f) };
}

/** Chaves de mídia referenciadas por uma entrada (para apagar arquivos órfãos). */
export function mediaKeys(e: any): string[] {
  if (!e) return [];
  if (Array.isArray(e.sections)) return [...JSON.stringify(e.sections).matchAll(/\/api\/media\/([a-z0-9-]+)/g)].map((m) => m[1]).filter((k) => MEDIA_RE.test(k));
  return [e.thumb, e.banner, ...(e.gallery || []).map((g: any) => g.media), ...(e.feedback || []).flatMap((f: any) => [f.avatar, f.print])]
    .filter(Boolean).map((m: any) => m.key);
}

export const cleanOrder = (o: any) => [...new Set((Array.isArray(o) ? o : []).map(String).filter((x) => ID_RE.test(x)))].slice(0, 200);
export const slug = (s: string) => String(s || "projeto").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "projeto";

/** Textos de "Sobre" e "Trajetória" da página inicial, editados no Studio. */
export function cleanSite(i: any) {
  const a = i?.about || {}, hh = i?.hero || {};
  return {
    hero: {
      title: str(hh.title, 120), sub: str(hh.sub, 160), hand: str(hh.hand, 120), lead: str(hh.lead, 400),
      cards: (Array.isArray(hh.cards) ? hh.cards : []).slice(0, 3).map((c: any) => ({ k: str(c?.k, 40), title: str(c?.title, 60), sub: str(c?.sub, 80), href: safeLink(str(c?.href, 300)) })),
      // foto da abertura (já recortada em 4:5) e o original, para reenquadrar depois
      photo: mediaRef(hh.photo), photoOrig: mediaRef(hh.photoOrig), photoAlt: str(hh.photoAlt, 160),
    },
    services: (Array.isArray(i?.services) ? i.services : []).slice(0, 8).map((x: any) => ({ title: str(x?.title, 80), text: str(x?.text, 240) })).filter((x: any) => x.title),
    about: {
      title: str(a.title, 140), years: str(a.years, 24), yearsLabel: str(a.yearsLabel, 60), caption: str(a.caption, 140),
      text: (Array.isArray(a.text) ? a.text : []).map((t: any) => str(t, 1200)).filter(Boolean).slice(0, 4),
      // fotos da rolagem automática do Sobre (apresentações, palestras)
      photos: (Array.isArray(a.photos) ? a.photos : []).slice(0, 8).map((p: any) => ({ media: mediaRef(p?.media), caption: str(p?.caption, 140) })).filter((p: any) => p.media),
    },
    trail: (Array.isArray(i?.trail) ? i.trail : []).slice(0, 12).map((t: any) => ({ k: str(t?.k, 30), title: str(t?.title, 90), text: str(t?.text, 260) })).filter((t: any) => t.title),
  };
}

/** Seções da página do projeto editadas no Studio.
 *  Mantém a estrutura de cada seção; limita tamanho, profundidade e chaves; links só https, relativos ou mailto/wa. */
const KEY_RE = /^[A-Za-z_][\w-]{0,30}$/;
const LINK_KEYS = new Set(["href", "url"]);
const safeLink = (v: string) => /^(https:\/\/|mailto:|\/|#)/.test(v) && !/^\/\//.test(v) ? v : "";
function deep(v: any, depth: number, key = ""): any {
  if (depth > 8) return undefined;
  if (typeof v === "string") return LINK_KEYS.has(key) ? safeLink(v.slice(0, 400)) : v.replace(/\r\n/g, "\n").slice(0, 4000);
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "boolean" || v === null) return v;
  if (Array.isArray(v)) return v.slice(0, 200).map((x) => deep(x, depth + 1, key)).filter((x) => x !== undefined);
  if (typeof v === "object") {
    const o: any = {};
    for (const [k, x] of Object.entries(v).slice(0, 80)) if (KEY_RE.test(k)) { const y = deep(x, depth + 1, k); if (y !== undefined) o[k] = y; }
    return o;
  }
  return undefined;
}
export function cleanSections(input: any) {
  const arr = (Array.isArray(input) ? input : []).slice(0, 60).map((s) => deep(s, 0)).filter((s) => s && typeof s === "object" && typeof s.type === "string");
  if (JSON.stringify(arr).length > 400_000) throw new Error("Página grande demais");
  return arr;
}
