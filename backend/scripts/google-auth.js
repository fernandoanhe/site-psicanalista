// ------------------------------------------------------------------
// Authorizes the backend to create events in the admin's Google Calendar.
// Run once, from backend/:  node scripts/google-auth.js
//
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env
// (OAuth client of type "Desktop app"). Opens the Google consent page and
// writes GOOGLE_REFRESH_TOKEN into backend/.env. The token is never printed.
// ------------------------------------------------------------------
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');

const ENV_PATH = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: ENV_PATH });

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('Preencha GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no backend/.env antes de rodar.');
  process.exit(1);
}

const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });

function saveRefreshToken(token) {
  let env = fs.readFileSync(ENV_PATH, 'utf8');
  if (/^GOOGLE_REFRESH_TOKEN=.*$/m.test(env)) {
    env = env.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${token}`);
  } else {
    env = env.replace(/\s*$/, `\nGOOGLE_REFRESH_TOKEN=${token}\n`);
  }
  fs.writeFileSync(ENV_PATH, env);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

  if (!code) {
    res.end(`<p>Autorização cancelada (${error || 'sem código'}). Pode fechar esta aba.</p>`);
    console.error('Autorização cancelada:', error);
    server.close();
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.refresh_token) {
      throw new Error(data.error_description || data.error || 'Google não devolveu refresh_token');
    }
    saveRefreshToken(data.refresh_token);
    res.end('<p>Pronto! Agenda autorizada. Pode fechar esta aba.</p>');
    console.log('GOOGLE_REFRESH_TOKEN salvo no backend/.env.');
  } catch (err) {
    res.end(`<p>Erro: ${err.message}</p>`);
    console.error('Erro ao obter o token:', err.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Abrindo o navegador para autorizar a agenda...');
  console.log('Se não abrir sozinho, acesse:\n' + authUrl);
  const [cmd, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', authUrl]]
    : process.platform === 'darwin' ? ['open', [authUrl]] : ['xdg-open', [authUrl]];
  execFile(cmd, args, () => {});
});
