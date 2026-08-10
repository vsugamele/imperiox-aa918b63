/* Imperio X — Webchat Widget (OpenFlow)
   Uso:
   <script src="https://SEU-APP/webchat.js" data-key="PUBLIC_KEY" data-endpoint="https://xxx.supabase.co/functions/v1/webchat-api" defer></script>
*/
(function () {
  var s = document.currentScript || (function () {
    var all = document.getElementsByTagName("script");
    return all[all.length - 1];
  })();
  var KEY = s.getAttribute("data-key");
  var ENDPOINT = s.getAttribute("data-endpoint");
  if (!KEY || !ENDPOINT) return console.error("[webchat] data-key e data-endpoint são obrigatórios");

  var LS = "imperiox_webchat_" + KEY;
  var visitorId = localStorage.getItem(LS);
  if (!visitorId) {
    visitorId = "v" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(LS, visitorId);
  }
  var since = null, timer = null, cfg = { cor: "#c9922a", titulo: "Fale com a gente", saudacao: "Olá! Como podemos ajudar?" };

  function api(action, extra) {
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ action: action, public_key: KEY, visitor_id: visitorId }, extra || {})),
    }).then(function (r) { return r.json(); });
  }

  var root = document.createElement("div");
  root.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,sans-serif";
  document.body.appendChild(root);

  root.innerHTML =
    '<div id="ix-panel" style="display:none;width:340px;max-width:calc(100vw - 40px);height:460px;max-height:70vh;background:#0f0f14;color:#f5f5f5;border:1px solid rgba(255,255,255,.1);border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.5);flex-direction:column">' +
    '  <div id="ix-head" style="padding:14px 16px;font-weight:600;font-size:14px;display:flex;justify-content:space-between;align-items:center"><span id="ix-title"></span><span id="ix-close" style="cursor:pointer;opacity:.7">✕</span></div>' +
    '  <div id="ix-msgs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:1.45"></div>' +
    '  <div style="display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.08)">' +
    '    <input id="ix-input" placeholder="Escreva sua mensagem…" style="flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;border-radius:10px;padding:9px 11px;font-size:13px;outline:none" />' +
    '    <button id="ix-send" style="border:0;border-radius:10px;padding:0 14px;font-weight:700;cursor:pointer;color:#0f0f14">→</button>' +
    '  </div>' +
    '</div>' +
    '<button id="ix-fab" style="margin-top:12px;float:right;border:0;width:56px;height:56px;border-radius:50%;cursor:pointer;font-size:22px;color:#0f0f14;box-shadow:0 10px 30px rgba(0,0,0,.4)">💬</button>';

  var $ = function (id) { return root.querySelector("#" + id); };

  function bubble(text, mine) {
    var b = document.createElement("div");
    b.textContent = text;
    b.style.cssText =
      "max-width:82%;padding:8px 11px;border-radius:12px;white-space:pre-wrap;word-break:break-word;" +
      (mine
        ? "align-self:flex-end;background:" + cfg.cor + ";color:#0f0f14;font-weight:500"
        : "align-self:flex-start;background:rgba(255,255,255,.08)");
    $("ix-msgs").appendChild(b);
    $("ix-msgs").scrollTop = $("ix-msgs").scrollHeight;
  }

  function poll() {
    api("poll", { since: since }).then(function (r) {
      (r.messages || []).forEach(function (m) {
        since = m.created_at;
        if (m.direction === "out" && m.texto) bubble(m.texto, false);
      });
    }).catch(function () {});
  }

  function send() {
    var v = ($("ix-input").value || "").trim();
    if (!v) return;
    $("ix-input").value = "";
    bubble(v, true);
    api("send", { content: v, page_url: location.href }).catch(function () {
      bubble("Não conseguimos enviar agora. Tente novamente.", false);
    });
  }

  function open() {
    $("ix-panel").style.display = "flex";
    $("ix-fab").style.display = "none";
    if (!timer) { poll(); timer = setInterval(poll, 4000); }
    $("ix-input").focus();
  }
  function close() {
    $("ix-panel").style.display = "none";
    $("ix-fab").style.display = "block";
  }

  api("init").then(function (r) {
    if (r && r.widget) cfg = Object.assign(cfg, r.widget);
    $("ix-title").textContent = cfg.titulo || "Fale com a gente";
    $("ix-fab").style.background = cfg.cor;
    $("ix-send").style.background = cfg.cor;
    $("ix-head").style.background = "linear-gradient(180deg," + cfg.cor + "22,transparent)";
    if (cfg.saudacao) bubble(cfg.saudacao, false);
  }).catch(function () {});

  $("ix-fab").onclick = open;
  $("ix-close").onclick = close;
  $("ix-send").onclick = send;
  $("ix-input").addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
})();
