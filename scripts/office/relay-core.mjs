// Pure projection and validation: no credentials or network access.
export const BUSINESSES = new Set(['imperio', 'consultoria-bandeiras']);
export function parseLocalJson(input) {
  try { return JSON.parse(input.trim()); }
  catch { throw new Error('Configuração local inválida'); }
}
const text = (value, max = 300) => typeof value === 'string' ? value.slice(0, max) : '';

export function projectSnapshot(raw, details = new Map()) {
  if (!raw || !Array.isArray(raw.rooms) || !Array.isArray(raw.agents) || raw.meta?.demo) throw new Error('Snapshot real indisponível');
  const rooms = raw.rooms.filter(r => BUSINESSES.has(r.business?.id)).map(r => ({
    id: r.id, name: text(r.name), businessId: r.business.id, businessName: text(r.business.name),
    areaName: text(r.area?.name || r.name), permanent: r.permanent === true,
  }));
  const byRoom = new Map(rooms.map(r => [r.id, r]));
  const agents = raw.agents.flatMap(a => {
    const room = byRoom.get(a.roomId);
    if (!room || a.status === 'offline' || a.status === 'done') return [];
    // Details are already masked by Habblaud; a missing detail disables decisions.
    const permission = a.permission && details.get(a.permission.id);
    return [{ id: a.id, sessionId: a.sessionId, name: text(a.name), provider: a.provider || 'claude',
      roomId: room.id, businessId: room.businessId, title: text(a.title), status: a.status,
      activity: text(a.activity?.text), waitingFor: text(a.waitingFor), canMessage: a.canMessage === true,
      tasks: (a.tasks || []).slice(0, 10).map(t => ({ title: text(t.title), status: t.status })),
      permission: permission ? { id: permission.id, title: text(permission.title), tool: text(permission.tool),
        input: text(permission.input, 18000), questions: permission.questions || [], expiresAt: permission.expiresAt } : null,
    }];
  });
  return { rooms, agents, capturedAt: Date.now() };
}

export function prepareAction(command, snapshot, now = Date.now()) {
  if (Date.parse(command.expires_at) <= now) throw new Error('Instrução expirada');
  const a = snapshot.agents.find(a => a.id === command.agent_id && a.sessionId === command.session_id && a.businessId === command.business_id);
  if (!a || !BUSINESSES.has(a.businessId)) throw new Error('Sessão ou empresa não corresponde');
  const p = command.payload;
  if (command.kind === 'message') {
    if (!a.canMessage || typeof p?.text !== 'string' || !p.text.trim() || p.text.length > 4000) throw new Error('Mensagem indisponível ou inválida');
    return { path: '/api/messages', body: { agentId: a.id, text: p.text.trim() } };
  }
  if (command.kind !== 'decision' || !a.permission || a.permission.id !== p?.permissionId || a.permission.expiresAt <= now) throw new Error('Pendência expirou ou foi substituída');
  const d = p.decision;
  if (!d || !['allow','deny','answer','terminal'].includes(d.behavior) || d.suggestion !== undefined || d.interrupt !== undefined) throw new Error('Decisão inválida');
  const questions = a.permission.questions;
  if (d.behavior === 'answer') {
    if (!questions.length || !Array.isArray(d.answers) || d.answers.length !== questions.length) throw new Error('Responda todas as perguntas');
    const seen = new Set();
    for (const answer of d.answers) {
      const q = questions.find(q => q.index === answer.question);
      if (!q || seen.has(q.index)) throw new Error('Pergunta inválida');
      seen.add(q.index);
      const options = answer.options || [];
      if (!Array.isArray(options) || new Set(options).size !== options.length || options.some(i => !q.options.some(o => o.index === i))) throw new Error('Opção inválida');
      const other = typeof answer.other === 'string' ? answer.other.trim() : '';
      if (other.length > 2000 || (!options.length && !other) || (!q.multiSelect && options.length + Number(!!other) !== 1)) throw new Error('Resposta inválida');
    }
  } else if (questions.length && d.behavior !== 'terminal') throw new Error('Esta pendência exige resposta às perguntas');
  return { path: `/api/permissions/${encodeURIComponent(a.permission.id)}/decision`, body: d };
}
