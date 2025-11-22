// 스크롤로 보이면 .is-visible 추가
(function(){
  const targets = document.querySelectorAll('.reveal, .reveal-up');
  if (!('IntersectionObserver' in window) || targets.length === 0) {
    // 구형 브라우저/Fallback: 그냥 전부 보이기
    targets.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    threshold: 0,
    rootMargin: '-70% 0px -30% 0px'
  });

  targets.forEach(el => io.observe(el));
})();

// 플로팅 GNB 토글
(function(){
  const sentinel = document.querySelector('#nav-sentinel');       // 헤더 아래
  const floating = document.querySelector('.floating-nav');
  if (!sentinel || !floating) return;

  const navIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // sentinel이 보이면 헤더가 화면에 있음 → 플로팅바 끄기
      if (entry.isIntersecting) {
        floating.classList.remove('is-on');
      } else {
        floating.classList.add('is-on');
      }
    });
  }, {
    root: null,
    threshold: 0,
    rootMargin: '0px 0px 0px 0px'
  });

  navIO.observe(sentinel);
})();

// popup DOM 캐싱
const popup = document.getElementById('popup');

/** 팝업 열기 */
function openPopup() {
  popup.removeAttribute('hidden');
}

/** 팝업 닫기 */
function closePopup() {
  popup.setAttribute('hidden', '');
}

/** 클릭으로 닫기 (바깥 영역 클릭 시) */
popup.addEventListener('click', (e) => {
  // 배경 클릭 시에만 닫기
  if (e.target === popup) {
    closePopup();
  }
});