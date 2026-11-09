// Shared access to the isolated test instance. It is bound to the test port on purpose.
// Environment: OCTA_HA_CREDS (JSON with refresh_token, client_id), OCTA_HA_CONFIG (test config dir).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';

export const BASE = 'http://127.0.0.1:18123';

const { OCTA_HA_CREDS: credsPath, OCTA_HA_CONFIG: configDir } = process.env;
if (!credsPath || !configDir) throw new Error('OCTA_HA_CREDS and OCTA_HA_CONFIG are required');
// Only a directory that was marked by hand can be changed, so a real configuration is never touched by mistake.
if (!existsSync(join(configDir, '.octa-test-instance'))) throw new Error('Refusing to touch a config directory without .octa-test-instance');

export const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const creds = JSON.parse(readFileSync(credsPath, 'utf8'));

const body = new URLSearchParams({
  grant_type: 'refresh_token',
  refresh_token: creds.refresh_token,
  client_id: creds.client_id,
});
export const token = (await (await fetch(`${BASE}/auth/token`, { method: 'POST', body })).json()).access_token;

export function wsCall(message) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${BASE.replace('http', 'ws')}/api/websocket`);
    socket.onerror = () => reject(new Error('WebSocket failed'));
    socket.onmessage = ({ data }) => {
      const reply = JSON.parse(data);
      if (reply.type === 'auth_required') socket.send(JSON.stringify({ type: 'auth', access_token: token }));
      else if (reply.type === 'auth_ok') socket.send(JSON.stringify({ id: 1, ...message }));
      else if (reply.id === 1) {
        socket.close();
        resolve(reply);
      }
    };
  });
}

export function api(path, options = {}) {
  return fetch(`${BASE}/api/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

/** Unpacks the built ZIP into the test instance and reloads the themes. */
export async function installZip() {
  const zip = unzipSync(readFileSync(`dist/octa-home-ui-${version}.zip`));
  for (const [name, content] of Object.entries(zip)) {
    const target = join(configDir, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  await api('services/frontend/reload_themes', { method: 'POST', body: '{}' });
}

/** Signs a new browser context in. `selectedTheme` is the value HA keeps per browser. */
export async function signedInContext(browser, options, selectedTheme) {
  const context = await browser.newContext(options);
  const hassTokens = JSON.stringify({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 1800,
    hassUrl: BASE,
    clientId: creds.client_id,
    expires: Date.now() + 1800000,
    refresh_token: creds.refresh_token,
  });
  await context.addInitScript(
    ([tokens, theme]) => {
      localStorage.setItem('hassTokens', tokens);
      if (theme) localStorage.setItem('selectedTheme', theme);
    },
    [hassTokens, selectedTheme ? JSON.stringify(selectedTheme) : null],
  );
  return context;
}
