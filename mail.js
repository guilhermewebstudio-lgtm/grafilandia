// Envio de emails via API HTTP da Brevo (o Render free bloqueia SMTP).
// Sem BREVO_API_KEY o email não é enviado: fica apenas registado no log do servidor.

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendMail({ to, subject, html, text, replyTo }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.log(`[email desativado] Para: ${to} | Assunto: ${subject}\n${text || ''}\n`);
    return false;
  }
  try {
    const body = {
      sender: { email: process.env.BREVO_SENDER_EMAIL || 'no-reply@grafilandia.pt', name: 'Grafilândia' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    };
    if (replyTo) body.replyTo = { email: replyTo };
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Brevo respondeu', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Falha ao enviar email:', err.message);
    return false;
  }
}

function layout(title, inner) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#26334d">
  <div style="background:#0E2F6E;color:#fff;padding:18px 24px;font-size:20px;font-weight:bold">Grafilândia</div>
  <div style="padding:24px;border:1px solid #dbe5f0;border-top:0">
    <h2 style="margin:0 0 16px;color:#0E2F6E;font-size:20px">${esc(title)}</h2>
    ${inner}
  </div>
  <p style="font-size:12px;color:#7a869a;padding:12px 24px">Grafilândia – Artes Gráficas, Unipessoal, Lda.</p>
</div>`;
}

function requestRows(r) {
  const rows = [
    ['Tipo', r.type === 'ficheiro' ? 'Envio de ficheiro' : 'Pedido de orçamento'],
    ['Produto', r.product],
    ['Formato', r.format],
    ['Papel / material', r.paper],
    ['Acabamento', r.finish],
    ['Quantidade', r.quantity],
    ['Ficheiro', r.file_name],
    ['Notas', r.notes],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');
  return rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#7a869a;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
    .join('');
}

async function notifyNewRequest(r, settings, baseUrl) {
  const notifyTo = process.env.ADMIN_EMAIL || settings.email;
  const rows = requestRows(r);
  const contact = `${esc(r.name)} &lt;${esc(r.email)}&gt;${r.phone ? ' / ' + esc(r.phone) : ''} (prefere ${r.contact_pref === 'whatsapp' ? 'WhatsApp' : 'e-mail'})`;

  if (notifyTo) {
    await sendMail({
      to: notifyTo,
      replyTo: r.email,
      subject: `Novo pedido #${r.id} – ${r.name}`,
      html: layout(`Novo pedido #${r.id}`, `<p>${contact}</p><table>${rows}</table><p><a href="${esc(baseUrl)}/admin/pedidos/${r.id}">Abrir no painel</a></p>`),
      text: `Novo pedido #${r.id} de ${r.name} (${r.email}). ${baseUrl}/admin/pedidos/${r.id}`,
    });
  }

  await sendMail({
    to: r.email,
    subject: `Recebemos o teu pedido #${r.id}`,
    html: layout(
      'Recebemos o teu pedido',
      `<p>Olá ${esc(r.name)}, recebemos o teu pedido <b>#${r.id}</b>. Vamos analisá-lo e responder com o preço por ${r.contact_pref === 'whatsapp' ? 'WhatsApp' : 'e-mail'}.</p><table>${rows}</table><p>Se precisares de falar connosco: ${esc(settings.telefone)}.</p>`
    ),
    text: `Olá ${r.name}, recebemos o teu pedido #${r.id}. Vamos responder com o preço por ${r.contact_pref === 'whatsapp' ? 'WhatsApp' : 'e-mail'}.`,
  });
}

async function sendResetEmail(user, link) {
  return sendMail({
    to: user.email,
    subject: 'Recuperar palavra-passe – Grafilândia',
    html: layout(
      'Recuperar palavra-passe',
      `<p>Olá ${esc(user.name)}, recebemos um pedido para repor a tua palavra-passe.</p><p><a href="${esc(link)}" style="background:#0A64B0;color:#fff;padding:10px 18px;text-decoration:none;border-radius:4px;display:inline-block">Escolher nova palavra-passe</a></p><p style="font-size:13px;color:#7a869a">O link é válido durante 1 hora. Se não foste tu, ignora este email.</p>`
    ),
    text: `Para repor a tua palavra-passe abre: ${link} (válido durante 1 hora).`,
  });
}

module.exports = { sendMail, notifyNewRequest, sendResetEmail, esc };
