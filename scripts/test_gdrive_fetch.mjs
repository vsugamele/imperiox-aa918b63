const id = "1BddUhqBq76wTrHCeg1b8BuuA48r46bXQ";
const urls = [
  `https://docs.google.com/document/d/${id}/export?format=txt`,
  `https://drive.usercontent.google.com/download?id=${id}&export=download`,
  `https://drive.google.com/uc?export=download&id=${id}`
];

for (const u of urls) {
  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const txt = await res.text();
    console.log(u, "Status:", res.status, "Length:", txt.length, "Preview:", txt.slice(0, 150).replace(/\n/g, ' '));
  } catch (e) {
    console.log(u, "Error:", e.message);
  }
}
