/* ==========================================================
   GLOBALS
========================================================== */
let ip = "null";     // JSONP가 채워줄 예정
let addrScript = "https://script.google.com/macros/s/AKfycbzEAcd1aoa333KQSB2orgxTy_bJvAOMPprh3CHBa_YbdUpZls5puia5a1sGiZ4XNpIp/exec";


/* ==========================================================
   1) IP JSONP - MUST BE GLOBAL
========================================================== */

// jsonip.com → 자동으로 이 함수 호출함: getIP({ip: "..."}))
function getIP(json) {
    console.log("IP RESPONSE :", json);
    try {
        ip = json.ip;
    } catch (e) {
        ip = "unknown";
    }

    // IP가 준비되었으므로 방문 로그를 기록한다
    sendVisitorLog();
}

// JSONP script loader
function loadIPScript() {
    const script = document.createElement("script");
    script.src = "https://jsonip.com?format=jsonp&callback=getIP";
    document.body.appendChild(script);
}


/* ==========================================================
   2) DEVICE DETECTION
========================================================== */
let mobile = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    ? "mobile"
    : "desktop";


/* ==========================================================
   3) UTM PARAMS
========================================================== */
const urlParams = new URLSearchParams(location.search);
const utm = urlParams.get("utm") || "";


/* ==========================================================
   4) TIMESTAMP
========================================================== */
function padValue(v) {
    return (v < 10 ? "0" : "") + v;
}

function getTimeStamp() {
    const date = new Date();
    return `${padValue(date.getFullYear())}-${padValue(date.getMonth() + 1)}-${padValue(date.getDate())} `
         + `${padValue(date.getHours())}:${padValue(date.getMinutes())}:${padValue(date.getSeconds())}`;
}


/* ==========================================================
   5) COOKIE (Unique User ID)
========================================================== */
function getCookieValue(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
}

function setCookieValue(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + days * 86400000);
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = `${name}=${value}${expires}; path=/`;
}

function getUVfromCookie() {
    const existing = getCookieValue("user");
    if (existing) return existing;

    const hash = Math.random().toString(36).substring(2, 8).toUpperCase();
    setCookieValue("user", hash, 180);
    return hash;
}


/* ==========================================================
   6) VISITOR LOG SENDER — Called *after* IP loads
========================================================== */
function sendVisitorLog() {

    const payload = {
        id: getUVfromCookie(),
        landingUrl: window.location.href,
        ip: ip,
        referer: document.referrer || "",
        time_stamp: getTimeStamp(),
        utm: utm,
        device: mobile,
    };

    const data = encodeURIComponent(JSON.stringify(payload));

    console.log("Sending VISITOR LOG:", payload);

    axios.get(`${addrScript}?action=insert&table=visitors&data=${data}`)
        .then(res => console.log("VISITOR LOG SUCCESS:", res.data))
        .catch(err => console.log("VISITOR LOG FAILED:", err));
}


/* ==========================================================
   7) EMAIL + ADVICE SUBMISSION
========================================================== */
function validateEmail(email) {
    const regex = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
    return regex.test(email);
}

$(document).on("click", "#submit", function () {

    const email = $("#submit-email").val();
    const advice = $("#submit-advice").val();

    if (!email || !validateEmail(email)) {
        alert("이메일이 유효하지 않습니다.");
        return;
    }

    const payload = {
        id: getUVfromCookie(),
        email: email,
        advice: advice
    };

    $.busyLoadFull("show");

    axios.get(`${addrScript}?action=insert&table=tab_final&data=${encodeURIComponent(JSON.stringify(payload))}`)
        .then(response => {
            console.log("EMAIL SUBMIT SUCCESS:", response.data);
            $("#submit-email").val("");
            $("#submit-advice").val("");
            $.busyLoadFull("hide");
            openPopup();
        })
        .catch(err => {
            console.log("EMAIL SUBMIT FAILED:", err);
            $.busyLoadFull("hide");
        });

});


/* ==========================================================
   8) INITIALIZE
========================================================== */
document.addEventListener("DOMContentLoaded", () => {
    loadIPScript();   // JSONP → getIP → sendVisitorLog()
});
