import fs from 'fs';

const steps = [
  { step: 2832, name: "The King's Code 2.0" },
  { step: 2840, name: "The Sacred Prayer" },
  { step: 2846, name: "Divine Script (discount)" },
  { step: 2852, name: "Frequency of Angels" },
  { step: 2858, name: "Seed of Faith" },
  { step: 2864, name: "Manuscript of Miracles" }
];

steps.forEach(s => {
  const p = `C:/Users/vsuga/.gemini/antigravity/brain/fb21137e-e8e8-4622-8ba3-6e324270c5ec/.system_generated/steps/${s.step}/output.txt`;
  const raw = fs.readFileSync(p, "utf8");
  const m = raw.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  const data = JSON.parse(m[1]);
  console.log(`\n======================================================`);
  console.log(`=== ${s.name} (${data.links.length} links total) ===`);
  data.links.forEach(l => {
    if (!l.href.includes('swiperadar.notion.site')) {
      console.log(`[${l.text}] -> ${l.href} | Parent: "${l.parentText.replace(/\n/g, ' ')}"`);
    }
  });
});
