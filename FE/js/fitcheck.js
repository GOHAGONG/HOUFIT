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
    ambient: { color: 0xffc0cb, intensity: 1.0 },  // 조금 따뜻한 톤
    dir:     { color: 0xffffff, intensity: 1.7 }  // 하이라이트 강조
  }
};

// 1. 초기화
function init3D() {
  const viewer = document.getElementById("viewer");
  const width = viewer.clientWidth || 400;
  const height = viewer.clientHeight || 400;

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
  camera.position.set(0, 1.0, 4);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  viewer.appendChild(renderer.domElement);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  ambient = new THREE.AmbientLight(0xffffff, 0.5); 
  scene.add(ambient);
  dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(0, 5, 10);
  scene.add(dir);

  loader = new THREE.GLTFLoader();

  // 2. 모델 로드
  loadModel("female"); //default

  // OrbitControls 등록
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.enableZoom = false;
  controls.enablePan = false;
}

// 모델 로드
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

// 3. 애니메이션 루프
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// 4. UI 슬라이더 → Morph Target 반영
function setupUI() {
  // sliderId: glbMorphKey
  const sliderMap = {
    neck: "Neck",
    shoulder: "Shoulder",
    bust: "Bust",
    arm: "Arm",
    waist: "Waist",
    pelvis: "Pelvis",
    leg: "Leg"
  };

  Object.keys(sliderMap).forEach((sliderId) => {
    const slider = document.getElementById(sliderId);
    if (!slider) {
      console.warn(`⚠ 슬라이더 ${sliderId} 없음`);
      return;
    }

    const morphName = sliderMap[sliderId];

    slider.addEventListener("input", function (e) {
      const v = parseFloat(e.target.value);

      morphMeshes.forEach((mesh) => {
        const dict = mesh.morphTargetDictionary;
        const index = dict[morphName];

        if (index !== undefined) {
          mesh.morphTargetInfluences[index] = v;
        }
      });
    });
  });
}

// === 성별 변경 버튼 이벤트 ===
function setupGenderButtons() {
    const buttons = document.querySelectorAll("#gender-select button");

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            // active 버튼 변경
            buttons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");

            const gender = btn.dataset.gender;
            loadModel(gender);
        });
    });
}

// 5. 시작
window.addEventListener("load", function () {
  init3D();
  setupUI();
  setupGenderButtons();
  animate();
});

document.querySelectorAll("input[type=range]").forEach(slider => {
    slider.addEventListener("input", (e) => {
        const max = e.target.max;
        const min = e.target.min;
        const val = ((e.target.value - min) / (max - min)) * 100;
        e.target.style.setProperty("--val", `${val}%`);
    });
});

window.addEventListener("load", () => {
    document.querySelectorAll('.sliders input[type="range"]').forEach(slider => {
        slider.value = 0;   
        slider.dispatchEvent(new Event("input"));
    });
});