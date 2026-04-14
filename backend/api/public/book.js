const express = require('express');
const supabase = require('../../lib/supabase');
const { createPixCharge, createCreditCardOrder } = require('../../lib/pagseguro');

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

    // Normalise time to HH:MM
    const timeNorm = session_time.slice(0, 5);

    // ------------------------------------------------------------------
    // 2. Verify slot is available (not already booked or blocked)
    // ------------------------------------------------------------------

    // Check for conflicting paid booking
    const { data: conflictingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('session_date', session_date)
      .eq('session_time', timeNorm)
      .eq('payment_status', 'paid')
      .maybeSingle();

    if (conflictingBooking) {
      return res.status(409).json({ error: 'Este horário não está mais disponível' });
    }

    // Check for blocked date
    const { data: blockedDate } = await supabase
      .from('blocked_dates')
      .select('id')
      .eq('date', session_date)
      .maybeSingle();

    if (blockedDate) {
      return res.status(409).json({ error: 'Esta data não está disponível para agendamento' });
    }

    // Check for blocked slot
    const { data: blockedSlot } = await supabase
      .from('blocked_slots')
      .select('id')
      .eq('date', session_date)
      .eq('time', timeNorm)
      .maybeSingle();

    if (blockedSlot) {
      return res.status(409).json({ error: 'Este horário não está disponível' });
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
          pagseguro_order_id: chargeResult.chargeId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      return res.status(201).json({
        booking_id: bookingId,
        payment_method: 'pix',
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
          pagseguro_order_id: orderResult.orderId,
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
