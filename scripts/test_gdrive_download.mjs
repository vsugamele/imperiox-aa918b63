const id = "1KfWGn66RWbNUl0tcvOAS7RwN9C-vj8pY";
const url = `https://drive.usercontent.google.com/download?id=${id}&export=download`;

async function test() {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await r.text();
  const formMatch = html.match(/<form[^>]+action="([^"]+)"/i);
  const action = formMatch ? formMatch[1] : null;
  const inputMatches = [...html.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi)];
  const params = new URLSearchParams();
  for (const m of inputMatches) {
    params.append(m[1], m[2]);
  }
  console.log("Action URL:", action);
  console.log("Params:", params.toString());

  if (action) {
    const finalUrl = `${action}?${params.toString()}`;
    const r2 = await fetch(finalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': r.headers.get('set-cookie') || '',
      }
    });
    console.log("Response 2 Status:", r2.status);
    console.log("Response 2 Content-Type:", r2.headers.get("content-type"));
    console.log("Response 2 Content-Length:", r2.headers.get("content-length"));
  }
}

test();
