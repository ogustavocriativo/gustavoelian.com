// Núcleo compartilhado pelas functions: armazenamento, sessão do admin, utilidades.
import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

/* ---------- Armazenamento (Netlify Blobs) ----------
   quotes   → quotes/<slug>          orçamento completo (escrito só pelo admin)
   state    → <slug>                 estado público (visto, seleção, aprovado, pago)
   events   → <slug>/<ts>-<rand>     linha do tempo de interações (append-only)
   files    → <slug>/<fileId>        anexos binários
   settings → main                   configurações do emissor */
export const store = (name: string) => getStore({ name, consistency: "strong" });
export const quotes = () => store("quotes");
export const states = () => store("state");
export const events = () => store("events");
export const files = () => store("files");
export const settingsStore = () => store("settings");

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
export const fail = (message: string, status = 400) => json({ error: message }, status);

/* ---------- Sessão do admin (cookie assinado com HMAC) ---------- */
const COOKIE = "ge_session";
// Sem SESSION_SECRET configurado, ninguém entra (falha fechada): nunca usar uma chave padrão em produção.
const secret = () => { const v = Netlify.env.get("SESSION_SECRET"); if (!v || v.length < 24) throw new Error("SESSION_SECRET ausente"); return v; };
const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
export async function createSession(context: Context) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 dias
  const payload = `admin.${exp}`;
  const token = `${payload}.${await hmac(payload)}`;
  context.cookies.set({ name: COOKIE, value: token, httpOnly: true, secure: true, sameSite: "Lax", path: "/", expires: new Date(exp) });
}
/* Acesso do cliente ao painel "Acompanhar": link assinado por e-mail, válido por 14 dias */
export async function clientToken(email: string, days = 14) {
  const exp = Date.now() + days * 864e5;
  const payload = `c.${Buffer.from(email.toLowerCase()).toString("base64url")}.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}
export async function readClientToken(token: string) {
  if ((Netlify.env.get("SESSION_SECRET") || "").length < 24) return null;
  const parts = String(token || "").split(".");
  if (parts.length !== 4 || parts[0] !== "c") return null;
  const payload = parts.slice(0, 3).join(".");
  if ((await hmac(payload)) !== parts[3] || Number(parts[2]) < Date.now()) return null;
  return Buffer.from(parts[1], "base64url").toString();
}
export function clearSession(context: Context) {
  context.cookies.delete({ name: COOKIE, path: "/" });
}
export async function isAdmin(context: Context) {
  const token = context.cookies.get(COOKIE);
  if (!token) return false;
  if ((Netlify.env.get("SESSION_SECRET") || "").length < 24) return false;
  const i = token.lastIndexOf(".");
  const payload = token.slice(0, i), sig = token.slice(i + 1);
  if ((await hmac(payload)) !== sig) return false;
  const exp = Number(payload.split(".")[1]);
  return exp > Date.now();
}
export function checkPassword(pw: string) {
  const expected = Netlify.env.get("ADMIN_PASSWORD");
  if (!expected) return false;
  // comparação em tempo constante
  const a = enc.encode(pw), b = enc.encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ---------- Identificadores ---------- */
export function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cliente";
}
export function shortCode(n = 3) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // sem caracteres ambíguos
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
export const uid = () => Date.now().toString(36) + shortCode(4);
export const SLUG_RE = /^[a-z0-9-]{3,60}$/;

/* ---------- Leitura de dados ---------- */
export type Quote = Record<string, any>;
export async function getQuote(slug: string): Promise<Quote | null> {
  if (!SLUG_RE.test(slug)) return null;
  return (await quotes().get(`quotes/${slug}`, { type: "json" })) as Quote | null;
}
/* Links trocados: o endereço antigo continua levando à proposta (aliases → <antigo> = { to: <novo> }). */
export const aliases = () => store("aliases");
export async function aliasOf(slug: string): Promise<string | null> {
  if (!SLUG_RE.test(slug)) return null;
  const a: any = await aliases().get(slug, { type: "json" });
  return a?.to || null;
}
export async function getState(slug: string) {
  return ((await states().get(slug, { type: "json" })) as Record<string, any>) || {};
}
export async function patchState(slug: string, patch: Record<string, any>) {
  const cur = await getState(slug);
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  await states().setJSON(slug, next);
  return next;
}
export async function addEvent(slug: string, ev: Record<string, any>) {
  const at = new Date().toISOString();
  const key = `${slug}/${Date.now().toString().padStart(15, "0")}-${shortCode(4)}`;
  const full = { ...ev, slug, at, id: key };
  await events().setJSON(key, full);
  return full;
}
export async function listEvents(slug?: string) {
  const { blobs } = await events().list(slug ? { prefix: `${slug}/` } : {});
  const out = await Promise.all(blobs.map((b) => events().get(b.key, { type: "json" })));
  return (out.filter(Boolean) as any[]).sort((a, b) => (a.at < b.at ? 1 : -1));
}

export const LEGACY_CONTRACT = `CONTRATANTE: {{cliente}}{{documento}}.
CONTRATADO: {{emissor}}, {{emissor_doc}}.

1. OBJETO. O CONTRATADO prestará ao CONTRATANTE os seguintes serviços: {{servicos}}.

2. VALOR E PAGAMENTO. O valor total é de {{valor}}, na condição {{pagamento}}.

3. PRAZOS. Os prazos de entrega são os descritos na proposta e começam a contar a partir da confirmação do pagamento da entrada e do envio dos materiais necessários pelo CONTRATANTE.

4. AJUSTES. Estão incluídas as rodadas de ajuste previstas na proposta. Novas demandas fora do escopo serão orçadas à parte.

5. DIREITOS DE USO. Após a quitação integral, o CONTRATANTE recebe o direito de uso das peças entregues. O CONTRATADO pode exibir o trabalho em seu portfólio, salvo pedido expresso em contrário.

6. CANCELAMENTO. Em caso de cancelamento pelo CONTRATANTE após o início dos trabalhos, o valor da entrada não será devolvido.

7. ACEITE ELETRÔNICO. As partes reconhecem a validade do aceite eletrônico deste instrumento, com registro de nome, documento, e-mail, data, hora, endereço IP e código de verificação do documento.`;

export const DEFAULT_SETTINGS = {
  issuer: {
    name: "Gustavo Elian",
    doc: "CNPJ 56.891.693/0001-04",
    email: "contato@gustavoelian.com",
    site: "gustavoelian.com",
    whatsapp: "5538984120719",
    whatsappLabel: "(38) 98412-0719",
    city: "Montes Claros",
    address: "Rua José Luiz Xavier, 530, Ibituruna, Montes Claros/MG",
  },
  pix: { key: "", merchantName: "GUSTAVO ELIAN", merchantCity: "MONTES CLAROS" },
  payments: { entryPct: 60, maxInstallments: 5 },
  contractTemplate: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESIGN, BRANDING E COMUNICAÇÃO
Proposta nº {{proposta}}

CONTRATANTE: {{cliente}}{{documento}}, com endereço em {{endereco}}, e-mail {{email}}{{telefone}}.
CONTRATADO: {{emissor}}, {{emissor_doc}}, com endereço em {{emissor_endereco}}, e-mail {{emissor_email}}.

As partes acima identificadas firmam este contrato, que se rege pelas cláusulas a seguir e pela proposta nº {{proposta}}, que o integra como anexo.

1. OBJETO
1.1. O CONTRATADO prestará ao CONTRATANTE os seguintes serviços: {{servicos}}, conforme o escopo descrito na proposta.
1.2. Somente os itens descritos na proposta fazem parte deste contrato. Qualquer pedido fora desse escopo será orçado e aprovado por escrito antes de ser executado, com prazo e valor próprios.
1.3. Salvo previsão expressa na proposta, não estão incluídos: impressão e produção gráfica, mídia paga, compra de fontes, imagens ou recursos licenciados, taxas de registro (INPI), hospedagem, domínio e despesas de terceiros.

2. VALOR, PAGAMENTO E ATRASO
2.1. O valor total é de {{valor}}, na condição: {{pagamento}}.
2.2. Os pagamentos são feitos por Pix, cartão de crédito pelo link da proposta ou transferência para a conta do CONTRATADO. Comprovantes devem ser enviados pelo próprio link da proposta ou por e-mail.
2.3. Em caso de atraso, incidem multa de 2% (dois por cento) sobre a parcela vencida, juros de mora de 1% (um por cento) ao mês, calculados dia a dia, e correção monetária pelo IPCA.
2.4. Com atraso superior a 15 (quinze) dias, o CONTRATADO pode suspender os trabalhos e as entregas até a regularização, e os prazos ficam suspensos pelo mesmo período.
2.5. A nota fiscal é emitida conforme os pagamentos recebidos.

3. PRAZOS E CRONOGRAMA
3.1. Prazos de entrega: {{prazo}}. Os prazos começam a contar após a confirmação do pagamento da entrada e o recebimento dos materiais e informações necessários.
3.2. Atrasos do CONTRATANTE no envio de materiais, nas respostas ou nas aprovações prorrogam os prazos do CONTRATADO pelo mesmo período.
3.3. Se o CONTRATANTE ficar 30 (trinta) dias corridos sem responder a uma solicitação formal, o projeto será considerado encerrado na etapa em que estiver, sendo devidos os valores correspondentes ao que já foi produzido. A retomada depende de nova agenda e pode ter valores atualizados.

4. APROVAÇÕES E AJUSTES
4.1. As entregas são apresentadas pelo painel de acompanhamento, por e-mail ou por WhatsApp. O CONTRATANTE tem 3 (três) dias úteis para aprovar ou pedir ajustes.
4.2. Sem manifestação nesse prazo, a entrega é considerada aprovada.
4.3. Estão incluídas as rodadas de ajuste previstas na proposta. Na falta de previsão, são 2 (duas) rodadas por entrega, dentro do briefing aprovado. Mudanças de direção, de briefing ou de conteúdo já aprovado são consideradas novo trabalho.

5. OBRIGAÇÕES DO CONTRATANTE
a) Fornecer informações, materiais e acessos verdadeiros, completos e dos quais tenha direito de uso;
b) Efetuar os pagamentos nas datas combinadas;
c) Indicar uma pessoa responsável pelas aprovações;
d) Responder integralmente, civil e criminalmente, pelo conteúdo que fornecer ou solicitar (textos, imagens, preços, promessas comerciais e informações técnicas), inclusive perante consumidores, terceiros e órgãos reguladores;
e) Arcar com despesas de deslocamento, hospedagem e alimentação quando houver serviço fora de {{cidade}}, mediante aprovação prévia.

6. OBRIGAÇÕES DO CONTRATADO
a) Executar os serviços com zelo, técnica e profissionalismo, dentro dos prazos;
b) Manter o CONTRATANTE informado sobre o andamento pelo painel de acompanhamento;
c) Entregar os arquivos finais nos formatos previstos na proposta;
d) Utilizar apenas fontes, imagens e recursos com licença adequada ao uso contratado;
e) Preservar a imagem do CONTRATANTE em todas as etapas do trabalho.

7. PROPRIEDADE INTELECTUAL E DIREITOS DE USO (Lei nº 9.610/1998)
7.1. Após a quitação integral, o CONTRATADO cede ao CONTRATANTE, em caráter definitivo, os direitos patrimoniais de uso das peças finais aprovadas, para as finalidades descritas na proposta. Antes da quitação integral, o uso das peças não é autorizado.
7.2. Estudos, esboços, alternativas não escolhidas e arquivos de trabalho continuam pertencendo ao CONTRATADO. Arquivos abertos ou editáveis só são entregues quando previstos na proposta.
7.3. A autoria é preservada. O CONTRATADO pode exibir o trabalho em portfólio, redes sociais e premiações após o lançamento público, salvo pedido de sigilo feito por escrito.
7.4. O registro de marca no INPI é de responsabilidade e custo do CONTRATANTE, salvo se contratado. O CONTRATADO não garante a concessão do registro, que depende exclusivamente de análise do INPI.
7.5. Fontes, imagens e demais recursos de terceiros seguem as licenças dos respectivos titulares.

8. SIGILO E DADOS PESSOAIS (Lei nº 13.709/2018)
8.1. As partes manterão sigilo sobre informações estratégicas, comerciais e financeiras recebidas, durante o contrato e por 2 (dois) anos após o seu término.
8.2. Os dados pessoais informados são usados apenas para a execução deste contrato, a emissão de documentos fiscais e o cumprimento de obrigações legais.

9. RESPONSABILIDADES
9.1. O CONTRATADO se compromete com a qualidade técnica e estratégica do trabalho, mas não garante resultados comerciais, como vendas, alcance, engajamento ou conversão, que dependem de fatores externos e da operação do CONTRATANTE.
9.2. O CONTRATADO não responde por falhas de plataformas de terceiros, por materiais fornecidos pelo CONTRATANTE ou por terceiros indicados por ele, nem por lucros cessantes. Sua responsabilidade fica limitada ao valor efetivamente pago neste contrato.
9.3. Este contrato não gera vínculo empregatício nem exclusividade entre as partes.

10. RESCISÃO
10.1. Qualquer parte pode rescindir este contrato mediante aviso por escrito com 15 (quinze) dias de antecedência; para serviços mensais, 30 (trinta) dias.
10.2. Na rescisão, são devidos os serviços prestados até a data, proporcionalmente às etapas realizadas. A entrada remunera a reserva de agenda e o trabalho inicial e não é devolvida após o início dos trabalhos, ressalvado o item 10.4.
10.3. O CONTRATANTE recebe os materiais finalizados e pagos até a data da rescisão.
10.4. Quando a contratação for feita à distância por pessoa física, o CONTRATANTE pode desistir em até 7 (sete) dias da assinatura, com devolução dos valores pagos (art. 49 do Código de Defesa do Consumidor).
10.5. O descumprimento grave de qualquer cláusula, não corrigido em até 5 (cinco) dias após notificação, permite a rescisão imediata pela parte prejudicada.

11. CONDIÇÕES ESPECÍFICAS
{{especificas}}

12. COMUNICAÇÕES
Valem como comunicação formal entre as partes as mensagens enviadas aos e-mails e WhatsApp informados neste contrato e os registros do painel de acompanhamento em gustavoelian.com/acompanhar.

13. ASSINATURA ELETRÔNICA
13.1. As partes reconhecem a validade da assinatura eletrônica deste contrato, nos termos da Lei nº 14.063/2020 e do art. 10, § 2º, da MP nº 2.200-2/2001.
13.2. O aceite do CONTRATANTE fica registrado com nome, documento, endereço, e-mail, data, hora, endereço IP, localização aproximada, dispositivo, assinatura desenhada e código de integridade (SHA-256) do texto aceito. Qualquer alteração posterior no texto invalida o código.
13.3. O CONTRATADO manifesta sua concordância ao emitir a proposta e este contrato. Ambas as partes recebem uma cópia em PDF.

14. FORO
Fica eleito o foro da comarca de {{cidade}}/MG para resolver qualquer questão oriunda deste contrato.

{{cidade}}, {{data}}.`,
};
export async function getSettings() {
  const saved = ((await settingsStore().get("main", { type: "json" })) as any) || {};
  return {
    ...DEFAULT_SETTINGS, ...saved,
    issuer: { ...DEFAULT_SETTINGS.issuer, ...(saved.issuer || {}) },
    pix: { ...DEFAULT_SETTINGS.pix, ...(saved.pix || {}) },
    payments: { ...DEFAULT_SETTINGS.payments, ...(saved.payments || {}) },
    // modelo antigo salvo sem edição passa a usar o modelo atual
    contractTemplate: !saved.contractTemplate || saved.contractTemplate.trim() === LEGACY_CONTRACT.trim() ? DEFAULT_SETTINGS.contractTemplate : saved.contractTemplate,
  };
}

/* ---------- Cálculos de preço (mesma regra no app, na página e no PDF) ---------- */
export function priceOf(q: Quote, sel: { packageId?: string | null; itemIds?: string[] }) {
  const items = q.items || [];
  if (sel.packageId) {
    const p = (q.packages || []).find((x: any) => x.id === sel.packageId);
    if (p) {
      const full = items.filter((i: any) => p.itemIds.includes(i.id)).reduce((s: number, i: any) => s + Number(i.price || 0), 0);
      return { label: p.name, itemIds: p.itemIds, full, cash: Number(p.cash || full), card: Number(p.card || p.cash || full), installments: Number(p.installments || 1) };
    }
  }
  const ids = sel.itemIds?.length ? sel.itemIds : items.map((i: any) => i.id);
  const chosen = items.filter((i: any) => ids.includes(i.id));
  const full = chosen.reduce((s: number, i: any) => s + Number(i.price || 0), 0);
  return { label: chosen.map((i: any) => i.title).join(" + "), itemIds: ids, full, cash: full, card: full, installments: Number(q.defaultInstallments || 1) };
}
export const brl = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function sha256(text: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", enc.encode(text))).toString("hex");
}
