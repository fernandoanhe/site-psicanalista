require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createPixCharge } = require('../lib/mercadopago');

createPixCharge({
  referenceId: 'test-001',
  description: 'Sessão de psicanálise online',
  amount: 200,
  customerName: 'Teste Silva',
  customerEmail: 'test_user_3194201557850917401@testuser.com',
})
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .catch(e => {
    const err = e?.cause?.error || e?.response?.data || e?.message || String(e);
    console.error('ERRO:', JSON.stringify(err, null, 2));
    process.exit(1);
  });
