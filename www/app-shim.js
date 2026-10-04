/* 우리아이 퀴즈놀이 — 앱(안드로이드·아이폰)용 연결 코드
   1) 명예의 전당 랭킹 → Firebase(Firestore) 로 저장
   2) 소리 내어 읽기 → 앱에서는 휴대폰 음성 엔진(TextToSpeech 플러그인) 사용
   3) 기기마다 고유 번호(익명 로그인) 만들기
   firebase-config.js 에 Firebase 웹 설정을 넣으면 랭킹이 켜져요. 비워 두면 랭킹 없이 동작해요. */
(function(){
  window.__APP = true;
  document.documentElement.classList.add('app');

  /* ---------- 1. 소리 내어 읽기 (앱 음성 엔진으로 바꿔 끼우기) ---------- */
  const TTS = () => window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech;
  const needPolyfill = !('speechSynthesis' in window) || /Android/i.test(navigator.userAgent);
  if (needPolyfill) {
    const LANGS = ['ko-KR','en-US','ja-JP','zh-CN','fr-FR','de-DE','es-ES','it-IT','ru-RU','pt-BR','vi-VN','th-TH','id-ID','ms-MY','hi-IN','ar-SA','tr-TR','nl-NL','sv-SE','pl-PL','el-GR','he-IL','mn-MN','fil-PH'];
    function Utter(text){ this.text = text || ''; this.lang = 'ko-KR'; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; this.onend = null; this.onstart = null; this.onerror = null; this._l = {}; }
    Utter.prototype.addEventListener = function(t, f){ (this._l[t] = this._l[t] || []).push(f); };
    Utter.prototype._fire = function(t){ const e = {type:t, utterance:this}; try{ this['on'+t] && this['on'+t](e); }catch(_){} (this._l[t] || []).forEach(f => { try{ f(e); }catch(_){} }); };
    const queue = []; let busy = false;
    const next = async () => {
      if (busy || !queue.length) return; busy = true; const u = queue.shift(); u._fire('start');
      try {
        const t = TTS();
        if (t) await t.speak({ text: u.text, lang: (u.voice && u.voice.lang) || u.lang || 'ko-KR', rate: Math.max(.2, Math.min(2, u.rate || 1)), pitch: u.pitch || 1, volume: u.volume == null ? 1 : u.volume, category: 'playback' });
        else if (window.__nativeSS) { await new Promise(r => { const n = new window.__nativeSU(u.text); n.lang = u.lang; n.rate = u.rate; n.onend = n.onerror = r; window.__nativeSS.speak(n); }); }
      } catch (e) { u._fire('error'); }
      busy = false; u._fire('end'); next();
    };
    try { window.__nativeSS = window.speechSynthesis; window.__nativeSU = window.SpeechSynthesisUtterance; } catch(_) {}
    const ss = {
      speaking: false, pending: false, paused: false, onvoiceschanged: null,
      getVoices: () => LANGS.map(l => ({ lang: l, name: l, voiceURI: l, localService: true, default: l === 'ko-KR' })),
      speak: u => { queue.push(u); next(); },
      cancel: () => { queue.length = 0; try { const t = TTS(); t ? t.stop() : (window.__nativeSS && window.__nativeSS.cancel()); } catch(_) {} busy = false; },
      pause(){}, resume(){}, addEventListener(){}, removeEventListener(){}
    };
    const install = () => {
      if (!TTS()) return false;
      try { Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true }); } catch(_) { window.speechSynthesis = ss; }
      window.SpeechSynthesisUtterance = Utter; return true;
    };
    if (!install()) document.addEventListener('deviceready', install);
    window.addEventListener('load', install);
  }

  /* ---------- 2. Firebase 랭킹 (window.claude.use('db') 와 같은 모양으로) ---------- */
  const CFG = window.FIREBASE_CONFIG || {};
  if (!CFG.apiKey || !CFG.projectId) return;   // 설정이 없으면 랭킹은 꺼진 채로 동작
  const KEY = CFG.apiKey, PID = CFG.projectId;
  const DOCS = `https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents`;
  const LS = { get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(_){ return null; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} } };

  // 익명 로그인: 기기마다 하나의 uid
  let auth = LS.get('kq_auth');
  async function token(){
    const now = Date.now();
    if (auth && auth.idToken && auth.exp > now + 60000) return auth.idToken;
    try {
      if (auth && auth.refreshToken) {
        const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${KEY}`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:`grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refreshToken)}` });
        if (r.ok) { const j = await r.json(); auth = { uid: j.user_id, idToken: j.id_token, refreshToken: j.refresh_token, exp: now + (+j.expires_in) * 1000 }; LS.set('kq_auth', auth); return auth.idToken; }
      }
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ returnSecureToken: true }) });
      if (!r.ok) throw new Error('auth');
      const j = await r.json(); auth = { uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, exp: now + (+j.expiresIn) * 1000 }; LS.set('kq_auth', auth); return auth.idToken;
    } catch (e) { const er = new Error('auth'); er.code = 'not_granted'; throw er; }
  }
  // Firestore 값 변환
  const enc = v => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'string' ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  const dec = f => { if (!f) return null; if ('integerValue' in f) return +f.integerValue; if ('doubleValue' in f) return f.doubleValue; if ('stringValue' in f) return f.stringValue; if ('booleanValue' in f) return f.booleanValue; if ('nullValue' in f) return null; if ('arrayValue' in f) return (f.arrayValue.values || []).map(dec); if ('mapValue' in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])); return null; };
  async function call(url, opt){ const t = await token(); const r = await fetch(url, { ...opt, headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + t } }); if (!r.ok) { const e = new Error('db ' + r.status); e.code = r.status === 403 ? 'permission_denied' : 'db'; throw e; } return r.status === 204 ? null : r.json(); }

  function collection(name){
    let order = null, lim = 300;
    const api = {
      orderBy(f, dir){ order = [f, dir || 'asc']; return api; },
      limit(n){ lim = n; return api; },
      doc(id){ return {
        set: data => call(`${DOCS}/${name}/${encodeURIComponent(id)}`, { method:'PATCH', body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }) }),
        delete: () => call(`${DOCS}/${name}/${encodeURIComponent(id)}`, { method:'DELETE' })
      }; },
      async get(){
        const q = { structuredQuery: { from: [{ collectionId: name }], limit: lim } };
        if (order) q.structuredQuery.orderBy = [{ field: { fieldPath: order[0] }, direction: order[1] === 'desc' ? 'DESCENDING' : 'ASCENDING' }];
        const rows = await call(`${DOCS}:runQuery`, { method:'POST', body: JSON.stringify(q) });
        const docs = (rows || []).filter(r => r.document).map(r => ({ id: r.document.name.split('/').pop(), data: () => dec({ mapValue: { fields: r.document.fields } }) }));
        return { docs, size: docs.length, empty: !docs.length };
      },
      onSnapshot(cb, err){ let stop = false; const tick = async () => { if (stop) return; try { cb(await api.get()); } catch (e) { err && err(e); } if (!stop) setTimeout(tick, 20000); }; tick(); return () => { stop = true; }; }
    };
    return api;
  }
  const db = { collection };
  const user = { id: async () => { await token(); return auth && auth.uid; } };
  window.claude = window.claude || { use: async what => what === 'db' ? db : what === 'user' ? user : null };
})();
