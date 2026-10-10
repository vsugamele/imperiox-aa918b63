import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync, renameSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectSnapshot, prepareAction, parseLocalJson } from './relay-core.mjs';

// DPAPI configuration arrives on stdin, never in arguments, environment or logs.
let input = '';
for await (const chunk of process.stdin) input += chunk;
let config;
try { config = parseLocalJson(input); }
catch { process.stderr.write('Configuração local inválida\n'); process.exit(1); }
input = '';
const local = 'http://127.0.0.1:4747';
const stateDir = join(process.env.USERPROFILE, '.habblaud', 'imperio');
mkdirSync(stateDir, { recursive: true });
const receiptPath = join(stateDir, 'receipts.json');
let receipts = [];
try { receipts = JSON.parse(readFileSync(receiptPath, 'utf8')); } catch { /* first run */ }
const persist = () => { writeFileSync(`${receiptPath}.tmp`, JSON.stringify(receipts)); renameSync(`${receiptPath}.tmp`, receiptPath); };
const log = message => appendFileSync(join(stateDir, 'relay.log'), `${new Date().toISOString()} ${message}\n`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let stopped = false;
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => { stopped = true; });
async function request(path, body) {
  const r = await fetch(`${local}${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Origin: local },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  const data = await r.json();
  if (!r.ok) throw new Error('Habblaud recusou o pedido');
  return data;
}
async function snapshot() {
  const raw = await request('/api/snapshot');
  const details = new Map();
  await Promise.all(raw.agents.filter(a => a.permission).map(async a => {
    try { details.set(a.permission.id, await request(`/api/permissions/${encodeURIComponent(a.permission.id)}`)); } catch { /* stale permission */ }
  }));
  return projectSnapshot(raw, details);
}
async function sync(view) {
  const r = await fetch(`${config.url}/rest/v1/rpc/imphq_office_sync`, {
    method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_device: config.deviceId, p_token: config.token, p_snapshot: view, p_receipts: receipts }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`Conector indisponível (${r.status})`);
  const jobs = await r.json();
  receipts = []; persist();
  return jobs;
}
// A local SSE viewer keeps real PermissionRequest hooks available without a desktop browser.
async function keepViewer() {
  while (!stopped) {
    try {
      const r = await fetch(`${local}/api/stream`);
      if (!r.ok || !r.body) throw new Error('stream');
      for await (const chunk of r.body) { if (stopped) break; void chunk; }
    } catch { /* reconnect */ }
    await sleep(3000);
  }
}
void keepViewer();
let serverStartingAt = 0;
async function ensureLocal() {
  try { await request('/api/health'); return; } catch { /* supervised restart */ }
  if (Date.now() - serverStartingAt < 30000) return;
  serverStartingAt = Date.now();
  const env = { ...process.env, HABBLAUD_HOST: '127.0.0.1', HABBLAUD_UPDATE_CHECK: '0', HABBLAUD_CODEX_BIN: config.codexBin };
  const child = spawn(process.execPath, ['dist/server/index.js'], { cwd: config.habblaudRoot, env, windowsHide: true, detached: true, stdio: 'ignore' });
  child.on('error', () => log('Falha ao iniciar Habblaud')); child.unref();
  log('Inicialização local solicitada');
}
log('Conector iniciado');
while (!stopped) {
  try {
    await ensureLocal();
    let view = null;
    try { view = await snapshot(); } catch { /* do not heartbeat or claim when local source is down */ }
    const jobs = await sync(view);
    for (const job of jobs) {
      let status = 'failed', result = { message: 'Sessão indisponível' };
      let dispatched = false;
      try {
        const fresh = await snapshot();
        const action = prepareAction(job, fresh);
        dispatched = true;
        const reply = await request(action.path, action.body);
        if (job.kind === 'message') {
          for (let n = 0; n < 10 && !['delivered','failed'].includes(reply.status); n++) {
            await sleep(500);
            Object.assign(reply, await request(`/api/messages/${encodeURIComponent(reply.id)}`));
          }
          status = reply.status === 'delivered' ? 'delivered' : reply.status === 'failed' ? 'failed' : 'unknown';
          result = { message: status === 'delivered' ? 'Instrução entregue à sessão' : status === 'failed' ? 'Entrega recusada' : 'Entrega sem confirmação; confira a sessão antes de reenviar' };
        } else { status = 'delivered'; result = { message: 'Resposta recebida pelo Habblaud' }; }
      } catch {
        status = dispatched ? 'unknown' : 'failed';
        result = { message: dispatched ? 'Resultado incerto; confira a sessão antes de reenviar' : 'Sessão, empresa ou pendência indisponível' };
      }
      receipts.push({ id: job.id, status, result }); persist();
      log(`Comando ${job.id}: ${status}`);
    }
  } catch { log('Sem conexão; nova consulta automática, sem repetir comandos'); }
  await sleep(3000);
}
