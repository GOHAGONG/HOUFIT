// 전역 변수
let scene, camera, renderer, controls;
let model = null;
let morphMeshes = [];
let loader;
let ambient, dir;

// 성별 별 세팅
const MODEL_PATH = {
    female: "assets/glb/Girl.glb",
    male: "assets/glb/Boy.glb"
};

const LIGHT_PRESET = {
  female: {
    ambient: { color: 0xffffff, intensity: 0.5 },
    dir:     { color: 0xffffff, intensity: 1.5 }
  },
  male: {
    ambient: { color: 0xffc0cb, intensity: 1.0 },
    dir:     { color: 0xffffff, intensity: 1.7 }
  }
};

//backend url node.js 서버 주소
const BACKEND_URL = 'http://localhost:5500/vto';

// 1. Three.js 초기화
function init3D() {
  const viewer = document.getElementById("viewer");
  const width = viewer.clientWidth || 400;
  const height = viewer.clientHeight || 400;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
  camera.position.set(0, 1.0, 4);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  viewer.appendChild(renderer.domElement);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  dir = new THREE.DirectionalLight(0xffffff, 1.5);
  dir.position.set(0, 5, 10);
  scene.add(dir);

  loader = new THREE.GLTFLoader();

  loadModel("female");

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.enableZoom = false;
  controls.enablePan = false;
}

function loadModel(gender) {
    const path = MODEL_PATH[gender];

    if (model) {
        scene.remove(model);
        model = null;
        morphMeshes = [];
    }

    const preset = LIGHT_PRESET[gender];

    ambient.color.set(preset.ambient.color);
    ambient.intensity = preset.ambient.intensity;

    dir.color.set(preset.dir.color);
    dir.intensity = preset.dir.intensity;

    loader.load(path, (gltf) => {
        model = gltf.scene;

        model.position.set(0, -1.0, 0);
        model.scale.set(0.9, 0.9, 0.9);

        model.traverse((obj) => {
            if (obj.isMesh && obj.morphTargetInfluences) {
                morphMeshes.push(obj);
            }
        });

        scene.add(model);
    });
}

// 2. 애니메이션 루프
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// 3. morph slider 반영
function setupUI() {
  const sliderMap = {
    neck: "Neck",
    shoulder: "Shoulder",
    bust: "Bust",
    arm: "Arm",
    waist: "Waist",
    pelvis: "Pelvis",
    leg: "Leg"
  };

  Object.keys(sliderMap).forEach(sliderId => {
    const slider = document.getElementById(sliderId);
    if (!slider) return;

    const morphName = sliderMap[sliderId];

    slider.addEventListener("input", e => {
      const v = parseFloat(e.target.value);

      morphMeshes.forEach(mesh => {
        const index = mesh.morphTargetDictionary[morphName];
        if (index !== undefined) {
          mesh.morphTargetInfluences[index] = v;
        }
      });
    });
  });
}

// 성별 버튼
function setupGenderButtons() {
    const buttons = document.querySelectorAll("#gender-select button");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            loadModel(btn.dataset.gender);
        });
    });
}

// 3D 캔버스 캡처 (모델 사진 역할)
function captureModelCanvas() {
    renderer.render(scene, camera); // 캡처 전 마지막 렌더링
    const canvas = renderer.domElement;
    // Base64 형식의 JPEG 이미지 데이터를 반환
    const dataURL = canvas.toDataURL("image/jpeg", 0.9);
    
    // Data URL을 Blob 객체로 변환하여 FormData에 추가할 수 있도록 준비
    const byteString = atob(dataURL.split(',')[1]);
    const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

// VTO 요청 처리 함수
async function handleTryOnRequest() {
    const clothingFile = document.getElementById('clothingFile').files[0];
    const promptInput = document.getElementById('promptInput').value.trim();
    const tryOnButton = document.getElementById('requestTryOnButton');
    const originalImg = document.getElementById('original-model-img');
    const resultImg = document.getElementById('tryon-result-img');
    const messageP = document.getElementById('tryon-message');
    
    if (!model) {
        // messageP.textContent = "오류: 3D 모델이 아직 로드되지 않았습니다.";
        return;
    }
    if (!clothingFile) {
        // messageP.textContent = "오류: 옷 이미지를 선택해 주세요.";
        return;
    }
    
    // 1. 모델 스크린샷 캡처 (파일로 변환)
    // messageP.textContent = "[1/2] 3D 모델 스크린샷을 캡처합니다...";
    const modelBlob = captureModelCanvas();
    const modelFile = new File([modelBlob], "model_capture.jpeg", { type: "image/jpeg" });

    // 2. FormData 생성 및 데이터 추가
    const formData = new FormData();
    // server.js에서 upload.array('images', 2)로 받기 때문에, 
    // 파일 2개를 'images' 필드에 순서대로 추가합니다.
    formData.append('images', modelFile, 'model.jpeg');   // 첫 번째 파일: 모델
    formData.append('images', clothingFile, 'garment.jpeg'); // 두 번째 파일: 옷
    formData.append('prompt', promptInput || "첫 번째 모델에게 두 번째 옷을 입혀줘. 가장 현실적이고 주름이 살아있는 착용샷을 생성해.");

    // 캡처된 모델 이미지를 원본 비교 이미지로 설정
    const modelDataUrl = URL.createObjectURL(modelFile);
    originalImg.src = modelDataUrl;
    originalImg.style.display = 'block';
    originalImg.style.opacity = 1;
    resultImg.style.opacity = 0;
    resultImg.style.display = 'none';
    $("#image-comparison-wrapper").css("opacity", 1);


    tryOnButton.disabled = true;
    $.busyLoadFull('show', { text: 'AI 합성 이미지 생성 중... (최대 1분 소요)' });
    // messageP.textContent = "[2/2] AI 모델(Gemini/Imagen)이 이미지를 합성 중입니다...";

    // 3. 백엔드 API 호출
    try { 
        const response = await axios.post(BACKEND_URL, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        // 4. 결과 처리
        const data = response.data;
        if (data.finalImage) {
            // Base64 데이터를 이미지 소스로 설정
            resultImg.src = `data:image/jpeg;base64,${data.finalImage}`;
            resultImg.style.display = 'block';
            resultImg.style.opacity = 1; // AI 결과 표시
            // messageP.textContent = "✅ 가상 착용 이미지가 성공적으로 생성되었습니다.";
        } else {
            throw new Error("API 응답에 이미지 데이터가 포함되어 있지 않습니다.");
        }

    } catch (error) { // <--- 누락된 catch 블록 시작
        const errorMessage = error.response ? error.response.data.error : error.message;
        console.error('가상 착용 요청 실패:', error);
        // messageP.textContent = `❌ 요청 실패: ${errorMessage}. 콘솔을 확인하거나 GCP 설정을 점검해 주세요.`;
        // 원본 이미지는 유지하고 결과 이미지는 숨김
        resultImg.style.opacity = 0;
        resultImg.style.display = 'none';
    } finally { // <--- finally 블록
        $.busyLoadFull('hide');
        tryOnButton.disabled = false;
    }
}

// Render Loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// handle 초기값으로 지정 
window.addEventListener("load", () => {
    document.querySelectorAll('.sliders input[type="range"]').forEach(slider => {
        slider.value = 0;   // 슬라이더 초기값 설정
        slider.dispatchEvent(new Event("input")); // 모델에도 즉시 반영됨
    });
});

document.querySelectorAll("input[type=range]").forEach(slider => {
    slider.addEventListener("input", (e) => {
        const max = e.target.max;
        const min = e.target.min;
        const val = ((e.target.value - min) / (max - min)) * 100;
        e.target.style.setProperty("--val", `${val}%`);
    });
});

// 가상 착용 버튼
$("#requestTryOnButton").on("click", handleTryOnRequest);

// DOM Ready
$(document).ready(function () {
    init3D();
    setupUI();
    setupGenderButtons();
    animate();

    // 탭 전환 UI
    $(".side-tabs .tab").on("click", function () {
        $(".side-tabs .tab").removeClass("active");
        $(this).addClass("active");

        const isTryOn = $(this).text().includes("입어보기");

        if (isTryOn) {
            $(".sliders").hide();
            $("#gender-select").hide();
            $("#try-on-controls").show();
            $("#image-comparison-wrapper").css("opacity", 1);
        } else {
            $(".sliders").show();
            $("#gender-select").show();
            $("#try-on-controls").hide();
            $("#image-comparison-wrapper").css("opacity", 0);
        }
    });

    $("#try-on-controls").hide();

});