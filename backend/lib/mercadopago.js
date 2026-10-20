const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');

function getClient() {
  return new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  });
}

// ------------------------------------------------------------------
// createPixCharge — API de Pagamentos direta (POST /v1/payments)
// Retorna QR code e código copia-e-cola para exibição imediata no site.
// ------------------------------------------------------------------
async function createPixCharge({
  referenceId,
  description,
  amount,
  customerName,
  customerEmail,
}) {
  const payment = new Payment(getClient());

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const result = await payment.create({
    body: {
      transaction_amount: amount,
      description,
      payment_method_id: 'pix',
      date_of_expiration: expiresAt,
      payer: {
        email: customerEmail,
        first_name: customerName,
        identification: {
          type: 'CPF',
          number: '00000000000',
        },
      },
      external_reference: String(referenceId),
      notification_url: `${process.env.BACKEND_URL}/api/public/webhook/mercadopago`,
    },
    requestOptions: { idempotencyKey: `pix-${referenceId}` },
  });

  const txData = result.point_of_interaction?.transaction_data;
  const qrCodeText = txData?.qr_code || null;
  const qrCodeBase64 = txData?.qr_code_base64 || null;
  const qrCodeImage = qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : null;

  return {
    chargeId: String(result.id),
    checkoutUrl: null,
    qrCodeText,
    qrCodeImage,
    expiresAt,
  };
}

// ------------------------------------------------------------------
// createCreditCardOrder  (Checkout Pro — gera URL de redirecionamento)
// ------------------------------------------------------------------
async function createCreditCardOrder({
  referenceId,
  description,
  amount,
  customerName,
  customerEmail,
}) {
  const preference = new Preference(getClient());

  const result = await preference.create({
    body: {
      items: [
        {
          id: String(referenceId),
          title: description,
          quantity: 1,
          unit_price: amount,
          currency_id: 'BRL',
        },
      ],
      payer: {
        name: customerName,
        email: customerEmail,
      },
      back_urls: {
        success: `${process.env.SITE_URL}/?pagamento=aprovado#agendar`,
        failure: `${process.env.SITE_URL}/?pagamento=falhou#agendar`,
        pending: `${process.env.SITE_URL}/?pagamento=pendente#agendar`,
      },
      auto_return: 'approved',
      // O horário fica reservado por 30 min; boleto levaria dias para compensar
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }],
      },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      external_reference: String(referenceId),
      notification_url: `${process.env.BACKEND_URL}/api/public/webhook/mercadopago`,
    },
  });

  const isSandbox = process.env.MERCADOPAGO_ENV !== 'production';
  const checkoutUrl = isSandbox ? result.sandbox_init_point : result.init_point;

  return {
    orderId: result.id,
    checkoutUrl: checkoutUrl || null,
  };
}

// ------------------------------------------------------------------
// getPayment  — busca pagamento por ID (usado pelo webhook)
// ------------------------------------------------------------------
async function getPayment(paymentId) {
  const payment = new Payment(getClient());
  return payment.get({ id: paymentId });
}

module.exports = { createPixCharge, createCreditCardOrder, getPayment };
