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
  var since = null, timer = null;
  var cfg = {
    cor: "#c9922a",
    titulo: "Fale com a gente",
    saudacao: "Olá! Como podemos ajudar?",
    tema: "padrao",
    avatar_url: null,
    subtitulo: "online",
    som: true,
    texto_digitando: "digitando...",
    texto_gravando: "gravando audio...",
  };

  // Paletas: padrão (escuro) e whatsapp (conversa real)
  var SKIN = {
    padrao: { panel: "#0f0f14", text: "#f5f5f5", msgsBg: "transparent", inBubble: "rgba(255,255,255,.08)", inText: "#f5f5f5", headBg: null },
    whatsapp: { panel: "#111b21", text: "#e9edef", msgsBg: "#0b141a", inBubble: "#202c33", inText: "#e9edef", headBg: "#202c33", outBubble: "#005c4b", outText: "#e9edef" },
  };
  function skin() { return SKIN[cfg.tema === "whatsapp" ? "whatsapp" : "padrao"]; }

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
    '<div id="ix-panel" style="display:none;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:76vh;border:1px solid rgba(255,255,255,.1);border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.5);flex-direction:column">' +
    '  <div id="ix-head" style="padding:10px 14px;display:flex;gap:10px;align-items:center">' +
    '    <img id="ix-avatar" alt="" style="display:none;width:36px;height:36px;border-radius:50%;object-fit:cover;flex:0 0 auto" />' +
    '    <div style="flex:1;min-width:0">' +
    '      <div id="ix-title" style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>' +
    '      <div id="ix-sub" style="font-size:11px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>' +
    '    </div>' +
    '    <span id="ix-close" style="cursor:pointer;opacity:.7">✕</span>' +
    '  </div>' +
    '  <div id="ix-msgs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px;font-size:13.5px;line-height:1.45"></div>' +
    '  <div id="ix-bar" style="display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.08)">' +
    '    <input id="ix-input" placeholder="Escreva sua mensagem…" style="flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:inherit;border-radius:20px;padding:9px 13px;font-size:13px;outline:none" />' +
    '    <button id="ix-send" style="border:0;border-radius:50%;width:38px;height:38px;font-weight:700;cursor:pointer;color:#0f0f14;flex:0 0 auto">→</button>' +
    '  </div>' +
    '</div>' +
    '<button id="ix-fab" style="margin-top:12px;float:right;border:0;width:56px;height:56px;border-radius:50%;cursor:pointer;font-size:22px;color:#0f0f14;box-shadow:0 10px 30px rgba(0,0,0,.4)">💬</button>';

  var $ = function (id) { return root.querySelector("#" + id); };

  function scroll() { $("ix-msgs").scrollTop = $("ix-msgs").scrollHeight; }

  function shell(mine) {
    var sk = skin();
    var b = document.createElement("div");
    b.style.cssText =
      "max-width:82%;padding:7px 10px;border-radius:12px;white-space:pre-wrap;word-break:break-word;box-shadow:0 1px 1px rgba(0,0,0,.2);" +
      (mine
        ? "align-self:flex-end;background:" + (sk.outBubble || cfg.cor) + ";color:" + (sk.outText || "#0f0f14") + ";border-bottom-right-radius:4px"
        : "align-self:flex-start;background:" + sk.inBubble + ";color:" + sk.inText + ";border-bottom-left-radius:4px");
    return b;
  }

  function bubble(text, mine) {
    var b = shell(mine);
    b.textContent = text;
    $("ix-msgs").appendChild(b);
    scroll();
  }

  function isImg(u) { return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(u); }
  function isAudio(u) { return /\.(mp3|ogg|m4a|wav|opus)(\?|$)/i.test(u); }
  function isUrl(u) { return /^https?:\/\/\S+$/i.test((u || "").trim()); }

  function media(url, mine) {
    var b = shell(mine);
    b.style.padding = "5px";
    if (isImg(url)) {
      var img = document.createElement("img");
      img.src = url;
      img.style.cssText = "max-width:100%;border-radius:9px;display:block";
      img.onload = scroll;
      b.appendChild(img);
    } else {
      var au = document.createElement("audio");
      au.src = url; au.controls = true; au.preload = "none";
      au.style.cssText = "max-width:240px;display:block";
      b.appendChild(au);
    }
    $("ix-msgs").appendChild(b);
    scroll();
  }

  // Indicador "digitando…" / "gravando áudio…"
  var typingEl = null;
  function showTyping(kind) {
    hideTyping();
    typingEl = shell(false);
    typingEl.style.opacity = ".75";
    typingEl.style.fontStyle = "italic";
    typingEl.textContent = kind === "audio" ? cfg.texto_gravando : cfg.texto_digitando;
    $("ix-msgs").appendChild(typingEl);
    scroll();
  }
  function hideTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  // Som curto de nova mensagem (sem arquivo externo)
  var actx = null;
  function ping() {
    if (!cfg.som) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.06, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.18);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + 0.2);
    } catch (e) {}
  }

  // Fila de entrega: mostra "digitando" antes de cada mensagem, em ritmo humano
  var queue = [], draining = false;
  function enqueue(m) { queue.push(m); drain(); }
  function drain() {
    if (draining) return;
    var m = queue.shift();
    if (!m) { hideTyping(); return; }
    draining = true;
    var url = m.media_url || (isUrl(m.texto) && (isImg(m.texto) || isAudio(m.texto)) ? m.texto.trim() : null);
    var isAud = url && isAudio(url);
    var texto = url ? null : m.texto;
    var wait = url ? 1200 : Math.min(2600, 500 + (texto || "").length * 22);
    showTyping(isAud ? "audio" : "text");
    setTimeout(function () {
      hideTyping();
      if (url) media(url, false); else bubble(texto, false);
      ping();
      draining = false;
      drain();
    }, wait);
  }

  function poll() {
    api("poll", { since: since }).then(function (r) {
      (r.messages || []).forEach(function (m) {
        since = m.created_at;
        if (m.direction === "out" && (m.texto || m.media_url)) enqueue(m);
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
    var sk = skin();
    $("ix-panel").style.background = sk.panel;
    $("ix-panel").style.color = sk.text;
    $("ix-msgs").style.background = sk.msgsBg;
    $("ix-title").textContent = cfg.titulo || "Fale com a gente";
    $("ix-sub").textContent = cfg.subtitulo || "";
    if (cfg.avatar_url) { $("ix-avatar").src = cfg.avatar_url; $("ix-avatar").style.display = "block"; }
    $("ix-fab").style.background = cfg.cor;
    $("ix-send").style.background = cfg.tema === "whatsapp" ? "#00a884" : cfg.cor;
    $("ix-send").style.color = cfg.tema === "whatsapp" ? "#fff" : "#0f0f14";
    $("ix-bar").style.background = cfg.tema === "whatsapp" ? "#202c33" : "transparent";
    $("ix-head").style.background = sk.headBg || ("linear-gradient(180deg," + cfg.cor + "22,transparent)");
    if (cfg.saudacao) bubble(cfg.saudacao, false);
  }).catch(function () {});

  $("ix-fab").onclick = open;
  $("ix-close").onclick = close;
  $("ix-send").onclick = send;
  $("ix-input").addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
})();
