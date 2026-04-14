const axios = require('axios');
const crypto = require('crypto');

const BASE_URL =
  process.env.PAGSEGURO_ENV === 'production'
    ? 'https://api.pagseguro.com'
    : 'https://sandbox.api.pagseguro.com';

// ------------------------------------------------------------------
// Axios instance with default headers
// ------------------------------------------------------------------
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.PAGSEGURO_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// ------------------------------------------------------------------
// createPixCharge
// ------------------------------------------------------------------
/**
 * Create a PIX charge on PagSeguro.
 *
 * @param {Object} params
 * @param {string} params.referenceId   - our booking ID
 * @param {string} params.description   - charge description
 * @param {number} params.amount        - value in BRL (e.g. 200.00)
 * @param {string} params.customerName
 * @param {string} params.customerEmail
 * @param {string} [params.customerPhone]
 *
 * @returns {{ chargeId, qrCodeImage, qrCodeText, expiresAt }}
 */
async function createPixCharge({
  referenceId,
  description,
  amount,
  customerName,
  customerEmail,
  customerPhone,
}) {
  // PagSeguro expects amount in centavos (integer)
  const amountInCents = Math.round(amount * 100);

  // Expiration: 30 minutes from now (ISO 8601)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const payload = {
    reference_id: referenceId,
    description,
    amount: {
      value: amountInCents,
      currency: 'BRL',
    },
    payment_method: {
      type: 'PIX',
      pix: {
        expiration_date: expiresAt,
      },
    },
    notification_urls: [
      `${process.env.BACKEND_URL}/api/public/webhook/pagseguro`,
    ],
  };

  if (customerName || customerEmail) {
    payload.customer = {};
    if (customerName) payload.customer.name = customerName;
    if (customerEmail) payload.customer.email = customerEmail;
    if (customerPhone) {
      // PagSeguro expects phone as { country: '55', area: '11', number: '999999999', type: 'MOBILE' }
      const digits = customerPhone.replace(/\D/g, '');
      if (digits.length >= 10) {
        payload.customer.phones = [
          {
            country: '55',
            area: digits.slice(0, 2),
            number: digits.slice(2),
            type: 'MOBILE',
          },
        ];
      }
    }
  }

  const response = await api.post('/charges', payload);
  const data = response.data;

  const qrCodeImage =
    data.qr_codes &&
    data.qr_codes[0] &&
    data.qr_codes[0].links &&
    data.qr_codes[0].links.find((l) => l.media === 'image/png')?.href;

  const qrCodeText =
    data.qr_codes && data.qr_codes[0] && data.qr_codes[0].text;

  return {
    chargeId: data.id,
    qrCodeImage: qrCodeImage || null,
    qrCodeText: qrCodeText || null,
    expiresAt: data.qr_codes && data.qr_codes[0] && data.qr_codes[0].expiration_date
      ? data.qr_codes[0].expiration_date
      : expiresAt,
  };
}

// ------------------------------------------------------------------
// createCreditCardOrder
// ------------------------------------------------------------------
/**
 * Create a credit card checkout order on PagSeguro.
 *
 * @param {Object} params
 * @param {string} params.referenceId
 * @param {string} params.description
 * @param {number} params.amount        - value in BRL (e.g. 200.00)
 * @param {string} params.customerName
 * @param {string} params.customerEmail
 * @param {string} [params.customerPhone]
 *
 * @returns {{ orderId, checkoutUrl }}
 */
async function createCreditCardOrder({
  referenceId,
  description,
  amount,
  customerName,
  customerEmail,
  customerPhone,
}) {
  const amountInCents = Math.round(amount * 100);

  const payload = {
    reference_id: referenceId,
    customer: {
      name: customerName,
      email: customerEmail,
    },
    items: [
      {
        reference_id: referenceId,
        name: description,
        quantity: 1,
        unit_amount: amountInCents,
      },
    ],
    charges: [
      {
        reference_id: referenceId,
        description,
        amount: {
          value: amountInCents,
          currency: 'BRL',
        },
        payment_method: {
          type: 'CREDIT_CARD',
          installments: 1,
          capture: true,
          soft_descriptor: 'Consultorio',
        },
      },
    ],
    notification_urls: [
      `${process.env.BACKEND_URL}/api/public/webhook/pagseguro`,
    ],
    redirect_url: `${process.env.SITE_URL}/obrigado`,
  };

  if (customerPhone) {
    const digits = customerPhone.replace(/\D/g, '');
    if (digits.length >= 10) {
      payload.customer.phones = [
        {
          country: '55',
          area: digits.slice(0, 2),
          number: digits.slice(2),
          type: 'MOBILE',
        },
      ];
    }
  }

  const response = await api.post('/orders', payload);
  const data = response.data;

  const checkoutUrl =
    data.links &&
    data.links.find((l) => l.rel === 'PAY')?.href;

  return {
    orderId: data.id,
    checkoutUrl: checkoutUrl || null,
  };
}

// ------------------------------------------------------------------
// getCharge
// ------------------------------------------------------------------
/**
 * Retrieve a charge by its ID.
 * @param {string} chargeId
 */
async function getCharge(chargeId) {
  const response = await api.get(`/charges/${chargeId}`);
  return response.data;
}

// ------------------------------------------------------------------
// verifyWebhookSignature
// ------------------------------------------------------------------
/**
 * Validate the PagSeguro webhook signature header.
 * PagSeguro sends a `x-pagseguro-signature` header with
 * HMAC-SHA256 of the raw body using the account token as key.
 *
 * @param {import('express').Request} req - Express request with rawBody buffer
 * @returns {boolean}
 */
function verifyWebhookSignature(req) {
  const signature = req.headers['x-pagseguro-signature'];
  if (!signature) return false;

  const rawBody = req.rawBody; // set by express.json verify callback
  if (!rawBody) return false;

  const expected = crypto
    .createHmac('sha256', process.env.PAGSEGURO_TOKEN)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

module.exports = {
  createPixCharge,
  createCreditCardOrder,
  getCharge,
  verifyWebhookSignature,
};
