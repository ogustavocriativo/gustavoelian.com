# gustavoelian.com: portfólio, app de orçamentos e propostas interativas

Projeto pronto para o Netlify, testado localmente e ainda **não publicado**.

## O que tem aqui

| Endereço | O que é |
|---|---|
| `/` | Portfólio. Projetos vêm de `public/data/projects.json` e são filtrados em Web, Sites, Eventos e Ativação. |
| `/app` | App de orçamentos para o celular. Pode ser adicionado à tela de início do iPhone e é protegido por senha. |
| `/<nome-codigo>` | Proposta do cliente, ex.: `gustavoelian.com/ana-beatriz-rocha-jw4`. |
| `/api/...` | Funções do servidor: orçamentos, arquivos, PDFs, pagamentos e interações. |

## Fluxo

1. No app você cria o orçamento com cliente, serviços, preços, prazos, pacotes, bônus, arquivos e trabalhos relacionados.
2. Ao salvar, o sistema gera o link `nome-do-cliente-código`. Você ativa o link e envia pelo WhatsApp, ou baixa o PDF.
3. O cliente abre o link e pode:
   - escolher o pacote ou os serviços avulsos;
   - escolher entre à vista e cartão (o valor recalcula na hora);
   - ver os trabalhos parecidos;
   - baixar o PDF;
   - comentar;
   - aprovar e assinar (nome, CPF/CNPJ, e-mail, aceite dos termos e assinatura com o dedo);
   - pagar a entrada por Pix;
   - enviar o comprovante.
4. Tudo aparece na aba **Atividade** do app: visualizações, escolhas, comentários, aprovação, comprovante e pagamento.
5. Depois da aprovação, o contrato em PDF fica disponível com o registro do aceite: data e hora, IP, navegador e hash SHA-256 do texto.

## PDF do orçamento
Formato vertical 9:16 (810 × 1440 pt), com 7 seções: capa, apresentação, serviços (pagina sozinho), trabalhos que comprovam a entrega (até 4, com link), condições (pacotes e avulsos), bônus e próximos passos (QR Code da proposta interativa + contato).
O arquivo não tem transparências nem fontes Type 3: pode ser salvo de novo em qualquer leitor sem gerar sobras.

## Variáveis de ambiente (configurar no Netlify na hora da integração)

| Nome | Para quê | Obrigatória |
|---|---|---|
| `ADMIN_PASSWORD` | Senha do app `/app` | Sim |
| `SESSION_SECRET` | Texto aleatório longo que assina o login | Sim |
| `STRIPE_SECRET_KEY` | Liga cartão de crédito, Apple Pay e Google Pay | Não |
| `STRIPE_WEBHOOK_SECRET` | Confirma automaticamente o pagamento com cartão (webhook em `/api/stripe-webhook`) | Junto com a anterior |

A chave Pix, os dados do emissor, a entrada à vista (%) e o modelo de contrato ficam em **Ajustes**, dentro do app.

## Pendências para a integração
- Revisar o modelo de contrato com um advogado.
- Decidir o provedor de cartão. O Stripe já está pronto no código; Mercado Pago ou Asaas exigem adaptação.
- Ligar o domínio gustavoelian.com.
- Definir a estética final da proposta e do PDF. Até aqui, a prioridade foi a funcionalidade.

## Rodar localmente
```
npm install
npm i -g netlify-cli
netlify dev
```
Crie um arquivo `.env` com `ADMIN_PASSWORD` e `SESSION_SECRET`.
