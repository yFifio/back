import nodemailer from 'nodemailer';
// ---------------------------------------------------------------------------
// Transporter (criado apenas quando as variáveis de ambiente estão definidas)
// ---------------------------------------------------------------------------
function criarTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass)
        return null;
    return nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
    });
}
async function enviar(options) {
    const transporter = criarTransporter();
    if (!transporter) {
        console.warn('[Mailer] SMTP não configurado. E-mail não enviado:', options.subject);
        return;
    }
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@loja.com';
    await transporter.sendMail({ from, ...options });
}
// ---------------------------------------------------------------------------
// Helpers de template
// ---------------------------------------------------------------------------
function layoutBase(titulo, corpo) {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f7; font-family: 'Segoe UI', Arial, sans-serif; color: #333; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.10); }
    .header { background: linear-gradient(135deg, #6c2ea8, #d946ef); padding: 36px 32px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; letter-spacing: .5px; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,.85); font-size: 14px; }
    .body { padding: 28px 32px; }
    .body p { font-size: 15px; line-height: 1.6; margin: 0 0 12px; }
    .info-box { background: #f9f5ff; border-left: 4px solid #a855f7; border-radius: 6px; padding: 14px 18px; margin: 18px 0; }
    .info-box p { margin: 4px 0; font-size: 14px; }
    table.itens { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px; }
    table.itens th { background: #f3e8ff; color: #7c3aed; text-align: left; padding: 8px 12px; }
    table.itens td { padding: 8px 12px; border-bottom: 1px solid #f0e6ff; }
    table.itens tr:last-child td { border-bottom: none; }
    .total-row td { font-weight: bold; color: #6c2ea8; background: #faf5ff; }
    .badge { display: inline-block; padding: 5px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; }
    .badge-pending  { background: #fef3c7; color: #b45309; }
    .badge-paid     { background: #dcfce7; color: #166534; }
    .badge-shipped  { background: #dbeafe; color: #1d4ed8; }
    .footer { background: #f9f5ff; padding: 20px 32px; text-align: center; font-size: 12px; color: #888; }
    .footer a { color: #a855f7; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🎨 Biblioteca Brincar</h1>
      <p>${titulo}</p>
    </div>
    <div class="body">
      ${corpo}
    </div>
    <div class="footer">
      <p>Você está recebendo este e-mail pois realizou uma compra na <strong>Biblioteca Brincar</strong>.</p>
      <p>Dúvidas? Entre em contato: <a href="mailto:${process.env.SMTP_FROM || process.env.SMTP_USER || 'contato@loja.com'}">${process.env.SMTP_FROM || process.env.SMTP_USER || 'contato@loja.com'}</a></p>
    </div>
  </div>
</body>
</html>`.trim();
}
function tabelaItens(itens) {
    const linhas = itens.map(i => `
    <tr>
      <td>${i.product_name}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">R$ ${Number(i.price_at_purchase).toFixed(2).replace('.', ',')}</td>
      <td style="text-align:right">R$ ${(Number(i.price_at_purchase) * i.quantity).toFixed(2).replace('.', ',')}</td>
    </tr>`).join('');
    return `
    <table class="itens">
      <thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unitário</th><th style="text-align:right">Subtotal</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}
function infoPedido(pedido) {
    const endereco = pedido.delivery_address
        ? `${pedido.delivery_address}${pedido.delivery_city ? ', ' + pedido.delivery_city : ''}${pedido.delivery_state ? ' - ' + pedido.delivery_state : ''}${pedido.delivery_zip ? ', CEP ' + pedido.delivery_zip : ''}`
        : null;
    return `
    <div class="info-box">
      <p><strong>Pedido:</strong> #${pedido.id}</p>
      <p><strong>Cliente:</strong> ${pedido.customer_name || pedido.customer_email}</p>
      ${pedido.coupon_code ? `<p><strong>Cupom aplicado:</strong> ${pedido.coupon_code} (desconto: R$ ${Number(pedido.discount_amount || 0).toFixed(2).replace('.', ',')})</p>` : ''}
      ${endereco ? `<p><strong>Endereço de entrega:</strong> ${endereco}</p>` : ''}
      <p><strong>Total:</strong> R$ ${Number(pedido.total_price).toFixed(2).replace('.', ',')}</p>
    </div>`;
}
// ---------------------------------------------------------------------------
// Funções públicas
// ---------------------------------------------------------------------------
/** Enviado logo após a criação do pedido ("aguardando pagamento") */
export async function enviarEmailPedidoCriado(pedido, itens) {
    const nome = pedido.customer_name || 'Cliente';
    const corpo = `
    <p>Olá, <strong>${nome}</strong>! 👋</p>
    <p>Recebemos o seu pedido com sucesso. Assim que confirmarmos o pagamento, você receberá uma nova notificação.</p>
    <span class="badge badge-pending">⏳ Aguardando pagamento</span>
    ${infoPedido(pedido)}
    ${tabelaItens(itens)}
    <p style="margin-top:18px;font-size:14px;color:#666;">Caso tenha alguma dúvida, responda este e-mail.</p>`;
    await enviar({
        to: pedido.customer_email,
        subject: `🛒 Pedido #${pedido.id} recebido – Biblioteca Brincar`,
        html: layoutBase('Pedido recebido com sucesso!', corpo),
    });
}
/** Enviado quando o pagamento é confirmado */
export async function enviarEmailPagamentoConfirmado(pedido, itens) {
    const nome = pedido.customer_name || 'Cliente';
    const corpo = `
    <p>Boa notícia, <strong>${nome}</strong>! 🎉</p>
    <p>Seu pagamento foi confirmado. Estamos preparando seu pedido para envio.</p>
    <span class="badge badge-paid">✅ Pagamento confirmado</span>
    ${infoPedido(pedido)}
    ${tabelaItens(itens)}
    <p style="margin-top:18px;font-size:14px;color:#666;">Em breve você receberá o código de rastreio da sua encomenda.</p>`;
    await enviar({
        to: pedido.customer_email,
        subject: `✅ Pagamento confirmado – Pedido #${pedido.id}`,
        html: layoutBase('Pagamento confirmado!', corpo),
    });
}
/** Enviado quando o admin informa o código de rastreio */
export async function enviarEmailRastreio(pedido, trackingCode, transportadora) {
    const nome = pedido.customer_name || 'Cliente';
    const corpo = `
    <p>Olá, <strong>${nome}</strong>! 📦</p>
    <p>Seu pedido foi enviado! Acompanhe abaixo as informações de entrega:</p>
    <span class="badge badge-shipped">🚚 Pedido enviado</span>
    <div class="info-box">
      <p><strong>Pedido:</strong> #${pedido.id}</p>
      <p><strong>Código de rastreio:</strong> <strong style="font-size:18px;color:#6c2ea8">${trackingCode}</strong></p>
      ${transportadora ? `<p><strong>Transportadora:</strong> ${transportadora}</p>` : ''}
    </div>
    <p style="font-size:14px;color:#666;">Rastreie seu pedido no site dos Correios ou da transportadora informada.</p>`;
    await enviar({
        to: pedido.customer_email,
        subject: `🚚 Seu pedido #${pedido.id} foi enviado!`,
        html: layoutBase('Seu pedido está a caminho!', corpo),
    });
}
