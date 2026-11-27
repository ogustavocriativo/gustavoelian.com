// Modelos de todos os e-mails enviados aos clientes (e os avisos ao Gustavo), num lugar só.
// Cada modelo devolve { subject, title, eyebrow, html, button }: o layout da identidade (email.mts) é aplicado no envio.
// Ordem da jornada: proposta → código → aprovada → assinado → recibo → aditivo → prévia → entrega →
// ajustes recebidos → entrega aprovada (saldo em aberto) → conclusão com certificado e agradecimento. "acesso" é o link do painel.
import { linkCard } from "./email.mts";

const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const first = (n: any) => esc(String(n || "").trim().split(/\s+/)[0] || "");
const hi = (n: any) => `<p>Olá${first(n) ? ", " + first(n) : ""}!</p>`;
const bye = `<p style="margin-top:22px">Um abraço,<br><b>Gustavo Elian</b></p>`;
const brl = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const proj = (t: any) => esc(t || "seu projeto");
const num = (c: any) => (c ? ` (contrato nº ${esc(c)})` : "");
const para = (s: string) => esc(s).replace(/\n/g, "<br>");

/** O que é o certificado e quando chega: repetido nos e-mails do meio da jornada. */
const certInfo = (pending: string) => `<p style="padding:16px 20px;background:#F4F4F5;border-radius:18px;font-size:15px"><b>Sobre o certificado de autoria e cessão de direitos.</b> Ao final do projeto você recebe um certificado que transfere para você, em definitivo, os direitos patrimoniais de uso das peças entregues (Lei nº 9.610/1998), com o código de integridade de cada arquivo. Ele é o documento que comprova que você pode usar, reproduzir e registrar o material. ${pending}</p>`;

export type Mail = { subject: string; title: string; eyebrow: string; html: string; button?: { href: string; label: string } | null };

export const mails = {
  /** 1. Studio → cliente: proposta pronta. */
  proposta: (p: { name: string; title: string; company?: string; link: string }): Mail => ({
    subject: `Sua proposta${p.company ? " · " + p.company : ""} está pronta`, title: "Sua proposta está pronta", eyebrow: "Proposta",
    html: `${hi(p.name)}<p>Preparei a proposta${p.title ? ` de <b>${esc(p.title)}</b>` : ""} com escopo, prazos e formas de pagamento. Pelo link você vê os detalhes, escolhe o que faz sentido e aprova.</p><p>Qualquer dúvida, é só responder este e-mail.</p>${bye}`,
    button: { href: p.link, label: "Ver minha proposta" },
  }),

  /** 2. Código de confirmação do e-mail (assinatura pelo sistema). */
  codigo: (p: { name?: string; title?: string; code: string }): Mail => ({
    subject: `${p.code} é o seu código para assinar`, title: "Código de confirmação", eyebrow: "Assinatura do contrato",
    html: `${hi(p.name)}<p>Use este código para confirmar o seu e-mail e assinar a proposta${p.title ? ` de <b>${esc(p.title)}</b>` : ""}:</p><p style="margin:22px 0;padding:22px 0;background:#F4F4F5;border-radius:20px;text-align:center;font-size:40px;font-weight:500;letter-spacing:.32em;color:#0E0E10">${esc(p.code)}</p><p>Ele vale por 10 minutos. Se não foi você, ignore esta mensagem.</p>`,
  }),

  /** 3. Cliente aprovou a proposta (assinatura pelo Google a caminho). */
  aprovada: (p: { name: string; title: string; link: string; contractNumber?: string }): Mail => ({
    subject: `Proposta aprovada · ${p.title || "seu projeto"}`, title: "Proposta aprovada", eyebrow: "Contrato",
    html: `${hi(p.name)}<p>Recebi a aprovação de <b>${proj(p.title)}</b>${num(p.contractNumber)}. Obrigado pela confiança!</p><p>Em instantes você recebe, <b>do Google</b>, o contrato para assinar eletronicamente. É só abrir esse e-mail, conferir e assinar.</p><p>Depois da assinatura, o pagamento da entrada fica disponível pelo mesmo link da proposta.</p>${bye}`,
    button: { href: p.link, label: "Abrir a proposta" },
  }),

  /** 4. Contrato assinado pelas partes. */
  assinado: (p: { name: string; title: string; payLink: string; contractNumber?: string }): Mail => ({
    subject: `Contrato assinado · ${p.title || "seu projeto"}`, title: "Contrato assinado", eyebrow: "Contrato",
    html: `${hi(p.name)}<p>O contrato de <b>${proj(p.title)}</b>${num(p.contractNumber)} foi assinado pelas duas partes. A cópia assinada, com a trilha de auditoria do Google, segue em anexo e fica também no link da proposta e no seu painel.</p><p>O próximo passo é o pagamento da entrada, pelo mesmo link. Assim que ele for confirmado, começo a produção.</p>${certInfo("Ele é enviado por e-mail depois que você aprovar a entrega final e o pagamento estiver quitado.")}${bye}`,
    button: { href: p.payLink, label: "Pagar a entrada" },
  }),

  /** 5. Recebimento confirmado (recibo). */
  recibo: (p: { name: string; title: string; contractNumber?: string; amount: number; date: string; method: string; paid: number; total: number; id: string; panel: string }): Mail => {
    const rest = Math.max(0, p.total - p.paid);
    return {
      subject: `Recebimento confirmado · ${brl(p.amount)}${p.contractNumber ? " · " + p.contractNumber : ""}`, title: "Recebimento confirmado", eyebrow: "Recibo",
      html: `${hi(p.name)}<p>Confirmo o recebimento de <b>${brl(p.amount)}</b> em ${esc(p.date.split("-").reverse().join("/"))}, por ${esc(p.method)}, referente a <b>${proj(p.title)}</b>${num(p.contractNumber)}.</p><p>Total pago: <b>${brl(p.paid)}</b> de ${brl(p.total)}.${rest > 0.009 ? ` Saldo: <b>${brl(rest)}</b>.` : " <b>Contrato quitado.</b>"}</p><p>Código do lançamento: ${esc(p.id)}. O recibo em PDF segue em anexo.</p>${rest > 0.009 ? certInfo(`Ele é liberado com a quitação do saldo de ${brl(rest)} e a aprovação da entrega final.`) : ""}${bye}`,
      button: { href: p.panel, label: "Ver no meu painel" },
    };
  },

  /** 6. Aditivo de pagamento. */
  aditivo: (p: { name: string; title: string; n: number; channel: string; before: string; after: string; code: string; contractNumber?: string; link: string }): Mail => ({
    subject: `Aditivo ${p.n} · condição de pagamento${p.contractNumber ? " · " + p.contractNumber : ""}`, title: `Aditivo ${p.n} ao contrato`, eyebrow: "Contrato",
    html: `${hi(p.name)}<p>Registrei o que combinamos por ${esc(p.channel)} sobre o pagamento de <b>${proj(p.title)}</b>:</p><p>Antes: ${esc(p.before || "—")}<br>Agora: <b>${esc(p.after)}</b></p><p>As demais cláusulas do contrato continuam as mesmas. O aditivo em PDF segue em anexo e fica também no seu painel.</p><p>Código do aditivo: ${esc(p.code)}…</p>${bye}`,
    button: { href: p.link, label: "Ver o aditivo" },
  }),

  /** 7. Prévia pronta para aprovação (a aprovação da prévia é feita na própria página da prévia). */
  previa: (p: { name: string; title: string; version: number; note?: string; link: string; panel?: string }): Mail => ({
    subject: `Prévia pronta para aprovação · ${p.title || "seu projeto"}${p.version > 1 ? ` · versão ${p.version}` : ""}`, title: "Sua prévia está pronta", eyebrow: `Prévia${p.version > 1 ? ` · versão ${p.version}` : ""}`,
    html: `${hi(p.name)}<p>A ${p.version > 1 ? `versão ${p.version} da ` : ""}prévia de <b>${proj(p.title)}</b> está no ar para você ver com calma, no computador e no celular.</p>${p.note ? `<p><b>O que mudou:</b><br>${para(p.note)}</p>` : ""}<p>No rodapé da prévia há dois botões: <b>Aprovar esta versão</b> ou <b>Pedir ajustes</b>, com espaço para escrever o que mudar. A sua resposta chega direto para mim.</p>${bye}`,
    button: { href: p.link, label: "Ver a prévia" },
  }),

  /** 8. Entrega final: link do sistema/site, manual em anexo e aprovação no painel. */
  entrega: (p: { name: string; title: string; version: number; systemUrl?: string; systemLabel?: string; manualName?: string; manualAttached?: boolean; manualUrl?: string; filesCount: number; note?: string; panel: string; paid: boolean; rest?: number }): Mail => ({
    subject: `Entrega final${p.version > 1 ? ` · versão ${p.version}` : ""} · ${p.title || "seu projeto"}`, title: "Seu projeto foi entregue", eyebrow: `Entrega final${p.version > 1 ? ` · versão ${p.version}` : ""}`,
    html: `${hi(p.name)}<p>A entrega final de <b>${proj(p.title)}</b> está pronta.</p>${p.note ? `<p>${para(p.note)}</p>` : ""}`
      + (p.systemUrl ? linkCard(p.systemUrl, p.systemLabel || "Acessar o projeto", p.systemUrl.replace(/^https?:\/\//, "")) : "")
      + (p.manualName ? linkCard(p.manualUrl || p.panel, "Manual de uso", `${p.manualName}${p.manualAttached ? " · em anexo neste e-mail" : ""}`) : "")
      + (!p.paid && (p.rest || 0) >= 1 ? linkCard(`${p.panel}#pagar`, `Pagar o saldo · ${brl(p.rest || 0)}`, "Pix ou cartão em até 12x · confirmação automática por e-mail") : "")
      + `<p>${p.filesCount ? `Os ${p.filesCount} arquivo(s) da entrega estão no seu painel, cada um com o seu código de integridade. ` : ""}No painel você também <b>aprova a entrega</b> ou <b>pede alterações</b>, descrevendo o que precisa mudar.</p>`
      + certInfo(p.paid ? "Como o contrato já está quitado, ele chega por e-mail assim que você aprovar esta entrega." : "Ele chega por e-mail assim que você aprovar esta entrega e o pagamento for quitado.") + bye,
    button: { href: p.panel, label: "Aprovar ou pedir alterações" },
  }),

  /** 9. Cliente pediu alterações na entrega. */
  ajustes: (p: { name: string; title: string; message: string; panel: string }): Mail => ({
    subject: `Recebi seu pedido de alteração · ${p.title || "seu projeto"}`, title: "Pedido de alteração recebido", eyebrow: "Entrega final",
    html: `${hi(p.name)}<p>Recebi o seu pedido de alteração em <b>${proj(p.title)}</b>:</p><p style="padding:16px 20px;background:#F4F4F5;border-radius:18px">${para(p.message)}</p><p>Vou trabalhar nos ajustes e envio uma nova versão da entrega por e-mail, para você aprovar.</p>${bye}`,
    button: { href: p.panel, label: "Ver no meu painel" },
  }),

  /** 10. Entrega aprovada, ainda com saldo: o certificado sai com a quitação. */
  aprovadaComSaldo: (p: { name: string; title: string; rest: number; payLink: string }): Mail => ({
    subject: `Entrega aprovada · ${p.title || "seu projeto"}`, title: "Entrega aprovada", eyebrow: "Entrega final",
    html: `${hi(p.name)}<p>Obrigado por aprovar a entrega de <b>${proj(p.title)}</b>!</p><p>Falta o saldo de <b>${brl(p.rest)}</b>. Assim que o pagamento for confirmado, envio o <b>certificado de autoria e cessão de direitos</b>, que conclui o projeto.</p>${certInfo(`Ele é enviado automaticamente quando o saldo de ${brl(p.rest)} for confirmado.`)}${bye}`,
    button: { href: p.payLink, label: "Pagar o saldo" },
  }),

  /** 11. Último e-mail: agradecimento e certificado (entrega aprovada e contrato quitado). */
  conclusao: (p: { name: string; title: string; contractNumber?: string; certCode: string; certUrl: string; panel: string; systemUrl?: string }): Mail => ({
    subject: `Obrigado! Seu certificado de cessão de direitos · ${p.title || "seu projeto"}`, title: "Obrigado pela parceria", eyebrow: "Projeto concluído",
    html: `${hi(p.name)}<p>Com a entrega aprovada e o contrato${p.contractNumber ? ` nº ${esc(p.contractNumber)}` : ""} quitado, <b>${proj(p.title)}</b> está concluído. Foi um prazer construir este projeto com você.</p>`
      + linkCard(p.certUrl, `Certificado nº ${esc(p.certCode)}`, "Autoria e cessão de direitos patrimoniais · verificável por qualquer pessoa")
      + `<p>O certificado registra a cessão dos direitos de uso das peças entregues, com o código de integridade de cada arquivo. O certificado em PDF segue em anexo; guarde-o junto dos arquivos. Ele fica também no seu painel.</p><p>Se precisar de algo daqui para frente, uma nova peça, um ajuste ou uma indicação, é só responder este e-mail ou me chamar no WhatsApp. E se puder, conte como foi a experiência: isso me ajuda muito.</p><p style="margin-top:22px">Muito obrigado,<br><b>Gustavo Elian</b></p>`,
    button: { href: p.panel, label: "Abrir meu painel" },
  }),

  /** 13. Três dias depois da conclusão: pedido de avaliação (escrita no painel, publicada no site só com aprovação). */
  avaliacao: (p: { name: string; title: string; link: string }): Mail => ({
    subject: `Como foi o projeto? Deixe sua avaliação · ${p.title || "seu projeto"}`, title: "Como foi trabalhar comigo?", eyebrow: "Avaliação",
    html: `${hi(p.name)}<p>Já faz alguns dias desde a conclusão de <b>${proj(p.title)}</b>. Espero que esteja tudo funcionando como você imaginou.</p><p>Queria pedir um favor rápido: conte, em poucas linhas, como foi a experiência. Leva dois minutos e é feito no seu painel, com uma nota de 1 a 5 e uma mensagem.</p><p>Com a sua autorização, a avaliação pode aparecer no meu site, com o seu nome. Isso ajuda muito outras pessoas a decidirem com segurança.</p>${bye}`,
    button: { href: p.link, label: "Deixar minha avaliação" },
  }),

  /** 12. Link de acesso ao painel do cliente. */
  acesso: (p: { name: string; link: string }): Mail => ({
    subject: "Seu acesso para acompanhar o projeto", title: "Acompanhe o seu projeto", eyebrow: "Área do cliente",
    html: `${hi(p.name)}<p>Por este link você acompanha a etapa do projeto, os prazos, os pagamentos, as entregas e o certificado. Ele vale por 14 dias; depois é só pedir outro no site.</p>`,
    button: { href: p.link, label: "Abrir meu painel" },
  }),
};

/** Dados de exemplo para a galeria de modelos no Studio. */
export function sampleMails(origin: string) {
  const n = "Julia Alves Barbosa", t = "Site institucional e identidade visual", panel = `${origin}/acompanhar`, link = `${origin}/julia-alves-barbosa`;
  return [
    ["Proposta enviada", mails.proposta({ name: n, title: t, company: "Julia Barbosa Fotografia", link })],
    ["Código de confirmação", mails.codigo({ name: n, title: t, code: "482913" })],
    ["Proposta aprovada", mails.aprovada({ name: n, title: t, link, contractNumber: "GE-7KQM-3XPA" })],
    ["Contrato assinado", mails.assinado({ name: n, title: t, payLink: `${link}#pagamento`, contractNumber: "GE-7KQM-3XPA" })],
    ["Recibo", mails.recibo({ name: n, title: t, contractNumber: "GE-7KQM-3XPA", amount: 2160, date: "2026-11-27", method: "Pix", paid: 2160, total: 3600, id: "a1b2c3d4", panel })],
    ["Aditivo", mails.aditivo({ name: n, title: t, n: 1, channel: "WhatsApp", before: "à vista, 60% + 40%", after: "3 parcelas de R$ 1.200,00", code: "9f3c1a7e2b4d6f80", contractNumber: "GE-7KQM-3XPA", link })],
    ["Prévia", mails.previa({ name: n, title: t, version: 2, note: "Ajustei as cores do menu e troquei a foto da página inicial.", link: `${origin}/v/julia-barbosa-site` })],
    ["Entrega final", mails.entrega({ name: n, title: t, version: 1, systemUrl: "https://juliabarbosafotografia.com.br", systemLabel: "Acessar o site", manualName: "Guia de uso do site.pdf", manualAttached: true, filesCount: 3, panel, paid: false, rest: 1440 })],
    ["Pedido de alteração", mails.ajustes({ name: n, title: t, message: "Trocar a foto da seção Sobre e corrigir o telefone do rodapé.", panel })],
    ["Entrega aprovada com saldo", mails.aprovadaComSaldo({ name: n, title: t, rest: 1440, payLink: `${panel}#pagar` })],
    ["Conclusão e certificado", mails.conclusao({ name: n, title: t, contractNumber: "GE-7KQM-3XPA", certCode: "X6DJ-77E2", certUrl: `${origin}/certificado?c=X6DJ-77E2`, panel })],
    ["Pedido de avaliação (3 dias após a conclusão)", mails.avaliacao({ name: n, title: t, link: `${panel}#avaliar` })],
    ["Acesso ao painel", mails.acesso({ name: n, link: panel })],
  ] as [string, Mail][];
}
