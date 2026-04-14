const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ------------------------------------------------------------------
// Helper: format a date string (YYYY-MM-DD) as Portuguese long form
// e.g. "2026-04-14" → "Terça-feira, 14 de abril de 2026"
// ------------------------------------------------------------------
const WEEKDAYS_PT = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function formatDatePT(dateStr) {
  // dateStr: 'YYYY-MM-DD'
  const [year, month, day] = dateStr.split('-').map(Number);
  // Use UTC to avoid timezone shifts when only date is needed
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = WEEKDAYS_PT[d.getUTCDay()];
  const monthName = MONTHS_PT[d.getUTCMonth()];
  return `${weekday}, ${day} de ${monthName} de ${year}`;
}

// ------------------------------------------------------------------
// Base HTML wrapper
// ------------------------------------------------------------------
function baseEmail(title, bodyHtml) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #FDF5EE; font-family: Georgia, serif; color: #2C1A0E; }
    .container { max-width: 600px; margin: 40px auto; background: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #1E1510; padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #C8A882; font-size: 22px; font-weight: normal; letter-spacing: 1px; }
    .body { padding: 40px; }
    .body h2 { color: #C25E00; font-size: 20px; font-weight: normal; margin-top: 0; }
    .detail-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    .detail-table td { padding: 10px 0; border-bottom: 1px solid #F0E4D4; font-size: 15px; }
    .detail-table td:first-child { color: #8B6B4A; width: 40%; }
    .detail-table td:last-child { font-weight: bold; }
    .highlight-box { background: #FDF5EE; border-left: 4px solid #C25E00; padding: 16px 20px; border-radius: 4px; margin: 24px 0; }
    .footer { background: #F7EDE0; padding: 24px 40px; text-align: center; font-size: 13px; color: #8B6B4A; }
    .btn { display: inline-block; background: #C25E00; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-size: 15px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Consultório Online</h1>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>Este é um e-mail automático. Por favor, não responda diretamente.</p>
      <p>Em caso de dúvidas, entre em contato: ${process.env.EMAIL_ADMIN || ''}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ------------------------------------------------------------------
// FILE 8 — Public API
// ------------------------------------------------------------------

/**
 * Send session confirmation email to the patient.
 * @param {Object} booking - booking record from database
 */
async function sendConfirmationToPatient(booking) {
  const formattedDate = formatDatePT(
    typeof booking.session_date === 'string'
      ? booking.session_date.slice(0, 10)
      : booking.session_date.toISOString().slice(0, 10)
  );

  const paymentMethodLabel =
    booking.payment_method === 'pix' ? 'PIX' : 'Cartão de crédito';

  const html = baseEmail(
    'Confirmação de sessão',
    `
    <h2>Sua sessão foi confirmada!</h2>
    <p>Olá, <strong>${booking.patient_name}</strong>!</p>
    <p>Seu agendamento foi realizado com sucesso. Abaixo estão os detalhes:</p>

    <table class="detail-table">
      <tr><td>Data</td><td>${formattedDate}</td></tr>
      <tr><td>Horário</td><td>${booking.session_time}</td></tr>
      <tr><td>Duração</td><td>50 minutos</td></tr>
      <tr><td>Modalidade</td><td>Online via Google Meet</td></tr>
      <tr><td>Valor</td><td>R$ ${Number(booking.payment_amount).toFixed(2).replace('.', ',')}</td></tr>
      <tr><td>Pagamento</td><td>${paymentMethodLabel}</td></tr>
    </table>

    <div class="highlight-box">
      <strong>Como funciona?</strong><br/>
      Você receberá o link do Google Meet por e-mail próximo ao horário da sessão.
      Certifique-se de estar em um local tranquilo e com boa conexão à internet.
    </div>

    <p>Caso precise cancelar ou remarcar, entre em contato com antecedência mínima de 24 horas.</p>
    <p>Até breve!</p>
    `
  );

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: booking.patient_email,
    subject: `Sessão confirmada — ${formattedDate} às ${booking.session_time}`,
    html,
  });

  return { success: true };
}

/**
 * Send new booking notification email to the admin.
 * @param {Object} booking - booking record from database
 */
async function sendNotificationToAdmin(booking) {
  const formattedDate = formatDatePT(
    typeof booking.session_date === 'string'
      ? booking.session_date.slice(0, 10)
      : booking.session_date.toISOString().slice(0, 10)
  );

  const paymentMethodLabel =
    booking.payment_method === 'pix' ? 'PIX' : 'Cartão de crédito';

  const html = baseEmail(
    'Novo agendamento',
    `
    <h2>Novo agendamento recebido</h2>
    <p>Uma nova sessão foi agendada e o pagamento foi confirmado.</p>

    <table class="detail-table">
      <tr><td>Paciente</td><td>${booking.patient_name}</td></tr>
      <tr><td>E-mail</td><td>${booking.patient_email}</td></tr>
      <tr><td>Telefone</td><td>${booking.patient_phone || '—'}</td></tr>
      <tr><td>Data</td><td>${formattedDate}</td></tr>
      <tr><td>Horário</td><td>${booking.session_time}</td></tr>
      <tr><td>Valor</td><td>R$ ${Number(booking.payment_amount).toFixed(2).replace('.', ',')}</td></tr>
      <tr><td>Método de pagamento</td><td>${paymentMethodLabel}</td></tr>
      <tr><td>ID do pedido</td><td>${booking.pagseguro_order_id || booking.payment_id || '—'}</td></tr>
    </table>

    <div class="highlight-box">
      Acesse o painel administrativo para visualizar todos os agendamentos.
    </div>
    `
  );

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_ADMIN,
    subject: `[Novo agendamento] ${booking.patient_name} — ${formattedDate} às ${booking.session_time}`,
    html,
  });

  return { success: true };
}

/**
 * Send 30-minute reminder email to the patient.
 * @param {Object} booking - booking record from database
 */
async function sendReminderToPatient(booking) {
  const formattedDate = formatDatePT(
    typeof booking.session_date === 'string'
      ? booking.session_date.slice(0, 10)
      : booking.session_date.toISOString().slice(0, 10)
  );

  const html = baseEmail(
    'Lembrete de sessão',
    `
    <h2>Sua sessão começa em 30 minutos!</h2>
    <p>Olá, <strong>${booking.patient_name}</strong>!</p>
    <p>Este é um lembrete de que sua sessão está prestes a começar.</p>

    <table class="detail-table">
      <tr><td>Data</td><td>${formattedDate}</td></tr>
      <tr><td>Horário</td><td>${booking.session_time}</td></tr>
      <tr><td>Modalidade</td><td>Online via Google Meet</td></tr>
    </table>

    <div class="highlight-box">
      <strong>Prepare-se:</strong><br/>
      • Escolha um local tranquilo e privado<br/>
      • Verifique sua conexão com a internet<br/>
      • Tenha fones de ouvido à mão para maior privacidade
    </div>

    <p>O link do Google Meet será compartilhado no início da sessão. Fique atento ao seu e-mail.</p>
    <p>Até já!</p>
    `
  );

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: booking.patient_email,
    subject: `Lembrete: sua sessão começa em 30 minutos — ${booking.session_time}`,
    html,
  });

  return { success: true };
}

/**
 * Send 30-minute reminder email to the admin.
 * @param {Object} booking - booking record from database
 */
async function sendReminderToAdmin(booking) {
  const formattedDate = formatDatePT(
    typeof booking.session_date === 'string'
      ? booking.session_date.slice(0, 10)
      : booking.session_date.toISOString().slice(0, 10)
  );

  const html = baseEmail(
    'Lembrete de atendimento',
    `
    <h2>Atendimento em 30 minutos</h2>
    <p>Você tem uma sessão agendada para daqui a 30 minutos.</p>

    <table class="detail-table">
      <tr><td>Paciente</td><td>${booking.patient_name}</td></tr>
      <tr><td>E-mail</td><td>${booking.patient_email}</td></tr>
      <tr><td>Telefone</td><td>${booking.patient_phone || '—'}</td></tr>
      <tr><td>Data</td><td>${formattedDate}</td></tr>
      <tr><td>Horário</td><td>${booking.session_time}</td></tr>
    </table>

    <div class="highlight-box">
      Lembre-se de abrir a sala do Google Meet antes do horário.
    </div>
    `
  );

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_ADMIN,
    subject: `[Lembrete] Sessão com ${booking.patient_name} às ${booking.session_time}`,
    html,
  });

  return { success: true };
}

module.exports = {
  sendConfirmationToPatient,
  sendNotificationToAdmin,
  sendReminderToPatient,
  sendReminderToAdmin,
};
