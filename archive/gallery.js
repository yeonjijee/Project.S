/* Project.S — 기록의 벽: 3D 갤러리 (나선형 Helix)
   motion.dev의 3D Gallery(Helix/Barrel/Ring/Sphere) 레이아웃에서 따온 연출:
     - 기록 한 건 = 색 픽셀(정사각 1:1) 한 칸. 카드들이 나선(Helix)을 그리며 쌓이고, 천천히 계속 돈다.
     - 등장할 때 카드가 하나씩 차례로(stagger) 스프링으로 튀어나온다.
     - 화면 정면에 온 카드는 스프링으로 커지고 앞으로 나오며, 뒤로 간 카드는 어두워진다.
   손동작(마우스 테스트 동일):
     - 주먹 + 좌우 이동 = 회전 (손을 떼도 관성으로 이어짐)
     - 주먹 + 위아래 이동 = 나선을 위아래로 스크롤
     - 손을 편 채 위아래 = 확대/축소
   (Motion+ Gallery 컴포넌트는 유료라 소스를 쓰지 않고, 이미 쓰던 three.js로 같은 레이아웃을 직접 구현했다.) */

const GLOBE_COLOR_MAP = {   // 순서 중요: "스카이블루"가 "블루"보다 먼저 검사돼야 한다
  "스카이블루":"#0acfff","네이비":"#0f2147","레드":"#ff0000","오렌지":"#ff8000","옐로":"#fbf000","그린":"#22d400",
  "블루":"#0070ff","블랙":"#000000","실버":"#9a9a9d","골드":"#c9a24b","화이트":"#ffffff","브라운":"#6b4528"
};
function globeColorFor(name){
  for(const k in GLOBE_COLOR_MAP){ if(name && name.includes(k)) return GLOBE_COLOR_MAP[k]; }
  return "#ff0000";
}
function globeEscapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function getArchiveForGlobe(){
  try{ return JSON.parse(localStorage.getItem('projectR_archive') || '[]'); }catch(e){ return []; }
}

(function initGallery(){
  const container = document.getElementById('globeStage');
  if(!container || typeof THREE === 'undefined') return;

  /* ---- 디자인 값 (여기 숫자만 바꾸면 모양이 바뀐다) ---- */
  const HELIX_RADIUS = 300;   // 나선 반지름
  const ANGLE_STEP   = 0.5;  // 카드 사이 각도(라디안) — 작을수록 촘촘
  const ROW_GAP      = 34;    // 카드 한 장마다 올라가는/내려가는 높이
  const TILE = 86;           // 한 칸 = 1:1 정사각 색 픽셀 (기록 1건)
  const MIN_Z = 420, MAX_Z = 1500;
  const FOCUS_SCALE = 1.5, FOCUS_PUSH = 60; // 정면 카드가 커지는 정도 / 앞으로 튀어나오는 거리
  const STAGGER_MS = 70;      // 등장 순서 간격
  const BASELINE_SPIN = 0.0016, FRICTION = 0.945;
  const ROTATE_SENSITIVITY = 0.0055, SCROLL_SENSITIVITY = 1.1, ZOOM_SENSITIVITY = 0.8;

  let width = container.clientWidth, height = container.clientHeight;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width/height, 1, 4000);
  camera.position.set(0, 0, 900);
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const helix = new THREE.Group();
  scene.add(helix);

  // ---- 카드 만들기 ----
  let cards = [];
  let rowCenter = 0, scrollTarget = 0, scrollY = 0, scrollLimit = 0;
  function buildCards(){
    while(helix.children.length) helix.remove(helix.children[0]);
    cards = [];
    const records = getArchiveForGlobe().slice().sort((a,b)=> (b.ts||0)-(a.ts||0)); // 최신이 위
    const N = records.length;
    rowCenter = (N-1)/2;
    scrollLimit = Math.max(0, rowCenter * ROW_GAP);
    scrollTarget = scrollLimit;   // 처음엔 가장 최신 카드가 가운데 오도록
    scrollY = scrollTarget;
    const geo = new THREE.PlaneGeometry(TILE, TILE);
    const edgeGeo = new THREE.PlaneGeometry(TILE*1.14, TILE*1.14);
    records.forEach((rec, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(globeColorFor(rec.heroColor)), side: THREE.DoubleSide, transparent:true });
      const mesh = new THREE.Mesh(geo, mat);
      // 얇은 빨간 테두리(= 흰색 칸도 배경 위에서 보이게)
      const edge = new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color:0xbc0000, side: THREE.DoubleSide, transparent:true }));
      edge.position.z = -0.5; mesh.add(edge); mesh.userData.edge = edge;
      const angle = i * ANGLE_STEP;
      Object.assign(mesh.userData, { rec, angle, baseY:(rowCenter - i) * ROW_GAP, scale:0, push:0, born: performance.now() + i*STAGGER_MS });
      mesh.scale.setScalar(0.001);
      helix.add(mesh);
      cards.push(mesh);
    });
    const countEl = document.getElementById('globeCount');
    if(countEl) countEl.textContent = N;
  }
  window.refreshGlobePoints = buildCards; // script.js가 기록이 바뀔 때 부른다
  // 첫 그리기
  buildCards();

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  // ---- 손동작 ----
  let rotVelocity = 0, scrollVelocity = 0;
  let lastGX = null, lastGY = null;
  function resetGesturePointer(){ lastGX = null; lastGY = null; }

  let backBtnPrevFisted = false;
  function updateBackButtonHover(x, y, fisted){
    const btn = document.getElementById('backToTestBtn');
    if(!btn) return;
    const rect = btn.getBoundingClientRect();
    const hovering = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    btn.classList.toggle('dwell-hover', hovering);
    if(hovering && fisted && !backBtnPrevFisted) btn.click();
    backBtnPrevFisted = hovering && fisted;
  }

  function handleGesture(x, y, fisted){
    if(lastGX !== null){
      const dx = x - lastGX, dy = y - lastGY;
      if(fisted){
        rotVelocity = dx * ROTATE_SENSITIVITY;
        scrollVelocity = -dy * SCROLL_SENSITIVITY;   // 주먹을 아래로 끌면 내용이 아래로
      } else {
        camera.position.z = clamp(camera.position.z + dy * ZOOM_SENSITIVITY, MIN_Z, MAX_Z);
      }
    }
    lastGX = x; lastGY = y;
  }

  let mouseHeld = false;
  container.addEventListener('mousedown', () => { mouseHeld = true; });
  window.addEventListener('mouseup', () => { mouseHeld = false; });
  container.addEventListener('mouseleave', resetGesturePointer);
  container.addEventListener('mousemove', (e) => handleGesture(e.clientX, e.clientY, mouseHeld));
  window.addEventListener('mousemove', (e) => updateBackButtonHover(e.clientX, e.clientY, mouseHeld));

  // ---- 매 프레임: 회전/스크롤 + 정면 카드 강조(스프링) + 등장 연출 ----
  const focusInfo = document.getElementById('focusInfo');
  let focusKey = '';
  function springTo(cur, target, k){ return cur + (target - cur) * k; }
  function animate(){
    requestAnimationFrame(animate);
    const now = performance.now();
    helix.rotation.y += rotVelocity + BASELINE_SPIN;
    rotVelocity *= FRICTION;
    scrollTarget = clamp(scrollTarget + scrollVelocity, -scrollLimit, scrollLimit);
    scrollVelocity *= FRICTION;
    scrollY = springTo(scrollY, scrollTarget, 0.18);
    helix.position.y = -scrollY;   // scrollY가 클수록 위쪽(최신) 카드가 가운데 온다

    // 정면(카메라 쪽)에 가장 가까운 카드를 찾는다
    let best = -1, bestScore = -9;
    cards.forEach((m, i) => {
      const u = m.userData;
      const a = u.angle - helix.rotation.y;   // 그룹이 +y로 돌면 카드의 실제 각도는 그만큼 줄어든다
      const facing = Math.cos(a);
      const yWorld = u.baseY + helix.position.y;
      const score = facing - Math.abs(yWorld) / (ROW_GAP * 4);
      u.facing = facing; u.yWorld = yWorld;
      if(score > bestScore){ bestScore = score; best = i; }
    });

    cards.forEach((m, i) => {
      const u = m.userData;
      const focused = (i === best && u.facing > 0.55);
      // 등장: 순서대로 0 → 1 (오버슈트가 있는 스프링처럼)
      const age = Math.max(0, now - u.born) / 600;
      const intro = age >= 1 ? 1 : 1 - Math.pow(1 - age, 3) * Math.cos(age * 9);
      u.scale = springTo(u.scale, focused ? FOCUS_SCALE : 1, 0.14);
      u.push  = springTo(u.push,  focused ? FOCUS_PUSH  : 0, 0.14);
      const r = HELIX_RADIUS + u.push;
      m.position.set(r * Math.sin(u.angle), u.baseY, r * Math.cos(u.angle));
      m.rotation.y = u.angle;
      m.scale.setScalar(Math.max(0.001, u.scale * intro));
      // 뒤로 간 칸/화면 위아래 끝의 칸은 옅게 (색은 그대로 — 1:1 색상 픽셀)
      const front = clamp((u.facing + 0.25) / 1.25, 0.12, 1);
      const vert = clamp(1 - (Math.abs(u.yWorld) / (ROW_GAP * 9)), 0.2, 1);
      const op = focused ? 1 : 0.18 + 0.82 * front * vert;
      m.material.opacity = op; u.edge.material.opacity = op;
    });

    // 정면 칸의 정보를 아래에 표시
    if(focusInfo){
      const rec = (best >= 0 && cards[best].userData.facing > 0.55) ? cards[best].userData.rec : null;
      const key = rec ? (rec.ts + '|' + rec.heroName) : '';
      if(key !== focusKey){
        focusKey = key;
        focusInfo.innerHTML = rec ? `<span class="fi-name">${globeEscapeHtml(rec.heroName||'')}</span>${rec.nickname ? `<span class="fi-nick">${globeEscapeHtml(rec.nickname)}</span>` : ''}<span class="fi-series">${globeEscapeHtml(rec.heroSeries||'')}</span>` : '';
      }
    }
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    width = container.clientWidth; height = container.clientHeight;
    if(!width || !height) return;
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });

  // ---- 카메라(손동작) ----
  const camStatus = document.getElementById('camStatus');
  const cursor = document.getElementById('handCursor');
  // 실측값으로 조정: 편 손 0.9 / 쥔 주먹 0.3 → 중간값인 0.6으로 설정 (양쪽으로 0.3씩 여유)
  let FIST_CLOSE = 0.6;
  let camOn = false, video = null, landmarker = null;
  let handFisted = false;

  document.addEventListener('keydown', (e) => {
    if(e.key === '[') FIST_CLOSE = Math.max(0.1, +(FIST_CLOSE - 0.05).toFixed(2));
    if(e.key === ']') FIST_CLOSE = Math.min(1.5, +(FIST_CLOSE + 0.05).toFixed(2));
  });

  async function startCam(){
    const { HandLandmarker, FilesetResolver } = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
    );
    const filesetResolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    landmarker = await HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
      runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5
    });

    video = document.createElement('video');
    video.style.display = 'none';
    document.body.appendChild(video);
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width:640, height:480 } });
    video.srcObject = stream;
    await video.play();

    camOn = true;
    if(camStatus) camStatus.textContent = '카메라: 켜짐 (화면엔 영상이 나오지 않음)';
    if(cursor) cursor.style.display = 'block';
    requestAnimationFrame(trackHand);
  }

  function trackHand(){
    if(!camOn) return;
    if(video && video.readyState >= 2 && landmarker){
      const result = landmarker.detectForVideo(video, performance.now());
      if(result.landmarks && result.landmarks.length){
        const lm = result.landmarks[0];
        const cursorPoint = lm[9];
        const wrist = lm[0];
        const fingertips = [lm[8], lm[12], lm[16], lm[20]];
        const palm = {
          x: (lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 4,
          y: (lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 4
        };
        const x = (1 - cursorPoint.x) * window.innerWidth; // 좌우 반전(거울 모드)
        const y = cursorPoint.y * window.innerHeight;
        if(cursor){ cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; }

        const handScale = Math.hypot(wrist.x-cursorPoint.x, wrist.y-cursorPoint.y) || 0.1;
        const avgTipDist = fingertips.reduce((s,t)=>s+Math.hypot(t.x-palm.x, t.y-palm.y), 0) / 4;
        const openness = avgTipDist / handScale;
        // redesign/test와 동일하게, 매 프레임 그대로 판정한다 (히스테리시스를 걸면 실제 주먹이 FIST_CLOSE까지
        // 안 내려가는 손/카메라 조합에서 아예 fisted 상태로 못 넘어가는 채로 "먹통"처럼 보일 수 있어서 뺐다)
        handFisted = openness <= FIST_CLOSE;
        if(cursor) cursor.classList.toggle('ready', handFisted);

        handleGesture(x, y, handFisted);
        updateBackButtonHover(x, y, handFisted);
        if(camStatus) camStatus.textContent = `카메라: 켜짐 · 손 인식됨 · 벌림정도 ${openness.toFixed(2)} (기준 ${FIST_CLOSE} 이하=주먹, [ ] 키로 기준 조정)`;
      } else {
        handFisted = false;
        if(cursor) cursor.classList.remove('ready');
        updateBackButtonHover(-9999, -9999, false); // 손을 놓치면 버튼 hover도 해제
        resetGesturePointer(); // 손을 놓쳤다가 다시 찾으면 그 사이 이동은 회전에 반영 안 되게
        if(camStatus) camStatus.textContent = '카메라: 켜짐 · 손 찾는 중 (카메라 앞에 손을 크게 펴서 비춰줘)';
      }
    }
    requestAnimationFrame(trackHand);
  }

  // 페이지가 열리자마자(버튼 없이) 바로 카메라를 요청한다. 브라우저가 한 번이라도 "허용"을 저장해둔
  // 사이트(같은 origin)라면 팝업 없이 곧바로 켜진다 — 이건 크롬 설정(사이트별 카메라 권한을 항상 허용으로
  // 고정)에서 하는 거라 코드로는 대신할 수 없다. 대신, 혹시 브라우저가 "사용자 동작이 있어야 카메라를
  // 켤 수 있다"고 막는 경우를 대비해서, 첫 클릭/키 입력이 들어오면 한 번 더 자동으로 재시도한다.
  let camStarted = false;
  function tryStartCam(){
    if(camStarted) return;
    camStarted = true;
    startCam().catch(err => {
      console.warn('camera interaction unavailable:', err);
      camStarted = false; // 실패하면 다음 사용자 동작에서 다시 시도할 수 있게 풀어둔다
      if(camStatus) camStatus.textContent = '카메라: 사용 불가 (권한을 확인해줘)';
    });
  }
  tryStartCam();
  ['click','keydown','touchstart'].forEach(ev => document.addEventListener(ev, tryStartCam, { once:false }));
})();
