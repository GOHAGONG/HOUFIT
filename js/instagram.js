// js/instagram.js
(function () {
  // --- 0) 인스타 인앱 브라우저 판별 ---
  var UA = navigator.userAgent || '';
  var IS_IG = /Instagram/i.test(UA);
  if (!IS_IG) return; // 인스타 아니면 아무것도 안 함

  // 중복 전송 방지 플래그 (페이지 내 1회만 기록)
  // + 세션 락(같은 탭/세션에서 중복 방지)
  // 같은 경로+utm 조합에 대해 세션 동안 1회만 기록
  function pageKey() {
    var url = new URL(location.href);
    var utm = url.searchParams.get('utm') || '';
    return 'houfit:visit:' + (url.origin + url.pathname) + '?utm=' + utm;
  }
  var LOCK_KEY = pageKey();
  var alreadySent = !!window.__houfit_visitLogged || sessionStorage.getItem(LOCK_KEY) === '1';
  if (alreadySent) return;

  function markSent() {
    window.__houfit_visitLogged = true;
    try { sessionStorage.setItem(LOCK_KEY, '1'); } catch(e){}
  }

  // --- 1) 유저 ID (기존 cookie 'user' 재사용) ---
  function getCookie(name) {
    var m = document.cookie.match('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : undefined;
  }
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days || 180) * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + d.toUTCString() + '; path=/';
  }
  function getOrMakeUserId() {
    var id = getCookie('user');
    if (id) return id;
    id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setCookie('user', id, 180);
    return id;
  }

  // --- 2) 타임스탬프 ---
  function pad(v) { return v < 10 ? '0' + v : '' + v; }
  function nowString() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
           pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // --- 3) UTM robust: URL → localStorage 캐시, 없으면 instagram으로 보정 ---
  function parseUtm() {
    var p = new URLSearchParams(location.search);
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('utm_cache') || '{}'); } catch (e) {}

    var utm = p.get('utm') || saved.utm || 'instagram'; // IG에서는 기본 instagram
    var utm_source   = p.get('utm_source')   || saved.utm_source   || 'instagram';
    var utm_medium   = p.get('utm_medium')   || saved.utm_medium   || '';
    var utm_campaign = p.get('utm_campaign') || saved.utm_campaign || '';

    var merged = { utm: utm, utm_source: utm_source, utm_medium: utm_medium, utm_campaign: utm_campaign };
    localStorage.setItem('utm_cache', JSON.stringify(merged));
    return merged;
  }

  // --- 4) 디바이스 구분 (기존 로직에 맞춤) ---
  var device = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(UA) ? 'mobile' : 'desktop';

  // --- 5) 전송 엔드포인트 (GAS) ---
  // 페이지 전역에 addrScript가 있으면 재사용, 없으면 하드코딩 백업
  var ADDR = (typeof window.addrScript === 'string' && window.addrScript) ||
             'https://script.google.com/macros/s/AKfycbymim2BIQy1PJx22y3-z1ctTuwWbA8wcfk9uCzeBJ3ThXEcLBQiYwDvghputd94juZa/exec';

  // (옵션) 서버 중복 차단용 event_id (서버가 무시해도 문제 없음)
  var SESSION_RAND = (function(){
    var k='houfit:rand';
    var v = sessionStorage.getItem(k);
    if (v) return v;
    v = Math.random().toString(36).slice(2,10);
    try { sessionStorage.setItem(k, v); } catch(e){}
    return v;
  })();
  function makeEventId() {
    var url = new URL(location.href);
    var utm = url.searchParams.get('utm') || '';
    return [ getOrMakeUserId(), url.origin+url.pathname, utm, SESSION_RAND ].join('|');
  }

  // --- 6) 실제 전송 (img GET → fetch(keepalive) GET) ---
  function sendVisit(utmData) {
    var ip = (typeof window.ip !== 'undefined' && window.ip) ? window.ip : 'unknown';

    var payload = JSON.stringify({
      id: getOrMakeUserId(),
      landingUrl: window.location.href,
      ip: ip,
      referer: document.referrer || '',
      time_stamp: nowString(),
      utm: utmData.utm,
      device: device,
      event_id: makeEventId() // 서버에서 중복 방지에 활용 가능
    });

    var url = ADDR + '?action=insert&table=visitors&data=' + encodeURIComponent(payload)
                + '&_t=' + Date.now(); // 캐시방지

    // 1) 전송 직전 즉시 락(레이스 방지)
    markSent();

    // A) 1x1 픽셀 GET (인앱에서도 거의 항상 전송됨)
    try {
      var img = new Image(1,1);
      img.referrerPolicy = 'no-referrer-when-downgrade';
      img.src = url;
    } catch(e) {}

    // B) fetch keepalive GET (추가 안전망)
    try {
      fetch(url, { method: 'GET', cache: 'no-store', keepalive: true, mode: 'no-cors' });
    } catch(e) {}

    return true;
  }

  var utmAll = parseUtm();

  function fireOnce() {
    // 다른 스크립트와의 레이스 방지: 호출 직후 락 확인
    if (window.__houfit_visitLogged || sessionStorage.getItem(LOCK_KEY) === '1') return;
    sendVisit(utmAll);
  }

  // DOM이 준비되면 1회
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fireOnce, { once: true });
  } else {
    fireOnce();
  }

  // 페이지가 숨겨질 때(닫기/전환) 한 번 더 안전망 (이미 보냈으면 스킵)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (window.__houfit_visitLogged || sessionStorage.getItem(LOCK_KEY) === '1') return;
      sendVisit(utmAll);
    }
  });

  // --- 7) 폼에도 UTM 숨김 필드로 주입 (방문 로그 실패 대비) ---
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.querySelector('.apply__form');
    if (!form) return;
    ['utm','utm_source','utm_medium','utm_campaign'].forEach(function (k) {
      var input = form.querySelector('input[name="' + k + '"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        form.appendChild(input);
      }
      input.value = utmAll[k] || '';
    });
  });
})();
