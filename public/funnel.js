/**
 * ImperioHQ Funnel Tracker
 * Uso: <script src="https://imperiox.lovable.app/funnel.js"
 *              data-project="PROJECT_ID"
 *              data-step="vsl_view"
 *              data-pitch-at="1080"   (segundos do vídeo onde dispara vsl_pitch — opcional)
 *              data-cta="#botao-comprar" (seletor opcional para vsl_cta_click)
 *      ></script>
 */
(function () {
  var script = document.currentScript;
  if (!script) return;

  var PROJECT = script.getAttribute("data-project");
  var STEP = script.getAttribute("data-step") || "vsl_view";
  var PITCH_AT = parseInt(script.getAttribute("data-pitch-at") || "0", 10);
  var CTA_SEL = script.getAttribute("data-cta");
  var ENDPOINT = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/funnel-track";

  if (!PROJECT) {
    console.warn("[funnel-track] data-project ausente");
    return;
  }

  // ---- Sessão persistente (30 min de inatividade) ----
  var SK = "imp_funnel_sid";
  var TK = "imp_funnel_t";
  var now = Date.now();
  var sid = localStorage.getItem(SK);
  var lastT = parseInt(localStorage.getItem(TK) || "0", 10);
  if (!sid || now - lastT > 30 * 60 * 1000) {
    sid = "s_" + Math.random().toString(36).slice(2) + now.toString(36);
  }
  localStorage.setItem(SK, sid);
  localStorage.setItem(TK, String(now));

  // ---- Coleta UTMs (URL atual + cache) ----
  var qs = new URLSearchParams(window.location.search);
  var UTM_KEYS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content",
    "utm_term", "utm_id", "xcod", "fbclid",
  ];
  var CACHE = "imp_funnel_utms";
  var cached = {};
  try { cached = JSON.parse(localStorage.getItem(CACHE) || "{}"); } catch (e) {}
  var utms = {};
  UTM_KEYS.forEach(function (k) {
    var v = qs.get(k);
    if (v) utms[k] = v;
    else if (cached[k]) utms[k] = cached[k];
  });
  if (Object.keys(utms).some(function (k) { return qs.get(k); })) {
    try { localStorage.setItem(CACHE, JSON.stringify(utms)); } catch (e) {}
  }

  function send(stepName, extra) {
    var payload = {
      project_id: PROJECT,
      session_id: sid,
      step: stepName,
      page_url: window.location.href,
      referrer: document.referrer || null,
    };
    UTM_KEYS.forEach(function (k) { if (utms[k]) payload[k] = utms[k]; });
    if (extra) Object.keys(extra).forEach(function (k) { payload[k] = extra[k]; });

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "omit",
    }).catch(function () {});
  }

  // 1) Pageview da etapa
  send(STEP);

  // 2) Heartbeat a cada 30s para "online agora"
  setInterval(function () {
    localStorage.setItem(TK, String(Date.now()));
    send("heartbeat");
  }, 30000);

  // 3) Pitch da VSL (timestamp configurado)
  if (PITCH_AT > 0) {
    var fired = false;
    var checkVideo = function () {
      var vids = document.querySelectorAll("video");
      vids.forEach(function (v) {
        v.addEventListener("timeupdate", function () {
          if (!fired && v.currentTime >= PITCH_AT) {
            fired = true;
            send("vsl_pitch");
          }
        });
      });
    };
    if (document.readyState === "complete") checkVideo();
    else window.addEventListener("load", checkVideo);
  }

  // 4) Clique no CTA
  if (CTA_SEL) {
    document.addEventListener("click", function (ev) {
      var t = ev.target;
      while (t && t !== document.body) {
        if (t.matches && t.matches(CTA_SEL)) {
          send("vsl_cta_click");
          break;
        }
        t = t.parentElement;
      }
    }, true);
  }
})();
