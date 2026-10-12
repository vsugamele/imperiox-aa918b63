import fs from 'fs';

const offers = JSON.parse(fs.readFileSync('scripts/swiperadar_spirituality_parsed.json', 'utf8'));

offers.forEach((o, i) => {
  console.log(`\n\n#################################################################`);
  console.log(`### ${i + 1}. ${o.title} [${o.nicho}]`);
  console.log(`#################################################################\n`);
  console.log(o.fullText);
});
