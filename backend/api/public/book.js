const express = require('express');
const supabase = require('../../lib/supabase');
const { createPixCharge, createCreditCardOrder } = require('../../lib/mercadopago');
const { getFreeSlots } = require('../../lib/slots');

const router = express.Router();

// ------------------------------------------------------------------
// POST /api/public/book
// ------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const {
      patient_name,
      patient_email,
      patient_phone,
      session_date,
      session_time,
      payment_method,
    } = req.body;

    // ------------------------------------------------------------------
    // 1. Validate required fields
    // ------------------------------------------------------------------
    const missing = [];
    if (!patient_name) missing.push('patient_name');
    if (!patient_email) missing.push('patient_email');
    if (!session_date) missing.push('session_date');
    if (!session_time) missing.push('session_time');
    if (!payment_method) missing.push('payment_method');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Campos obrigatórios ausentes: ${missing.join(', ')}`,
      });
    }

    if (!['pix', 'credit_card'].includes(payment_method)) {
      return res
        .status(400)
        .json({ error: 'payment_method deve ser "pix" ou "credit_card"' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(session_date) || !/^\d{2}:\d{2}/.test(session_time)) {
      return res.status(400).json({ error: 'Data ou horário em formato inválido' });
    }

    if (typeof patient_name !== 'string' || patient_name.trim().length < 2 || patient_name.length > 200) {
      return res.status(400).json({ error: 'Nome inválido' });
    }

    if (typeof patient_email !== 'string' || patient_email.length > 200 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient_email.trim())) {
      return res.status(400).json({ error: 'E-mail inválido' });
    }

    if (patient_phone && (typeof patient_phone !== 'string' || patient_phone.length > 30)) {
      return res.status(400).json({ error: 'Telefone inválido' });
    }

    // Normalise time to HH:MM
    const timeNorm = session_time.slice(0, 5);

    // ------------------------------------------------------------------
    // 2. Verify slot is available (same rules as the public calendar:
    //    weekly schedule, blocked dates/slots, paid and held bookings)
    // ------------------------------------------------------------------
    // A patient retrying the same slot (e.g. switching PIX → card) must not
    // be blocked by their own pending hold, so release it first.
    await supabase
      .from('bookings')
      .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
      .eq('patient_email', patient_email.trim().toLowerCase())
      .eq('session_date', session_date)
      .eq('session_time', timeNorm)
      .eq('payment_status', 'pending');

    const [day] = await getFreeSlots(session_date, session_date);

    if (!day || !day.slots.includes(timeNorm)) {
      return res.status(409).json({ error: 'Este horário não está mais disponível' });
    }

    // ------------------------------------------------------------------
    // 3. Get session price from site_content
    // ------------------------------------------------------------------
    const { data: priceRecord } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', 'session_price')
      .single();

    const sessionPrice = priceRecord ? parseFloat(priceRecord.value) : 200;

    // ------------------------------------------------------------------
    // 4. Create booking with status 'pending'
    // ------------------------------------------------------------------
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        patient_name: patient_name.trim(),
        patient_email: patient_email.trim().toLowerCase(),
        patient_phone: patient_phone ? patient_phone.trim() : null,
        session_date,
        session_time: timeNorm,
        payment_method,
        payment_status: 'pending',
        payment_amount: sessionPrice,
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    const bookingId = booking.id;
    const description = `Sessão de psicanálise online — ${session_date} ${timeNorm}`;

    // ------------------------------------------------------------------
    // 5. Process payment
    // ------------------------------------------------------------------
    if (payment_method === 'pix') {
      let chargeResult;
      try {
        chargeResult = await createPixCharge({
          referenceId: bookingId,
          description,
          amount: sessionPrice,
          customerName: patient_name,
          customerEmail: patient_email,
          customerPhone: patient_phone,
        });
      } catch (payErr) {
        console.error('[createPixCharge]', payErr.message);
        // Mark booking as failed so the slot is not held
        await supabase
          .from('bookings')
          .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', bookingId);
        return res
          .status(502)
          .json({ error: 'Erro ao criar cobrança PIX. Tente novamente.' });
      }

      // Update booking with payment IDs
      await supabase
        .from('bookings')
        .update({
          payment_id: chargeResult.chargeId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      return res.status(201).json({
        booking_id: bookingId,
        payment_method: 'pix',
        checkout_url: chargeResult.checkoutUrl,
        qr_code_image: chargeResult.qrCodeImage,
        qr_code_text: chargeResult.qrCodeText,
        expires_at: chargeResult.expiresAt,
        amount: sessionPrice,
      });
    }

    if (payment_method === 'credit_card') {
      let orderResult;
      try {
        orderResult = await createCreditCardOrder({
          referenceId: bookingId,
          description,
          amount: sessionPrice,
          customerName: patient_name,
          customerEmail: patient_email,
          customerPhone: patient_phone,
        });
      } catch (payErr) {
        console.error('[createCreditCardOrder]', payErr.message);
        await supabase
          .from('bookings')
          .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', bookingId);
        return res
          .status(502)
          .json({ error: 'Erro ao criar pedido de pagamento. Tente novamente.' });
      }

      // Update booking with order ID
      await supabase
        .from('bookings')
        .update({
          payment_id: String(orderResult.orderId),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      return res.status(201).json({
        booking_id: bookingId,
        payment_method: 'credit_card',
        checkout_url: orderResult.checkoutUrl,
        amount: sessionPrice,
      });
    }
  } catch (err) {
    console.error('[POST /public/book]', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
