/* Império tracker TRK1.1. One instance per project; no new Pixel installation. */
(function () {
  'use strict';
  var script = document.currentScript;
  var config = window.IMPERIO_FUNNEL || {};
  var project = config.projectId || (script && script.getAttribute('data-project'));
  if (!project) return;
  window.__imperioTrackers = window.__imperioTrackers || {};
  if (window.__imperioTrackers[project]) return;
  window.__imperioTrackers[project] = true;
  var endpoint = config.trackingEndpoint || 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/funnel-track';
  var keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','xcod','creative_id','fbclid','gclid','msclkid','ttclid','campaign_id','adset_id','ad_id'];
  var prefix = 'imperio_tracker_' + project + '_';
  var memory = {};
  function read(k, fallback) { try { var v = config.trackingConsent === false ? memory[k] : JSON.parse(localStorage.getItem(prefix + k)); if (!v || typeof v !== 'object' || (Array.isArray(fallback) && !Array.isArray(v))) return fallback; return v; } catch (_) { return memory[k] || fallback; } }
  function save(k, value) { memory[k] = value; if (config.trackingConsent === false) return; try { localStorage.setItem(prefix + k, JSON.stringify(value)); } catch (_) {} }
  function id() { return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'i_' + Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function cleanUrl(raw) { try { var u = new URL(raw); return u.origin + u.pathname; } catch (_) { return null; } }
  function safeId(v) { return v && /^[a-zA-Z0-9_.-]{1,200}$/.test(v) ? v : null; }
  var qs = new URLSearchParams(location.search);
  var incoming = {}; keys.forEach(function (k) { var v = qs.get(k); if (v) incoming[k] = v.slice(0,500); });
  var now = Date.now();
  var transfer = qs.get('imp_project') === project && now - Number(qs.get('imp_t')) >= 0 && now - Number(qs.get('imp_t')) < 1800000;
  var state = read('state', {});
  if (!state.visitor_id || now - (state.updated_at || 0) > 30 * 86400000) state = { visitor_id: id() };
  if (transfer && safeId(qs.get('imp_vid'))) state.visitor_id = qs.get('imp_vid');
  if (!state.session_id || now - (state.active_at || 0) > 1800000) state.session_id = id();
  if (transfer && safeId(qs.get('imp_sid'))) state.session_id = qs.get('imp_sid');
  var transferredClick = transfer && safeId(qs.get('imp_click_id'));
  var campaignChanged = Object.keys(incoming).length && JSON.stringify(incoming) !== JSON.stringify(state.last_touch && state.last_touch.params || {});
  if (transferredClick) state.click_id = transferredClick;
  else if (!state.click_id || campaignChanged) state.click_id = id();
  if (campaignChanged || !state.last_touch) state.last_touch = { params: incoming, at: new Date(now).toISOString(), landing: cleanUrl(location.href) };
  if (!state.first_touch) state.first_touch = state.last_touch;
  if (transfer && qs.get('imp_ft')) {
    try { var ft = JSON.parse(qs.get('imp_ft')); var fp = {}; keys.forEach(function (k) { if (typeof (ft.params || {})[k] === 'string') fp[k] = ft.params[k].slice(0,500); }); if (Number.isFinite(Date.parse(ft.at))) state.first_touch = { params: fp, at: ft.at, landing: cleanUrl(ft.landing) }; } catch (_) {}
  }
  state.active_at = now; state.updated_at = now; save('state', state);
  var pageType = config.pageType || 'vsl';
  var pitchAt = Number(config.pitchSeconds || (script && script.getAttribute('data-pitch-at')) || 0);
  var ctaSelector = config.ctaSelector || (script && script.getAttribute('data-cta')) || 'a.buylink';
  function active() { var t = Date.now(); if (t - state.active_at > 1800000) state.session_id = id(); state.active_at = t; state.updated_at = t; save('state', state); }
  function decorate(raw) {
    if (config.trackingConsent === false) return raw;
    var u = new URL(raw, location.href);
    if (!/^https?:$/.test(u.protocol)) return raw;
    var attrs = state.last_touch.params || {};
    // Explicit destination attribution wins; affiliate hid/affid/sub IDs are untouched.
    keys.forEach(function (k) { if (attrs[k] && !u.searchParams.has(k)) u.searchParams.set(k, attrs[k]); });
    u.searchParams.set('imp_project', project); u.searchParams.set('imp_vid', state.visitor_id);
    u.searchParams.set('imp_sid', state.session_id); u.searchParams.set('imp_click_id', state.click_id);
    if (!u.searchParams.has('click_id')) u.searchParams.set('click_id',state.click_id);
    u.searchParams.set('imp_t', String(Date.now())); u.searchParams.set('imp_ft', JSON.stringify(state.first_touch));
    return u.href;
  }
  var sending = false;
  var timer;
  function drain() {
    if (sending || navigator.onLine === false || config.trackingConsent === false) return;
    var queue = read('queue', []).filter(function (e) { return Date.now() - e.time < 86400000; });
    save('queue', queue);
    var entry = queue.find(function (e) { return e.attempts < 3 && e.next <= Date.now(); });
    if (!entry) {
      var waiting = queue.filter(function (e) { return e.attempts < 3; });
      if (waiting.length) { clearTimeout(timer); timer = setTimeout(drain, Math.max(100, Math.min.apply(null,waiting.map(function (e) {return e.next;})) - Date.now())); }
      return;
    }
    sending = true;
    entry.attempts++; entry.next = Date.now() + Math.pow(2, entry.attempts) * 1000; save('queue', queue);
    var abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeout = setTimeout(function () { if (abort) abort.abort(); }, 10000);
    fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(entry.payload), keepalive:true, credentials:'omit', signal:abort ? abort.signal : undefined })
      .then(function (r) { return r.json().then(function (b) { if (!r.ok || b.ok !== true) { if (r.status >= 400 && r.status < 500 && r.status !== 429) entry.attempts = 3; throw new Error('event_not_accepted'); } }); })
      .then(function () { save('queue', read('queue', []).filter(function (e) { return e.payload.event_id !== entry.payload.event_id; })); })
      .catch(function () { var latest = read('queue', []); latest.forEach(function (e) { if (e.payload.event_id === entry.payload.event_id) { e.attempts = entry.attempts; e.next = entry.next; } }); save('queue', latest); })
      .finally(function () { clearTimeout(timeout); sending = false; clearTimeout(timer); timer = setTimeout(drain, 1000); });
  }
  function track(step, extra) {
    if (config.trackingConsent === false) return null;
    if (step !== 'heartbeat') active();
    var eid = id();
    var attrs = state.last_touch.params || {};
    var payload = Object.assign({}, attrs, { project_id:project, session_id:state.session_id, visitor_id:state.visitor_id, click_id:state.click_id, event_id:eid, event_at:new Date().toISOString(), step:step, page_url:cleanUrl(location.href), referrer:cleanUrl(document.referrer), first_touch:state.first_touch, last_touch:state.last_touch,
      meta:Object.assign({offer_id:config.offerId || null,player_id:config.playerId || null,page_type:pageType,tracker_version:'TRK1.1',validation:attrs.utm_source === 'codex-validation'},extra || {}) });
    var queue = read('queue', []);
    if (queue.length >= 100) { var h = queue.findIndex(function (e) { return e.payload.step === 'heartbeat'; }); if (h >= 0) queue.splice(h,1); else { console.warn('Imperio tracker: queue full'); return null; } }
    queue.push({payload:payload,time:Date.now(),attempts:0,next:0}); save('queue', queue); drain();
    if (typeof window.gtag === 'function') window.gtag('event', step, {project_id:project,player_id:config.playerId,event_id:eid,debug_mode:attrs.utm_source === 'codex-validation'});
    return eid;
  }
  if (config.measurementId && config.trackingConsent !== false) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', config.measurementId, {page_location:cleanUrl(location.href),page_referrer:cleanUrl(document.referrer) || '',allow_google_signals:false,allow_ad_personalization_signals:false,debug_mode:(state.last_touch.params || {}).utm_source === 'codex-validation'});
    var ga = document.createElement('script'); ga.async = true; ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(config.measurementId); document.head.appendChild(ga);
  }
  if (config.pixelId && config.trackingConsent !== false) {
    if (!window.fbq) {
      window.fbq = function () { if (window.fbq.callMethod) window.fbq.callMethod.apply(window.fbq,arguments); else window.fbq.queue.push(arguments); };
      window.fbq.queue = []; window.fbq.loaded = true; window.fbq.version = '2.0'; window._fbq = window.fbq;
      var px = document.createElement('script'); px.async = true; px.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(px);
    }
    window.fbq('init', config.pixelId);
  }
  function decorateLinks() { document.querySelectorAll(ctaSelector).forEach(function (link) { if (link.tagName === 'A') link.href = decorate(link.getAttribute('data-destination') || config.checkoutUrl || link.href); }); }
  decorateLinks();
  document.addEventListener('click', function (ev) {
    var link = ev.target && ev.target.closest ? ev.target.closest(ctaSelector) : null;
    if (!link) return; active();
    if (link.tagName === 'A') link.href = decorate(link.getAttribute('data-destination') || config.checkoutUrl || link.href);
    track(pageType === 'advertorial' ? 'advertorial_cta_click' : pageType === 'pdp' ? 'pdp_cta_click' : 'vsl_cta_click', {destination_host:link.href ? new URL(link.href).hostname : null,page_type:pageType});
  }, true);
  var observed = new WeakSet(); var reached = {}; var cta = document.querySelector('.esconder');
  function reach(step, playerId, extra) { var key = playerId + ':' + step; if (reached[key]) return; reached[key] = true; track(step,Object.assign({player_id:playerId},extra || {})); }
  function bindPlayer(player, smart) {
    if (!player || observed.has(player)) return; observed.add(player);
    var pid = config.playerId || player.id || 'html-video';
    reach('vsl_instrumented',pid,{retention_configured:true,pitch_configured:pitchAt>0,player_api:smart ? 'vturb' : 'html'});
    var autoplay = function () { return smart && player.inSmartAutoPlay; };
    player.addEventListener(smart ? 'video:play' : 'play', function () { if (!autoplay()) reach('vsl_play',pid); });
    player.addEventListener(smart ? 'video:timeupdate' : 'timeupdate', function (ev) {
      if (autoplay()) return;
      var time = Number(ev.detail && ev.detail.time !== undefined ? ev.detail.time : player.currentTime);
      var duration = Number(player.duration);
      if (time > 0) reach('vsl_play',pid);
      [25,50,75,90].forEach(function (pct) { if (duration > 0 && time / duration * 100 >= pct) reach('vsl_' + pct,pid,{position_seconds:time,duration_seconds:duration}); });
      if (pitchAt > 0 && time >= pitchAt) reach('vsl_pitch',pid,{position_seconds:time,pitch_evidence:'playhead'});
    });
    player.addEventListener(smart ? 'video:ended' : 'ended',function () { if (!autoplay()) reach('vsl_complete',pid); });
    if (smart && typeof player.injectUrlUpdater === 'function') player.injectUrlUpdater(decorate);
    if (smart && cta && pitchAt > 0 && typeof player.displayHiddenElements === 'function') player.displayHiddenElements(pitchAt,['.esconder'],{persist:true});
  }
  function scanPlayers() {
    if (typeof document === 'undefined' || !document) return;
    document.querySelectorAll('video').forEach(function (p) { bindPlayer(p,false); });
    document.querySelectorAll('vturb-smartplayer').forEach(function (p) { if (p.__imperioReadyHook) return; p.__imperioReadyHook = true; p.addEventListener('player:ready',function () { bindPlayer(p,true); },{once:true}); if (p.duration > 0) bindPlayer(p,true); });
  }
  scanPlayers();
  new MutationObserver(scanPlayers).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('iframe:connected',function (ev) { if (ev.detail) bindPlayer(ev.detail.player,true); });
  if (cta) new MutationObserver(function () { if (getComputedStyle(cta).display !== 'none' && cta.getBoundingClientRect().height > 0) reach('vsl_cta_visible',config.playerId || 'html-video',{pitch_evidence:'cta_visible'}); }).observe(cta,{attributes:true,attributeFilter:['style','class']});
  var viewId = track(pageType === 'advertorial' ? 'advertorial_view' : pageType === 'pdp' ? 'pdp_view' : (script && script.getAttribute('data-step')) || 'vsl_view');
  if (config.pixelId && window.fbq && viewId) window.fbq('track','PageView',{}, {eventID:viewId});
  window.addEventListener('online', drain);
  setInterval(function () { if (document.visibilityState === 'visible' && Date.now() - state.active_at < 1800000) track('heartbeat'); },30000);
  window.imperioTracker = {track:track,decorate:decorate,getIdentity:function () { return {visitor_id:state.visitor_id,session_id:state.session_id,click_id:state.click_id}; },getTouches:function () { return {first:state.first_touch,last:state.last_touch}; },getDiagnostics:function () { var q=read('queue',[]); return {version:'TRK1.1',pending:q.length,failed:q.filter(function (e) {return e.attempts >= 3;}).length}; }};
})();
