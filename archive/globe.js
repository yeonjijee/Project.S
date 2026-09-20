/* Project.S — 기록의 벽: 3D 와이어프레임 지구본 (카메라 손동작 전시 화면)
   위경도선으로 이루어진 라인아트 지구본. 각 점은 보관된 기록(방문자 매칭 결과) 하나를 뜻한다.
   실제 지리 좌표가 아니라, 기록마다 고유한 값(닉네임+시간+영웅명)을 해시해서 위경도처럼 흩뿌린 것.

   손동작:
     - 주먹을 쥐고 드래그하면 자유 회전 (좌우로 옆으로, 위아래로 위아래 — 손을 떼도 관성으로 계속 돈다)
     - 손을 편 채로 위/아래로 움직이면 확대/축소
   각 점 위에는 그 기록의 정보(닉네임·매칭된 영웅)가 반투명 말풍선으로 항상 떠 있다 — 클릭/주먹 판정 없이
   지구본을 돌리다 보면 화면 앞쪽으로 오는 점들의 말풍선이 자연스럽게 보인다.
   마우스로도 같은 로직을 공유해서 테스트할 수 있다: 버튼을 누른 채 움직이면 회전, 버튼을 안 누르고
   위아래로 움직이면 확대/축소. */

const GLOBE_COLOR_MAP = {
  "레드":"#c94b32","블루":"#3a6fb0","옐로":"#d9a72c","그린":"#4a8f5c","핑크":"#c9698f",
  "블랙":"#8a8a8f","화이트":"#d8d5cb","골드":"#c9a24b","실버":"#9a9a9d","오렌지":"#d9722c",
  "바이올렛":"#7a5aa8","시안":"#4ab0c9","그레이":"#7d7d7f","브라운":"#8a6a4a"
};
function globeColorFor(name){
  for(const k in GLOBE_COLOR_MAP){ if(name && name.includes(k)) return GLOBE_COLOR_MAP[k]; }
  return "#c94b32";
}
function globeEscapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function getArchiveForGlobe(){
  try{ return JSON.parse(localStorage.getItem('projectR_archive') || '[]'); }catch(e){ return []; }
}

(function initGlobe(){
  const container = document.getElementById('globeStage');
  if(!container || typeof THREE === 'undefined') return;

  const R = 150;
  const MIN_Z = 190, MAX_Z = 900;
  let width = container.clientWidth, height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width/height, 1, 2000);
  camera.position.set(0, 0, 430);

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // ---- 위경도선 와이어프레임 ----
  function circleLine(radius, segments, fn, color, opacity){
    const pts = [];
    for(let i=0;i<=segments;i++){
      const t = (i/segments) * Math.PI * 2;
      pts.push(fn(t, radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color, transparent:true, opacity });
    return new THREE.Line(geo, mat);
  }
  function latitudeLine(latDeg){
    const phi = latDeg * Math.PI/180;
    const r = R * Math.cos(phi);
    const y = R * Math.sin(phi);
    return circleLine(r, 72, (t, radius) => new THREE.Vector3(radius*Math.cos(t), y, radius*Math.sin(t)), 0xf2f0ea, latDeg===0 ? 0.5 : 0.22);
  }
  function longitudeLine(longDeg){
    const theta = longDeg * Math.PI/180;
    return circleLine(R, 72, (t, radius) => new THREE.Vector3(
      radius*Math.sin(t)*Math.cos(theta), radius*Math.cos(t), radius*Math.sin(t)*Math.sin(theta)
    ), 0xf2f0ea, 0.22);
  }
  const wireGroup = new THREE.Group();
  [-60,-30,0,30,60].forEach(lat => wireGroup.add(latitudeLine(lat)));
  [0,30,60,90,120,150].forEach(lng => wireGroup.add(longitudeLine(lng)));
  globeGroup.add(wireGroup);

  const coreGeo = new THREE.SphereGeometry(R*0.985, 32, 24);
  const coreMat = new THREE.MeshBasicMaterial({ color:0x0b0b0d, transparent:true, opacity:0.55 });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.raycast = () => {}; // 클릭 판정에서 제외
  globeGroup.add(coreMesh);

  // ---- 기록 점 ----
  const pointsGroup = new THREE.Group();
  globeGroup.add(pointsGroup);

  function hashToUnit(str){
    let h = 0;
    for(let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h % 100000) / 100000;
  }
  function latLongToVec3(radius, latDeg, longDeg){
    const phi = latDeg*Math.PI/180, theta = longDeg*Math.PI/180;
    return new THREE.Vector3(
      radius*Math.cos(phi)*Math.cos(theta),
      radius*Math.sin(phi),
      radius*Math.cos(phi)*Math.sin(theta)
    );
  }
  // ---- 각 점 위에 떠 있는 반투명 말풍선 라벨 ----
  const labelsContainer = document.getElementById('globeLabels');
  function makeLabelEl(rec){
    const el = document.createElement('div');
    el.className = 'globe-label';
    el.style.setProperty('--bubble-color', globeColorFor(rec.heroColor));
    el.innerHTML = `<span class="dot2"></span><span class="name">${globeEscapeHtml(rec.heroName||'')}</span>${rec.nickname ? `<span class="nick">· ${globeEscapeHtml(rec.nickname)}</span>` : ''}`;
    return el;
  }

  function buildPoints(){
    pointsGroup.clear();
    if(labelsContainer) labelsContainer.innerHTML = '';
    const records = getArchiveForGlobe();
    records.forEach((rec, idx) => {
      const seed = (rec.nickname||'') + '_' + (rec.ts||idx) + '_' + (rec.heroName||idx);
      const lat = (hashToUnit(seed+'lat')*2-1) * 78;
      const lng = hashToUnit(seed+'lng')*360 - 180;
      const pos = latLongToVec3(R*1.02, lat, lng);
      const dotGeo = new THREE.SphereGeometry(3.6, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: globeColorFor(rec.heroColor) });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      dot.userData.record = rec;
      if(labelsContainer){
        const labelEl = makeLabelEl(rec);
        labelsContainer.appendChild(labelEl);
        dot.userData.labelEl = labelEl;
      }
      pointsGroup.add(dot);
    });
    const countEl = document.getElementById('globeCount');
    if(countEl) countEl.textContent = records.length;
  }
  buildPoints();
  window.refreshGlobePoints = buildPoints;

  // 매 프레임 각 점의 3D 위치를 화면 좌표로 투영해서 말풍선을 그 자리로 옮긴다.
  // 지구본 반대편(카메라를 등진 면)에 있는 점은 말풍선을 숨겨서 앞면만 보이게 한다.
  const projected = new THREE.Vector3();
  const worldPos = new THREE.Vector3();
  function updateLabels(){
    pointsGroup.children.forEach(dot => {
      const el = dot.userData.labelEl;
      if(!el) return;
      dot.getWorldPosition(worldPos);
      const facingCamera = worldPos.clone().normalize().dot(
        camera.position.clone().sub(worldPos).normalize()
      ) > 0.05;
      projected.copy(worldPos).project(camera);
      const behindCamera = projected.z > 1;
      if(!facingCamera || behindCamera){
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        return;
      }
      const sx = (projected.x * 0.5 + 0.5) * width;
      const sy = (-projected.y * 0.5 + 0.5) * height;
      el.style.transform = `translate(${sx}px, ${sy - 10}px) translate(-50%,-100%)`;
      el.style.opacity = '1';
    });
  }

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  // ---- 주먹 쥐고 드래그 = 자유 회전(좌우+위아래, 관성) · 손 펴고 위/아래 = 확대·축소 ----
  // 마우스에서는 버튼을 누른 상태를 "주먹"으로 취급해서 카메라와 완전히 같은 로직을 공유한다.
  const ROTATE_SENSITIVITY = 0.0055;
  const PITCH_SENSITIVITY = 0.0045;
  const PITCH_MIN = -1.1, PITCH_MAX = 1.1; // 지구본이 뒤집혀 보이지 않게 위아래 회전 각도를 제한
  const ZOOM_SENSITIVITY = 0.7;
  const BASELINE_SPIN = 0.0013; // 아무 조작 없어도 아주 천천히 계속 도는 기본 회전
  const FRICTION = 0.945;       // 손을 뗀 뒤 회전 속도가 줄어드는 비율(매 프레임)

  let rotVelocity = 0;
  let pitchVelocity = 0;
  let lastGX = null, lastGY = null;

  function resetGesturePointer(){ lastGX = null; lastGY = null; }

  // 지금 카메라 거리(zoom)에서 지구본이 화면에 실제로 얼마나 크게 보이는지를 구해서,
  // 손(커서)이 그 원 안에 있을 때만 회전/줌이 걸리게 한다 — 화면 중앙은 항상 지구본 중심과 일치한다
  // (카메라가 원점을 바라보고 x/y 이동 없이 z만 바꾸기 때문).
  function isInsideGlobe(x, y){
    const angularRadius = Math.asin(clamp(R / camera.position.z, -1, 1));
    const fovRad = camera.fov * Math.PI / 180;
    const pixelRadius = (angularRadius / (fovRad / 2)) * (height / 2) * 1.15; // 15% 여유
    const dist = Math.hypot(x - width / 2, y - height / 2);
    return dist <= pixelRadius;
  }

  function handleGesture(x, y, fisted){
    const inside = isInsideGlobe(x, y);
    if(lastGX !== null && inside){
      const dx = x - lastGX, dy = y - lastGY;
      if(fisted){
        // 주먹 쥔 채 드래그 = 자유 회전 (좌우로 움직이면 옆으로, 위아래로 움직이면 위아래로)
        rotVelocity = dx * ROTATE_SENSITIVITY;
        pitchVelocity = dy * PITCH_SENSITIVITY;
      } else {
        // 손을 편 채 위로 움직이면(dy 음수) 줌인, 아래로 움직이면(dy 양수) 줌아웃
        camera.position.z = clamp(camera.position.z + dy * ZOOM_SENSITIVITY, MIN_Z, MAX_Z);
      }
    }
    // 지구본 밖에 있을 땐 dx/dy 계산 자체를 건너뛰어서 새 회전/줌이 걸리지 않게 한다.
    // 이미 돌고 있던 관성(rotVelocity)은 animate()의 마찰 감쇠로 자연스럽게 계속 줄어든다.
    lastGX = x; lastGY = y;
  }

  // 마우스 (개발 테스트용) — 버튼을 안 누르면 손 편 상태, 누르면 주먹 상태와 동일하게 취급
  let mouseHeld = false;
  container.addEventListener('mousedown', () => { mouseHeld = true; });
  window.addEventListener('mouseup', () => { mouseHeld = false; });
  container.addEventListener('mouseleave', resetGesturePointer);
  container.addEventListener('mousemove', (e) => handleGesture(e.clientX, e.clientY, mouseHeld));

  function animate(){
    requestAnimationFrame(animate);
    globeGroup.rotation.y += rotVelocity + BASELINE_SPIN;
    globeGroup.rotation.x = clamp(globeGroup.rotation.x + pitchVelocity, PITCH_MIN, PITCH_MAX);
    rotVelocity *= FRICTION;
    pitchVelocity *= FRICTION;
    renderer.render(scene, camera);
    updateLabels();
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
        if(camStatus) camStatus.textContent = `카메라: 켜짐 · 손 인식됨 · 벌림정도 ${openness.toFixed(2)} (기준 ${FIST_CLOSE} 이하=주먹, [ ] 키로 기준 조정)`;
      } else {
        handFisted = false;
        if(cursor) cursor.classList.remove('ready');
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
