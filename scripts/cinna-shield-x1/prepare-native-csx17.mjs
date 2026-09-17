import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { parseConfig } = await import(pathToFileURL(resolve(root, 'src/lib/cinna-shield-x1/engine.ts')).href);
const { compileNativeCinna } = await import(pathToFileURL(resolve(root, 'src/lib/cinna-shield-x1/native-contract.ts')).href);
const read = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const config = parseConfig(await read('scripts/cinna-shield-x1/flow.yaml'));
const before = await read('docs/sessions/2026-09/cinna-native-before-CSX1.7.json');
const voices = await read('scripts/cinna-shield-x1/voice-manifest.json');
const actions = [];
const used = new Set();
const base = 'https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/creative-assets/cinna-shield/csx17';
for (const [stageIndex, stage] of config.stages.entries()) {
  const copy = id => {
    const previous = before.acoes.find(action => action.id === id);
    if (!previous || used.has(id)) throw new Error(`Missing or duplicate original action ${id}`);
    used.add(id); return structuredClone(previous);
  };
  const text = [...stage.messages, stage.question];
  for (const [index, template] of text.entries()) {
    // Media follows explanation and precedes the one question for this stage.
    if (index === text.length - 1) {
      const voice = voices.find(clip => clip.stage === stage.id);
      if (voice) {
        const asset = await read(`docs/sessions/2026-09/csx17-media/${voice.id}.json`);
        actions.push({ id: `cinna-${stage.id}-voice`, tipo: 'audio', template: `${asset.disclosure}\n${voice.text}`, delay_min: 0, delay_sec: 1,
          media: { id: `csx17-${voice.id}`, kind: 'audio', label: `Ana · ${stage.title}`, url: asset.url } });
      }
      const image = stage.id === 'mechanism' ? 'formula-card' : stage.id === 'proof' ? 'purchase-checklist' : null;
      if (image) actions.push({ id: `cinna-${stage.id}-image`, tipo: 'whatsapp', template: image === 'formula-card' ? 'An illustrated guide to the listed ingredients and the details to check.' : 'Here are the purchase details to check before deciding.', delay_min: 0, delay_sec: 1,
        media: { id: `csx17-${image}`, kind: 'image', label: image === 'formula-card' ? 'Formula · illustration' : 'Purchase checklist', url: `${base}/${image}.png` } });
    }
    const action = copy(`cinna-${stage.id}-message-${index}`);
    actions.push({ ...action, template, delay_min: 0, delay_sec: stageIndex === 0 && index === 0 ? 0 : 2 });
  }
  const wait = copy(`cinna-${stage.id}-reply`);
  const { messages: _messages, question: _question, ...metadata } = stage;
  wait.cinna_stage = metadata;
  if (stageIndex === 0) wait.cinna_policy = { ...wait.cinna_policy, version: config.version, replies: config.replies, consultative: config.consultative };
  actions.push(wait);
}
if (used.size !== before.acoes.length) throw new Error('Unexpected existing blocks; reconcile manually before writing.');
const compiled = compileNativeCinna(actions);
if (compiled.config.stages.length !== 9 || JSON.stringify(compiled.config.offer) !== JSON.stringify(before.acoes.find(a => a.cinna_policy).cinna_policy.offer)) {
  // JSON object property order may differ; compare each actual offer field instead.
  const old = before.acoes.find(a => a.cinna_policy).cinna_policy.offer;
  if (compiled.config.stages.length !== 9 || Object.keys(old).some(key => old[key] !== compiled.config.offer[key])) throw new Error('Stage or offer changed unexpectedly.');
}
const target = resolve(root, 'docs/sessions/2026-09/cinna-native-CSX1.7-actions.json');
await writeFile(target, `${JSON.stringify(actions, null, 2)}\n`);
console.log(JSON.stringify({ actions: actions.length, audio: actions.filter(a => a.media?.kind === 'audio').length, images: actions.filter(a => a.media?.kind === 'image').length, waits: compiled.waitSteps.length, version: compiled.config.version }));
