import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareAction, projectSnapshot, parseLocalJson } from './relay-core.mjs';

test('accepts Windows stdin BOM without exposing malformed configuration', () => {
  assert.deepEqual(parseLocalJson('\uFEFF{"configured":true}\r\n'), {configured:true});
  assert.throws(() => parseLocalJson('private-input-that-must-not-appear'), error => error.message === 'Configuração local inválida');
});

const room = { id:'room', name:'Tecnologia', business:{id:'imperio',name:'Império'}, area:{name:'Tecnologia'} };
const agent = {id:'agent',sessionId:'session',roomId:'room',name:'Teste',status:'idle',canMessage:true};
const raw = { rooms:[room,{id:'private',business:{id:'other'}}], agents:[agent,{...agent,id:'private',roomId:'private'}],meta:{demo:false} };
const command = {agent_id:'agent',session_id:'session',business_id:'imperio',kind:'message',payload:{text:'Confirme recebimento'},expires_at:new Date(Date.now()+45000).toISOString()};
test('projects only configured companies and omits paths, accounts and transcripts', () => {
  const view = projectSnapshot(raw);
  assert.equal(view.agents.length,1); assert.equal(view.rooms.length,1);
  assert.equal(view.agents[0].account,undefined); assert.equal(view.rooms[0].path,undefined);
  assert.equal(view.agents[0].permission,null);
});
test('rejects demos', () => assert.throws(() => projectSnapshot({...raw,meta:{demo:true}})));
test('valid instruction keeps exact agent target', () => assert.deepEqual(prepareAction(command,projectSnapshot(raw)),{path:'/api/messages',body:{agentId:'agent',text:'Confirme recebimento'}}));
test('rejects different session, company, expiration or unavailable messages', () => {
  const view = projectSnapshot(raw);
  for (const change of [{session_id:'new-session'},{business_id:'consultoria-bandeiras'},{expires_at:'2000-01-01'},{payload:{text:' '}}]) assert.throws(() => prepareAction({...command,...change},view));
  assert.throws(() => prepareAction(command,projectSnapshot({...raw,agents:[{...agent,canMessage:false}]})));
});
const p = {id:'pending',title:'Pergunta',tool:'AskUserQuestion',input:'',expiresAt:Date.now()+60000,
 questions:[{index:0,question:'Confirmar?',options:[{index:0,label:'Sim'},{index:1,label:'Não'}]}]};
const view = projectSnapshot({...raw,agents:[{...agent,permission:p}]},new Map([['pending',p]]));
const answer = {...command,kind:'decision',payload:{permissionId:'pending',decision:{behavior:'answer',answers:[{question:0,options:[0]}]}}};
test('delivers one answer to the current permission', () => assert.equal(prepareAction(answer,view).path,'/api/permissions/pending/decision'));
test('rejects replaced permission, invalid options and persistent authorization', () => {
 assert.throws(() => prepareAction({...answer,payload:{...answer.payload,permissionId:'new'}},view));
 for (const decision of [{behavior:'allow'},{behavior:'answer',answers:[{question:0,options:[99]}]},
 {behavior:'answer',answers:[{question:0,options:[0,1]}]},
 {behavior:'answer',answers:[{question:0,options:[0]}],suggestion:0}]) assert.throws(() => prepareAction({...answer,payload:{permissionId:'pending',decision}},view));
});
