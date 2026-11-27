// Entrega final: dossiê com arquivos e seus códigos de integridade, certificado de autoria e cessão de direitos,
// licenças de terceiros, acessos transferidos e recomendações de segurança e conformidade por tipo de projeto.
import { brl, files, getSettings, sha256, shortCode, store, formatDoc, docLabel } from "./core.mts";

export const certs = () => store("certs");

type Rec = { t: string; d: string };
export const KINDS: Record<string, { label: string; recs: Rec[] }> = {
  marca: {
    label: "Marca e identidade",
    recs: [
      { t: "Registre a marca no INPI", d: "Faça uma busca de anterioridade e deposite o pedido nas classes do seu negócio antes de investir em produção e mídia. O registro é o que garante o uso exclusivo do nome e do símbolo." },
      { t: "Garanta nome de domínio e perfis", d: "Registre o domínio (.com.br e .com) e os perfis nas redes com o nome da marca, em contas da empresa, não pessoais." },
      { t: "Siga o manual de uso", d: "Não altere proporções, cores ou tipografia. Fornecedores (gráfica, fachada, brindes) devem receber os arquivos originais e o manual." },
      { t: "Confira as licenças das fontes", d: "Fontes listadas abaixo como licenciadas precisam de licença para uso comercial no nome da empresa." },
    ],
  },
  site: {
    label: "Site e presença digital",
    recs: [
      { t: "Troque as senhas recebidas e ative a verificação em duas etapas", d: "Hospedagem, domínio, painel do site e e-mails. Guarde tudo num gerenciador de senhas da empresa." },
      { t: "Deixe domínio e hospedagem em renovação automática", d: "Domínio vencido tira o site e os e-mails do ar e pode ser registrado por terceiros." },
      { t: "Mantenha a política de privacidade em dia (LGPD)", d: "Se o site coleta dados (formulários, cookies de anúncio, analytics), informe quais dados, para quê e por quanto tempo, e ofereça um canal para o titular." },
      { t: "Tenha cópias de segurança", d: "Mantenha backup periódico do site e teste a restauração ao menos uma vez por semestre." },
      { t: "Ferramentas em contas suas", d: "Google Analytics, Search Console, Meta e pixels devem pertencer a contas da empresa, com o profissional apenas como usuário." },
    ],
  },
  sistema: {
    label: "Sistema e dados",
    recs: [
      { t: "Contas administradoras em nome da empresa", d: "Mantenha ao menos dois administradores da empresa e remova acessos de quem saiu do projeto." },
      { t: "Proteja chaves e senhas", d: "Chaves de API e senhas nunca devem ser enviadas por e-mail ou WhatsApp. Troque qualquer chave que tenha circulado." },
      { t: "Adequação à LGPD", d: "Defina a base legal de cada dado tratado, quem é o encarregado e por quanto tempo os dados ficam guardados. Atenda pedidos de titulares em até 15 dias." },
      { t: "Backup e plano de recuperação", d: "Backups automáticos fora do servidor principal, com teste de restauração periódico." },
      { t: "Termos de uso e privacidade", d: "Se o sistema tem usuários externos, publique termos de uso e política de privacidade revisados por advogado." },
    ],
  },
  conteudo: {
    label: "Conteúdo, campanhas e audiovisual",
    recs: [
      { t: "Autorizações de uso de imagem", d: "Guarde as autorizações por escrito de todas as pessoas que aparecem em fotos e vídeos, com prazo e finalidade de uso." },
      { t: "Publicidade clara (CDC e CONAR)", d: "Preços, condições, prazos e regras de promoções precisam estar visíveis. Conteúdo com parceiros deve ser identificado como publicidade." },
      { t: "Promoções e sorteios", d: "Sorteios, vale-brindes e concursos com distribuição de prêmios podem exigir autorização prévia do governo federal. Consulte antes de lançar." },
      { t: "Trilhas e imagens licenciadas", d: "Use músicas e imagens apenas dentro da licença indicada. Em mídia paga, confirme se a licença cobre anúncios." },
    ],
  },
};
const GERAL: Rec[] = [
  { t: "Guarde este certificado e os arquivos", d: "Baixe os arquivos e mantenha cópias em dois lugares diferentes. Os links ficam disponíveis no painel por tempo limitado." },
  { t: "Confira a integridade quando precisar", d: "Cada arquivo tem um código SHA-256. Se o código de um arquivo não bater com o deste dossiê, ele foi alterado depois da entrega." },
];

const KEYWORDS: [string, RegExp][] = [
  ["marca", /marca|brand|logo|identidade|naming|manual|papelaria|rebrand/i],
  ["site", /site|landing|web|loja|e-?commerce|p[aá]gina|dom[ií]nio/i],
  ["sistema", /sistema|app|aplicativo|plataforma|painel|dashboard|software|automa/i],
  ["conteudo", /conte[uú]do|social|post|v[ií]deo|campanha|capta|reels|ooh|outdoor|evento|ativa/i],
];
export function guessKinds(q: any) {
  const text = [q.title, ...(q.items || []).map((i: any) => `${i.title} ${i.description || ""}`)].join(" ");
  const k = KEYWORDS.filter(([, re]) => re.test(text)).map(([id]) => id);
  return k.length ? k : ["marca"];
}

const lines = (v: any, max = 30) => (Array.isArray(v) ? v : String(v || "").split("\n")).map((x: any) => String(x).trim().slice(0, 240)).filter(Boolean).slice(0, max);

const httpUrl = (v: any) => { const u = String(v || "").trim().slice(0, 300); return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(u) ? u : ""; };
const isPaid = (st: any) => Number(st.total || 0) > 0 && Number(st.paidTotal || 0) >= Number(st.total || 0) - 0.009;

/** Monta a entrega (sem certificado): o certificado só sai com a entrega aprovada pelo cliente e o contrato quitado. */
export async function buildDelivery(q: any, st: any, input: any) {
  const kinds = (Array.isArray(input.kinds) ? input.kinds : guessKinds(q)).filter((k: string) => KINDS[k]);
  const at = new Date().toISOString();
  const prev = st.delivery || null;
  // arquivos visíveis ao cliente, com código de integridade calculado sobre os bytes guardados
  const delivered = await Promise.all((q.attachments || []).filter((a: any) => a.showToClient && !a.fromClient && a.kind !== "contrato-assinado").map(async (a: any) => {
    const buf = await files().get(`${q.slug}/${a.id}`, { type: "arrayBuffer" });
    let hash = "";
    if (buf) { const d = await crypto.subtle.digest("SHA-256", buf as ArrayBuffer); hash = [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
    return { id: a.id, name: a.name, size: a.size, type: a.type || "", hash };
  }));
  const items = (q.items || []).filter((i: any) => !st.selection?.itemIds || st.selection.itemIds.includes(i.id) || st.selection.packageId)
    .map((i: any) => i.title).filter(Boolean);
  const signer = st.signer || {};
  const holder = { name: signer.name || q.client?.name || "", doc: signer.doc ? docLabel(signer.doc) + formatDoc(signer.doc) : "", company: q.client?.company || "" };
  const manual = delivered.find((f) => f.id === String(input.manualId || "")) || null;
  return {
    slug: q.slug, at, version: (prev?.version || (prev ? 1 : 0)) + 1, kinds, items, files: delivered,
    systemUrl: httpUrl(input.systemUrl), systemLabel: String(input.systemLabel || "").trim().slice(0, 60),
    manual: manual ? { id: manual.id, name: manual.name, size: manual.size } : null,
    note: String(input.note || "").trim().slice(0, 1000),
    licenses: lines(input.licenses), accesses: lines(input.accesses), support: String(input.support || "").trim().slice(0, 600),
    recommendations: [...kinds.flatMap((k: string) => KINDS[k].recs.map((r) => ({ ...r, kind: KINDS[k].label }))), ...GERAL.map((r) => ({ ...r, kind: "Geral" }))],
    status: "aguardando", feedback: prev?.feedback || [],
    paid: isPaid(st), certificate: null as any, holder,
  };
}

/** Certificado de autoria e cessão sobre a entrega aprovada (cláusula 7.1). */
async function makeCertificate(q: any, st: any, d: any) {
  const settings = await getSettings();
  const at = new Date().toISOString();
  const code = (shortCode(4) + "-" + shortCode(4)).toUpperCase();
  const text = `Certificamos que ${settings.issuer.name}, ${settings.issuer.doc}, autor das obras relacionadas neste certificado, cedeu a ${d.holder.name}${d.holder.doc ? `, ${d.holder.doc}` : ""}${d.holder.company ? ` (${d.holder.company})` : ""}, em caráter definitivo, os direitos patrimoniais de uso das peças finais aprovadas, para as finalidades descritas ${st.contractNumber ? `no contrato nº ${st.contractNumber}` : `na proposta nº ${q.slug}`}, nos termos da Lei nº 9.610/1998 e do contrato assinado eletronicamente em ${new Date(st.signing?.signedAt || st.approvedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}, com quitação integral de ${brl(Number(st.total || 0))}. Os direitos morais de autoria permanecem com o autor. Licenças de terceiros seguem os termos dos respectivos titulares.`;
  const canonical = JSON.stringify({ code, slug: q.slug, holder: d.holder, items: d.items, files: (d.files || []).map((f: any) => [f.name, f.hash]), at, text });
  await certs().setJSON(code, { slug: q.slug, at });
  return { code, at, text, hash: await sha256(canonical), canonical };
}

// versão segura para o cliente e para a verificação pública (sem o texto canônico interno)
export function publicDelivery(d: any) {
  if (!d) return null;
  const { certificate, ...rest } = d;
  const fileUrl = (id: string) => `/api/quotes/${d.slug}/files/${id}?download`;
  return {
    ...rest, status: d.status || (certificate ? "aprovada" : "aguardando"), version: d.version || 1,
    manual: d.manual && d.slug ? { ...d.manual, url: fileUrl(d.manual.id) } : null,
    files: (d.files || []).map((f: any) => ({ ...f, url: d.slug ? fileUrl(f.id) : "" })),
    certificate: certificate ? { code: certificate.code, at: certificate.at, text: certificate.text, hash: certificate.hash, url: `/certificado?c=${certificate.code}` } : null,
  };
}

/* Conclusão: com a entrega APROVADA pelo cliente e o contrato QUITADO, emite o certificado de cessão,
   marca o projeto como concluído e envia o último e-mail (agradecimento + certificado).
   Chamado quando o cliente aprova a entrega e por todo caminho que registra pagamento. */
export async function issueCertificateIfReady(slug: string, origin = "https://gustavoelian.com") {
  const { getQuote, getState, patchState, addEvent, clientToken } = await import("./core.mts");
  const q: any = await getQuote(slug); const st: any = await getState(slug);
  const d = st.delivery;
  if (!q || !d || d.certificate || d.status !== "aprovada" || !isPaid(st)) return null;
  const certificate = await makeCertificate(q, st, d);
  const now = new Date().toISOString();
  const work = { ...(st.work || {}) };
  if (work.stage !== "concluido") { work.stage = "concluido"; work.history = [...(work.history || []), { stage: "concluido", at: now }].slice(-30); }
  await patchState(slug, { delivery: { ...d, paid: true, certificate, certificateIssuedAt: now }, work });
  await addEvent(slug, { type: "certificate", certificate: certificate.code });
  const { googleReady, sendMail } = await import("./google.mts");
  const { mails } = await import("./mails.mts");
  const to = st.signer?.email || q.client?.email;
  if (googleReady() && to) {
    const r = await sendMail(to, mails.conclusao({ name: st.signer?.name || q.client?.name, title: q.title, contractNumber: st.contractNumber, certCode: certificate.code, certUrl: `${origin}/certificado?c=${certificate.code}`, panel: `${origin}/acompanhar?t=${await clientToken(to)}`, systemUrl: d.systemUrl }));
    await addEvent(slug, { type: r?.ok ? "email-sent" : "email-error", what: "conclusao", to });
  }
  return certificate;
}
export const issueCertificateIfPaid = issueCertificateIfReady;

/* Resposta do cliente à entrega final, no painel: aprova ou pede alterações. */
export async function respondDelivery(slug: string, kind: "aprovar" | "ajustes", message: string, origin: string) {
  const { getQuote, getState, patchState, addEvent, clientToken } = await import("./core.mts");
  const q: any = await getQuote(slug); const st: any = await getState(slug);
  const d = st.delivery;
  if (!q || !d) return { error: "Entrega não encontrada" };
  if (d.status === "aprovada") return { error: "Esta entrega já foi aprovada" };
  const msg = String(message || "").trim().slice(0, 2000);
  if (kind === "ajustes" && msg.length < 5) return { error: "Descreva o que precisa mudar" };
  const at = new Date().toISOString();
  const fb = { kind: kind === "aprovar" ? "aprovada" : "ajustes", message: msg, at, version: d.version || 1 };
  await patchState(slug, { delivery: { ...d, status: fb.kind, approvedAt: kind === "aprovar" ? at : d.approvedAt, feedback: [...(d.feedback || []), fb].slice(-20) } });
  await addEvent(slug, { type: kind === "aprovar" ? "delivery-approved" : "delivery-changes", message: msg.slice(0, 300), version: fb.version });
  const { googleReady, sendMail } = await import("./google.mts");
  const { mails } = await import("./mails.mts");
  const { notifyOwner } = await import("./signing.mts");
  const to = st.signer?.email || q.client?.email, name = st.signer?.name || q.client?.name;
  const who = q.client?.company || name || slug;
  if (kind === "ajustes") {
    if (googleReady() && to) await sendMail(to, mails.ajustes({ name, title: q.title, message: msg, panel: `${origin}/acompanhar?t=${await clientToken(to)}` }));
    await notifyOwner(`Alterações pedidas na entrega · ${who}`, [`${name || "O cliente"} pediu alterações na versão ${fb.version} de "${q.title || "projeto"}":`, msg, "Faça os ajustes e gere a entrega de novo no Studio: o cliente recebe a nova versão por e-mail."], { href: `https://gustavoelian.com/app/#/c/${slug}`, label: "Abrir no Studio" });
    return { ok: true, status: "ajustes" };
  }
  await notifyOwner(`Entrega aprovada · ${who}`, [`${name || "O cliente"} aprovou a versão ${fb.version} de "${q.title || "projeto"}".`, isPaid(st) ? "Contrato quitado: o certificado e o e-mail de conclusão saíram automaticamente." : "Ainda há saldo: o certificado sai automaticamente quando o pagamento for registrado."], { href: `https://gustavoelian.com/app/#/c/${slug}`, label: "Abrir no Studio" });
  const cert = await issueCertificateIfReady(slug, origin);
  if (!cert && googleReady() && to) {
    const rest = Math.max(0, Number(st.total || 0) - Number(st.paidTotal || 0));
    const r = await sendMail(to, mails.aprovadaComSaldo({ name, title: q.title, rest, payLink: `${origin}/${slug}#pagamento` }));
    await addEvent(slug, { type: r?.ok ? "email-sent" : "email-error", what: "aprovada-saldo", to });
  }
  return { ok: true, status: "aprovada", certificate: cert?.code || null };
}
