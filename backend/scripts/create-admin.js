require('dotenv').config();

const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const readline = require('readline');

// ------------------------------------------------------------------
// Prompt helper (returns a Promise)
// ------------------------------------------------------------------
function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=== Criar / Atualizar Admin ===\n');

  // Use env vars if provided, otherwise prompt
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  if (!email) {
    email = await prompt('E-mail do administrador: ');
  } else {
    console.log(`E-mail: ${email} (via .env)`);
  }

  if (!email || !email.includes('@')) {
    console.error('E-mail inválido.');
    process.exit(1);
  }

  if (!password) {
    password = await prompt('Senha do administrador: ');
  } else {
    console.log('Senha: *** (via .env)');
  }

  if (!password || password.length < 8) {
    console.error('A senha deve ter pelo menos 8 caracteres.');
    process.exit(1);
  }

  console.log('\nGerando hash da senha...');
  const password_hash = await bcrypt.hash(password, 10);

  console.log('Salvando no banco de dados...');

  const { data, error } = await supabase
    .from('admin_user')
    .upsert(
      {
        email: email.toLowerCase().trim(),
        password_hash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar admin:', error.message);
    process.exit(1);
  }

  console.log(`\nAdmin criado/atualizado com sucesso!`);
  console.log(`ID: ${data.id}`);
  console.log(`E-mail: ${data.email}`);
  console.log(`Criado em: ${data.created_at}`);
}

main().catch((err) => {
  console.error('Erro inesperado:', err.message);
  process.exit(1);
});
