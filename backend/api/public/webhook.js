const express = require('express');
const supabase = require('../../lib/supabase');
const { getPayment } = require('../../lib/mercadopago');
const {
  sendConfirmationToPatient,
  sendNotificationToAdmin,
  sendSlotConflictToAdmin,
} = require('../../lib/email');
const { isCalendarEnabled, createSessionEvent, cancelSessionEvent } = require('../../lib/calendar');

const router = express.Router();

// ------------------------------------------------------------------
// Map Mercado Pago payment statuses to internal status
// ------------------------------------------------------------------
function mapMPStatus(mpStatus) {
  if (!mpStatus) return null;
  const s = mpStatus.toLowerCase();
  if (s === 'approved') return 'paid';
  if (['refunded', 'charged_back'].includes(s)) return 'refunded';
  if (['rejected', 'cancelled'].includes(s)) return 'failed';
  return null; // pending, in_process, authorized — aguardar
}

// ------------------------------------------------------------------
// POST /api/public/webhook/mercadopago
// ------------------------------------------------------------------
router.post('/mercadopago', async (req, res) => {
  try {
    console.log('[WEBHOOK] Mercado Pago payload:', JSON.stringify(req.body));

    const { type, data, action } = req.body || {};

    // MP envia type "payment" para cobranças PIX e cartão
    if (type !== 'payment' && action !== 'payment.updated' && action !== 'payment.created') {
      console.log(`[WEBHOOK] Ignorando tipo: ${type} / action: ${action}`);
      return res.status(200).json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      console.warn('[WEBHOOK] Sem payment ID no payload');
      return res.status(200).json({ received: true });
    }

    // Busca detalhes do pagamento na API do Mercado Pago
    let mpPayment;
    try {
      mpPayment = await getPayment(paymentId);
    } catch (fetchErr) {
      console.error('[WEBHOOK] Erro ao buscar pagamento MP:', fetchErr.message);
      return res.status(200).json({ received: true });
    }

    const mpStatus = mpPayment.status;
    const externalReference = mpPayment.external_reference; // nosso booking ID
    console.log(`[WEBHOOK] Payment ${paymentId} status=${mpStatus} ref=${externalReference}`);

    const internalStatus = mapMPStatus(mpStatus);
    if (!internalStatus) {
      console.log(`[WEBHOOK] Ignorando status intermediário: ${mpStatus}`);
      return res.status(200).json({ received: true });
    }

    // ------------------------------------------------------------------
    // Localizar booking por payment_id ou external_reference
    // ------------------------------------------------------------------
    let booking = null;

    const { data: byPaymentId } = await supabase
      .from('bookings')
      .select('*')
      .eq('payment_id', String(paymentId))
      .maybeSingle();
    if (byPaymentId) booking = byPaymentId;

    if (!booking && externalReference) {
      const { data: byRef } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', externalReference)
        .maybeSingle();
      if (byRef) booking = byRef;
    }

    if (!booking) {
      console.warn(`[WEBHOOK] Nenhum booking encontrado para payment_id=${paymentId} ref=${externalReference}`);
      return res.status(200).json({ received: true });
    }

    if (booking.payment_status === internalStatus) {
      console.log(`[WEBHOOK] Booking ${booking.id} já tem status ${internalStatus}`);
      return res.status(200).json({ received: true });
    }

    // ------------------------------------------------------------------
    // Atualizar status do booking
    // ------------------------------------------------------------------
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_status: internalStatus,
        payment_id: String(paymentId),
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      // 23505 = unique violation: another paid booking already holds this slot
      if (updateError.code === '23505') {
        console.error(`[WEBHOOK] Horário já ocupado para booking ${booking.id}; avisando admin`);
        try {
          await sendSlotConflictToAdmin(booking, String(paymentId));
        } catch (emailErr) {
          console.error('[WEBHOOK] Erro ao enviar alerta de conflito:', emailErr.message);
        }
      } else {
        console.error('[WEBHOOK] Erro ao atualizar booking:', updateError.message);
      }
      return res.status(200).json({ received: true });
    }

    // ------------------------------------------------------------------
    // Ações pós-pagamento
    // ------------------------------------------------------------------
    if (internalStatus === 'paid') {
      // Google Calendar event with its own Meet link (skipped if not configured)
      if (isCalendarEnabled() && !updatedBooking.calendar_event_id) {
        try {
          const { eventId, meetLink } = await createSessionEvent(updatedBooking);
          const { error: linkError } = await supabase
            .from('bookings')
            .update({ calendar_event_id: eventId, meet_link: meetLink })
            .eq('id', updatedBooking.id);
          if (linkError) console.error('[WEBHOOK] Erro ao salvar link do Meet:', linkError.message);
          updatedBooking.calendar_event_id = eventId;
          updatedBooking.meet_link = meetLink;
          console.log(`[WEBHOOK] Evento criado na agenda para booking ${updatedBooking.id}`);
        } catch (calErr) {
          console.error('[WEBHOOK] Erro ao criar evento na agenda:', calErr.message);
        }
      }

      try {
        await sendConfirmationToPatient(updatedBooking);
        console.log(`[WEBHOOK] Email de confirmação enviado para ${updatedBooking.patient_email}`);
      } catch (emailErr) {
        console.error('[WEBHOOK] Erro ao enviar email ao paciente:', emailErr.message);
      }

      try {
        await sendNotificationToAdmin(updatedBooking);
        console.log('[WEBHOOK] Email de notificação enviado ao admin');
      } catch (emailErr) {
        console.error('[WEBHOOK] Erro ao enviar email ao admin:', emailErr.message);
      }
    }

    // Refund / chargeback: remove the session from the calendar
    if (internalStatus === 'refunded' && updatedBooking.calendar_event_id && isCalendarEnabled()) {
      try {
        await cancelSessionEvent(updatedBooking.calendar_event_id);
        console.log(`[WEBHOOK] Evento cancelado na agenda para booking ${updatedBooking.id}`);
      } catch (calErr) {
        console.error('[WEBHOOK] Erro ao cancelar evento na agenda:', calErr.message);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[POST /webhook/mercadopago]', err.message, err.stack);
    return res.status(200).json({ received: true });
  }
});

module.exports = router;
