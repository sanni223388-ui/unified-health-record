const http = require('http');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = 'http://127.0.0.1:53682/oauth2/callback';
const state = crypto.randomBytes(24).toString('hex');

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env before running this helper.');
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/gmail.send',
  access_type: 'offline',
  prompt: 'consent',
  state
}).toString();

const server = http.createServer(async (req, res) => {
  const callbackUrl = new URL(req.url, redirectUri);
  if (callbackUrl.pathname !== '/oauth2/callback' || callbackUrl.searchParams.get('state') !== state) {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('Authorization could not be verified. Close this page and try again.');
    return;
  }

  const code = callbackUrl.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('Google did not return an authorization code.');
    return;
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.refresh_token) throw new Error('Google did not issue a refresh token.');

    console.log('\nAuthorization succeeded. Add this value only in Render as GOOGLE_REFRESH_TOKEN:');
    console.log(tokenPayload.refresh_token);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<h1>Authorization complete</h1><p>You can close this window and return to Terminal.</p>');
  } catch (error) {
    console.error('Authorization failed:', error.message);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Authorization failed. Check Terminal for a safe error message.');
  } finally {
    server.close();
  }
});

server.listen(53682, '127.0.0.1', () => {
  console.log('Open this URL in your browser and authorize the Gmail account that will send OTP emails:\n');
  console.log(authUrl.toString());
});
