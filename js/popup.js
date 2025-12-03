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