/**
 * Ponte Studio gustavoelian.com ↔ Gmail e Google Drive
 * Roda na conta de quem publica (contato@gustavoelian.com). O site chama este script com uma chave secreta.
 *
 * Instalação (uma vez):
 * 1. script.google.com › Novo projeto › cole este arquivo inteiro no lugar do código de exemplo.
 * 2. Escolha a função "configurar" na barra de cima e clique em Executar. Autorize o acesso.
 *    Ela cria a chave secreta, as pastas @adm › @clientes e mostra a chave no Registro de execução.
 * 3. Implantar › Nova implantação › tipo "App da Web":
 *      Executar como: Eu · Quem pode acessar: Qualquer pessoa
 *    Autorize o acesso ao Gmail e ao Drive quando o Google pedir.
 * 4. Copie o endereço que termina em /exec e cadastre no Netlify como GOOGLE_SCRIPT_URL.
 *
 * Pastas: Meu Drive › @adm › @clientes › <Cliente> › Contrato (criadas sozinhas quando faltam).
 */

var ROOT_PATH = ["@adm", "@clientes"];

/* Rode uma vez: gera a chave (se ainda não existe), cria as pastas e testa Gmail e Drive. */
function configurar() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("SECRET");
  if (!key || key.length < 24) {
    key = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 16);
    props.setProperty("SECRET", key);
  }
  var pasta = folderPath_(ROOT_PATH);
  GmailApp.getAliases(); // pede a permissão do Gmail já agora
  Logger.log("Conta: " + Session.getEffectiveUser().getEmail());
  Logger.log("Pasta dos clientes: " + pasta.getUrl());
  Logger.log("COPIE ESTA CHAVE para o Netlify como GOOGLE_SCRIPT_SECRET: " + key);
}
var SENDER_NAME = "Gustavo Elian";

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var secret = PropertiesService.getScriptProperties().getProperty("SECRET");
    if (!secret || body.secret !== secret) return out_({ ok: false, error: "Chave inválida" });
    if (body.action === "ping") return out_({ ok: true, user: Session.getEffectiveUser().getEmail() });
    if (body.action === "email") return out_(sendEmail_(body));
    if (body.action === "contract") return out_(contract_(body));
    return out_({ ok: false, error: "Ação desconhecida" });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- e-mail ---------- */
function sendEmail_(b) {
  var to = String(b.to || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: "E-mail do destinatário inválido" };
  var opts = { name: SENDER_NAME, htmlBody: layout_(b.title || b.subject, b.html || "", b.button) };
  if (b.cc) opts.cc = b.cc;
  if (b.replyTo) opts.replyTo = b.replyTo;
  if (b.pdfFileId) opts.attachments = [DriveApp.getFileById(b.pdfFileId).getBlob()];
  GmailApp.sendEmail(to, String(b.subject || "Mensagem de Gustavo Elian").slice(0, 200), b.text || stripHtml_(b.html || ""), opts);
  return { ok: true };
}

/* ---------- contrato: Doc + PDF na pasta do cliente + e-mail ---------- */
function contract_(b) {
  var clientName = clean_(b.client || "Cliente");
  var folder = folderPath_(ROOT_PATH.concat([clientName, "Contrato"]));
  var date = String(b.date || new Date().toISOString()).slice(0, 10);
  var title = date + " · " + clientName + " · Contrato";

  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  body.setMarginTop(56).setMarginBottom(56).setMarginLeft(64).setMarginRight(64);
  body.appendParagraph("Contrato de prestação de serviços").setHeading(DocumentApp.ParagraphHeading.HEADING1);
  String(b.text || "").split(/\n/).forEach(function (line) { body.appendParagraph(line); });

  body.appendParagraph("").appendHorizontalRule();
  body.appendParagraph("Assinatura eletrônica").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  var s = b.signer || {};
  if (b.signatureImage && /^data:image\/(png|jpeg);base64,/.test(b.signatureImage)) {
    var bytes = Utilities.base64Decode(b.signatureImage.split(",")[1]);
    var img = body.appendParagraph("").appendInlineImage(Utilities.newBlob(bytes, "image/png", "assinatura.png"));
    var w = img.getWidth(), h = img.getHeight(), k = Math.min(1, 260 / w);
    img.setWidth(w * k).setHeight(h * k);
  }
  [
    "Nome: " + (s.name || ""),
    "CPF/CNPJ: " + (s.doc || ""),
    "Endereço: " + (s.address || ""),
    "E-mail: " + (s.email || ""),
    "Assinado em: " + (b.approvedAt || ""),
    "IP: " + (s.ip || "") + (s.city ? " · " + s.city : ""),
    "Código de integridade do texto (SHA-256): " + (b.hash || ""),
    "Proposta: " + (b.link || ""),
  ].forEach(function (t) { body.appendParagraph(t).editAsText().setFontSize(9); });
  doc.saveAndClose();

  var docFile = DriveApp.getFileById(doc.getId());
  docFile.moveTo(folder);
  var pdf = folder.createFile(docFile.getAs("application/pdf").setName(title + ".pdf"));

  // cópia para o cliente e para você
  var recipients = [s.email, b.ownerEmail].filter(function (x) { return x && /@/.test(x); });
  if (recipients.length && b.sendEmail !== false) {
    GmailApp.sendEmail(recipients.join(","), "Contrato assinado · " + clientName,
      "Segue em anexo a cópia do contrato assinado.",
      { name: SENDER_NAME, attachments: [pdf.getBlob()],
        htmlBody: layout_("Contrato assinado", "<p>Olá" + (s.name ? ", " + esc_(s.name.split(" ")[0]) : "") + "!</p><p>Segue em anexo a cópia do contrato assinado. O próximo passo é o pagamento da entrada, pelo mesmo link da proposta.</p>", b.link ? { href: b.link, label: "Abrir a proposta" } : null) });
  }
  return { ok: true, docUrl: doc.getUrl(), pdfUrl: pdf.getUrl(), pdfId: pdf.getId(), folderUrl: folder.getUrl() };
}

/* ---------- utilidades ---------- */
function folderPath_(names) {
  var f = DriveApp.getRootFolder();
  names.forEach(function (n) {
    var it = f.getFoldersByName(n);
    f = it.hasNext() ? it.next() : f.createFolder(n);
  });
  return f;
}
function clean_(s) { return String(s).replace(/[\\/:*?"<>|#]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Cliente"; }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function stripHtml_(h) { return String(h).replace(/<br\s*\/?>/g, "\n").replace(/<\/p>/g, "\n\n").replace(/<[^>]+>/g, "").trim(); }
function layout_(title, html, button) {
  var btn = button && button.href ? '<p style="margin:28px 0 8px"><a href="' + esc_(button.href) + '" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#0E0E10;color:#fff;text-decoration:none;font-weight:600">' + esc_(button.label || "Abrir") + "</a></p>" : "";
  return '<div style="background:#F4F4F5;padding:32px 12px;font-family:Helvetica,Arial,sans-serif;color:#0E0E10">' +
    '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:24px;padding:32px 28px">' +
    '<p style="margin:0 0 20px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#55575E">@gustavoelian</p>' +
    '<h1 style="margin:0 0 16px;font-size:24px;font-weight:400;letter-spacing:-.02em">' + esc_(title || "") + "</h1>" +
    '<div style="font-size:15px;line-height:1.6;color:#2E2F33">' + html + "</div>" + btn +
    '<p style="margin:28px 0 0;font-size:12px;color:#6B6E76">Gustavo Elian · gustavoelian.com · (38) 98412-0719</p></div></div>';
}
