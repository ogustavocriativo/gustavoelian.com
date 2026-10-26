// Monta o texto do contrato a partir do modelo + proposta + seleção do cliente.
import { brl, priceOf, type Quote } from "./core.mts";

export function paymentLabel(q: Quote, settings: any, sel: any) {
  const p = priceOf(q, sel || {});
  const entryPct = Number(settings.payments?.entryPct ?? 60);
  if (sel?.method === "cartao") {
    const n = Math.max(1, p.installments);
    return { total: p.card, text: `cartão de crédito, ${brl(p.card)} em até ${n}x de ${brl(p.card / n)}` };
  }
  const entry = (p.cash * entryPct) / 100;
  return { total: p.cash, text: `à vista, ${brl(p.cash)}: entrada de ${entryPct}% (${brl(entry)}) e ${100 - entryPct}% (${brl(p.cash - entry)}) na entrega final e aprovação` };
}

export function buildContract(q: Quote, settings: any, signer: any, sel: any) {
  const tpl = (q.contract?.text || "").trim() || settings.contractTemplate;
  const p = priceOf(q, sel || {});
  const items = (q.items || []).filter((i: any) => p.itemIds.includes(i.id));
  const pay = paymentLabel(q, settings, sel);
  const map: Record<string, string> = {
    cliente: signer?.name || q.client?.name || "",
    documento: signer?.doc ? `, inscrito(a) sob o documento ${signer.doc}` : ", (documento informado no aceite)",
    email: signer?.email || q.client?.email || "",
    endereco: signer?.address || "(endereço informado no aceite)",
    telefone: signer?.phone ? `, WhatsApp ${signer.phone}` : "",
    emissor_endereco: settings.issuer.address || settings.issuer.city || "",
    emissor_email: settings.issuer.email || "",
    cidade: settings.issuer.city || "Montes Claros",
    especificas: (q.contract?.extra || "").trim() || "Não há condições específicas além das descritas na proposta.",
    emissor: settings.issuer.name,
    emissor_doc: settings.issuer.doc,
    servicos: items.map((i: any, n: number) => `(${n + 1}) ${i.title}${i.deadline ? `, prazo de ${i.deadline}` : ""}`).join("; "),
    valor: brl(pay.total),
    pagamento: pay.text,
    prazo: items.map((i: any) => i.deadline).filter(Boolean).join("; "),
    data: new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    proposta: q.slug,
  };
  return tpl.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => map[k] ?? "");
}
