const $ = (id) => document.getElementById(id);
let config;
let sessionId;
let state;
let busy = false;
let pending;
const actions = { start: 'Início', advance: 'Avançou uma etapa', hold: 'Pergunta preservada', checkout: 'Checkout disponível', stop: 'Automação parada', human: 'Pausado para humano', complete: 'Conversa concluída', ignored: 'Sem nova resposta' };
const sources = { script: 'Roteiro', rules: 'Regras', ai: 'IA + resposta aprovada', fallback: 'Fallback sem IA' };
function lock(value) {
  busy = value;
  const active = state?.status === 'active';
  document.querySelectorAll('[data-message], #send, #message').forEach(el => { el.disabled = busy || !active; });
  $('reset').disabled = busy;
  $('send').textContent = value ? 'Processando…' : pending ? 'Tentar novamente' : 'Enviar ↗';
}
function bubble(text, user = false) {
  const node = document.createElement('div');
  node.className = `bubble${user ? ' user' : ''}`;
  const speaker = document.createElement('span');
  speaker.className = 'speaker';
  speaker.textContent = user ? 'Você' : 'Cinna Shield · assistente virtual';
  node.append(speaker, document.createTextNode(text));
  $('messages').append(node);
  $('messages').scrollTop = $('messages').scrollHeight;
}
function show(decision) {
  state = decision.state;
  decision.messages.forEach(m => bubble(m));
  $('choices').replaceChildren();
  if (state.status === 'active') (decision.choices || []).forEach(label => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.message = label; button.textContent = label;
    button.addEventListener('click', () => send(label));
    $('choices').append(button);
  });
  $('stage-label').textContent = config.stages[state.stageIndex].title;
  $('source').textContent = sources[decision.source];
  $('action').textContent = actions[decision.action];
  $('warning').textContent = decision.warning ? (decision.action === 'human' ? 'Oferta não confirmada. O simulador pausou; nenhum atendente foi notificado.' : 'IA não disponível para interpretar essa resposta. A pergunta foi mantida; tente “Continue” ou um dos exemplos.') : state.status === 'human' ? 'Pausa local. Nenhum atendente foi notificado neste ambiente.' : '';
  [...$('stages').children].forEach((node, i) => {
    node.className = i === state.stageIndex ? 'current' : i < state.stageIndex ? 'done' : '';
    if (i === state.stageIndex) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current');
  });
}
async function post(path, data) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Falha de conexão');
  return result;
}
async function reset() {
  if (busy) return;
  lock(true); $('error').textContent = '';
  try {
    const result = await post('/api/session', {});
    sessionId = result.sessionId; pending = undefined;
    $('messages').replaceChildren(); $('message').value = '';
    show(result.decision);
  } catch { $('error').textContent = 'Não foi possível iniciar. Verifique se o servidor local continua aberto e tente novamente.'; }
  finally { lock(false); }
}
async function send(message) {
  if (busy || !state || state.status !== 'active') return;
  if (!pending && !message.trim()) return;
  if (!pending) { pending = { sessionId, eventId: crypto.randomUUID(), revision: state.revision, message: message.trim() }; bubble(pending.message, true); }
  lock(true); $('error').textContent = '';
  try {
    const result = await post('/api/message', pending);
    show(result.decision); pending = undefined; $('message').value = '';
  } catch { $('error').textContent = 'Não foi possível confirmar a resposta. Clique em “Tentar novamente” para repetir a mesma mensagem, ou abra uma nova conversa.'; }
  finally { lock(false); if (state.status === 'active') $('message').focus(); }
}
$('composer').addEventListener('submit', e => { e.preventDefault(); send($('message').value); });
$('reset').addEventListener('click', reset);
document.querySelectorAll('[data-message]').forEach(button => button.addEventListener('click', () => send(button.dataset.message)));
async function init() {
  lock(true);
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Config unavailable');
    config = await response.json();
    config.stages.forEach(stage => { const node = document.createElement('li'); node.textContent = stage.title; $('stages').append(node); });
    $('ai-status').textContent = config.aiEnabled ? 'IA configurada' : 'IA não configurada · regras locais';
    busy = false; await reset();
  } catch { $('error').textContent = 'Servidor indisponível. Inicie o comando local e recarregue a página.'; lock(false); }
}
init();
