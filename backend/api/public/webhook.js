const express = require('express');
const supabase = require('../../lib/supabase');
const { sendConfirmationToPatient, sendNotificationToAdmin } = require('../../lib/email');

const router = express.Router();

// ------------------------------------------------------------------
// Map PagSeguro charge/order statuses to our internal status
// ------------------------------------------------------------------
function mapPagSeguroStatus(psStatus) {
  if (!psStatus) return null;
  const s = psStatus.toUpperCase();
  if (['PAID', 'AUTHORIZED', 'AVAILABLE'].includes(s)) return 'paid';
  if (['DECLINED', 'CANCELED', 'REFUNDED', 'CHARGEBACK'].includes(s)) return 'failed';
  return null; // ignore intermediate statuses (IN_ANALYSIS, WAITING, etc.)
}

// ------------------------------------------------------------------
// POST /api/public/webhook/pagseguro
// ------------------------------------------------------------------
router.post('/pagseguro', async (req, res) => {
  try {
    // Log raw payload for debugging
    console.log('[WEBHOOK] PagSeguro payload:', JSON.stringify(req.body));

    const payload = req.body;

    if (!payload || typeof payload !== 'object') {
      console.warn('[WEBHOOK] Empty or invalid payload');
      return res.status(200).json({ received: true });
    }

    // ------------------------------------------------------------------
    // PagSeguro sends either a charge or an order notification.
    // Charge notification: { id, type, created_at, data: { id, status, ... } }
    // Order notification:  { id, type, created_at, data: { id, charges: [{id, status}] } }
    // ------------------------------------------------------------------

    let psOrderId = null;
    let psChargeId = null;
    let psStatus = null;

    const data = payload.data || payload;

    // Charge-level notification
    if (data.status) {
      psStatus = data.status;
      psChargeId = data.id;
      psOrderId = data.id;
    }

    // Order-level notification — check charges array
    if (data.charges && Array.isArray(data.charges) && data.charges.length > 0) {
      const charge = data.charges[0];
      psStatus = charge.status;
      psChargeId = charge.id;
      psOrderId = data.id;
    }

    if (!psStatus) {
      console.warn('[WEBHOOK] Could not extract status from payload');
      return res.status(200).json({ received: true });
    }

    const internalStatus = mapPagSeguroStatus(psStatus);

    if (!internalStatus) {
      // Status we don't care about (pending, in_analysis, etc.)
      console.log(`[WEBHOOK] Ignoring status: ${psStatus}`);
      return res.status(200).json({ received: true });
    }

    // ------------------------------------------------------------------
    // Find booking by payment_id or pagseguro_order_id
    // ------------------------------------------------------------------
    let booking = null;

    if (psChargeId) {
      const { data: byCharge } = await supabase
        .from('bookings')
        .select('*')
        .eq('payment_id', psChargeId)
        .maybeSingle();
      if (byCharge) booking = byCharge;
    }

    if (!booking && psOrderId) {
      const { data: byOrder } = await supabase
        .from('bookings')
        .select('*')
        .eq('pagseguro_order_id', psOrderId)
        .maybeSingle();
      if (byOrder) booking = byOrder;
    }

    if (!booking) {
      console.warn(`[WEBHOOK] No booking found for charge=${psChargeId} order=${psOrderId}`);
      return res.status(200).json({ received: true });
    }

    // Skip if status hasn't changed
    if (booking.payment_status === internalStatus) {
      console.log(`[WEBHOOK] Booking ${booking.id} already has status ${internalStatus}`);
      return res.status(200).json({ received: true });
    }

    // ------------------------------------------------------------------
    // Update booking status
    // ------------------------------------------------------------------
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_status: internalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      console.error('[WEBHOOK] Error updating booking:', updateError.message);
      return res.status(200).json({ received: true }); // still return 200
    }

    // ------------------------------------------------------------------
    // Post-payment actions
    // ------------------------------------------------------------------
    if (internalStatus === 'paid') {
      // Send confirmation email to patient
      try {
        await sendConfirmationToPatient(updatedBooking);
        console.log(`[WEBHOOK] Confirmation email sent to ${updatedBooking.patient_email}`);
      } catch (emailErr) {
        console.error('[WEBHOOK] Error sending patient confirmation:', emailErr.message);
      }

      // Send notification email to admin
      try {
        await sendNotificationToAdmin(updatedBooking);
        console.log('[WEBHOOK] Admin notification email sent');
      } catch (emailErr) {
        console.error('[WEBHOOK] Error sending admin notification:', emailErr.message);
      }
    }

    // For 'failed': slot is automatically freed since only 'paid' slots are considered taken

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[POST /webhook/pagseguro]', err.message, err.stack);
    // Always return 200 to PagSeguro to prevent retries for server errors we've logged
    return res.status(200).json({ received: true });
  }
});

module.exports = router;
