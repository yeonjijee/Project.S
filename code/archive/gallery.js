/* Project.S — ARCHIVE: 와이어프레임 지구본
   · 지구본(위경도선) 위를 기록들이 천천히 돌아다닌다. 기록 하나 = 가장 강한 모자이크의 레인저 사진 + 위에 닉네임.
   · hover(손/마우스): 그 기록의 닉네임이 메인이 되고(크게, 빨강) 아래 정보칸에도 닉네임이 크게.
   · 클릭(마우스 클릭 / 주먹 쥐었다 제자리에서 펴기): 화면이 왼쪽으로 밀리고, 오른쪽에
     테스트한 날짜·시간 / page 6의 답 / 영웅과 몇 % 닮았는지가 나타난다.
   · 끌기(마우스 누른 채 / 주먹 쥔 채): 지구본 돌리기 (좌우 + 위아래, 놓으면 관성)
   · 닉네임 찾기: 맞는 기록을 정면으로 돌려 세운다 (엔터 = 다음 결과) */

const GLOBE_COLOR_MAP = {   // 순서 중요: "스카이블루"가 "블루"보다 먼저
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

(function initGlobe(){
  const container = document.getElementById('globeStage');
  if(!container || typeof THREE === 'undefined') return;

  /* ---- 디자인 값 ---- */
  const R = 140;                       // 지구본 반지름
  const CAM_Z = 470, MIN_Z = 300, MAX_Z = 1100;   // 지구본이 화면 높이를 거의 꽉 채우게
  const MOSAIC_RATE = 1;               // 1 = 가장 강한 모자이크
  const DRIFT = 0.05;                  // 기록이 지구본 위를 돌아다니는 속도(도/프레임)
  const BASELINE_SPIN = 0.0012, FRICTION = 0.94;
  const ROT_K = 0.005, PITCH_K = 0.004, PITCH_LIM = 1.1;
  const DRAG_START_PX = 14, HAND_DRAG_START = 0.07, HAND_SETTLE_MS = 180, HAND_GAIN = 1.4;
  const LINE_COLOR = 0xa70000;

  let width = container.clientWidth, height = container.clientHeight;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width/height, 1, 3000);
  camera.position.set(0, 0, CAM_Z);
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const globe = new THREE.Group();
  scene.add(globe);

  // ---- 위경도선 ----
  function ring(fn, opacity){
    const pts = [];
    for(let i = 0; i <= 96; i++) pts.push(fn(i / 96 * Math.PI * 2));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: LINE_COLOR, transparent:true, opacity }));
    line.renderOrder = 0;
    return line;
  }
  [-60,-30,0,30,60].forEach(lat => {
    const p = lat * Math.PI / 180, r = R * Math.cos(p), y = R * Math.sin(p);
    globe.add(ring(t => new THREE.Vector3(r * Math.cos(t), y, r * Math.sin(t)), lat === 0 ? 0.55 : 0.32));
  });
  [0,30,60,90,120,150].forEach(lng => {
    const th = lng * Math.PI / 180;
    globe.add(ring(t => new THREE.Vector3(R * Math.sin(t) * Math.cos(th), R * Math.cos(t), R * Math.sin(t) * Math.sin(th)), 0.32));
  });
  // 속(배경색) — 뒤쪽 선은 비쳐 보이고, 뒤쪽 기록은 가려진다
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.99, 48, 32),
    new THREE.MeshBasicMaterial({ color:0xe2e2dc, transparent:true, opacity:0.62 }));
  core.renderOrder = 1;
  globe.add(core);

  // ---- 사진 (가장 강한 모자이크) ----
  let heroImages = null, rangerData = null;
  const manifestReady = fetch('../../files/data/hero-images.json').then(r => r.json()).then(m => { heroImages = m; }).catch(() => { heroImages = {}; });
  const rangersReady = fetch('../../files/data/rangers.json').then(r => r.json()).then(d => { rangerData = d; }).catch(() => { rangerData = []; });
  const imgCache = {};
  function heroImg(name){
    if(imgCache[name]) return imgCache[name];
    return imgCache[name] = manifestReady.then(() => new Promise(res => {
      const src = heroImages[name]; const path = Array.isArray(src) ? src[0] : src;
      if(!path){ res(null); return; }
      const img = new Image();
      img.onload = () => res(img); img.onerror = () => res(null);
      img.src = '../../files/' + path;
    }));
  }
  const texCache = {};
  function heroTexture(name){
    if(texCache[name]) return texCache[name];
    return texCache[name] = heroImg(name).then(img => {
      if(!img || typeof MosaicRenderer === 'undefined') return null;
      const c = document.createElement('canvas');
      c.width = 120; c.height = Math.round(120 * img.height / img.width);
      new MosaicRenderer(c, img, { minCell: 2, maxCell: 16, bg: 'transparent' }).render(MOSAIC_RATE);
      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
      return { tex, aspect: c.width / c.height };
    });
  }

  // ---- 기록 ----
  const labels = document.getElementById('globeLabels');
  let items = [];
  function hashUnit(str){   // FNV-1a + 섞기 — 비슷한 기록끼리도 지구본 위에 고르게 흩어지게
    let h = 2166136261;
    for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function build(){
    items.forEach(it => globe.remove(it.sprite));
    items = [];
    if(labels) labels.innerHTML = '';
    const records = getArchiveForGlobe();
    const N = records.length;
    const H = Math.max(16, Math.min(34, 34 - N * 0.08));   // 기록이 많아지면 조금씩 작게
    records.forEach((rec, i) => {
      const seed = (rec.nickname || '') + '_' + (rec.ts || i) + '_' + (rec.heroName || i);
      const mat = new THREE.SpriteMaterial({ color: new THREE.Color(globeColorFor(rec.heroColor)), transparent:true, depthTest:true });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 2;
      sprite.scale.set(H * 0.45, H, 1);
      const it = {
        rec, sprite, H, aspect: 0.45, scale: 0, hover: 0,
        lat: Math.asin(hashUnit(seed + 'lat') * 1.8 - 0.9) * 180 / Math.PI,
        lng: hashUnit(seed + 'lng') * 360,
        dLat: (hashUnit(seed + 'dl') - 0.5) * DRIFT,
        dLng: (hashUnit(seed + 'dg') * 0.7 + 0.3) * DRIFT * (hashUnit(seed + 's') > 0.5 ? 1 : -1),
        born: performance.now() + i * 40
      };
      heroTexture(rec.heroName).then(t => { if(t){ mat.map = t.tex; mat.color.set(0xffffff); mat.needsUpdate = true; it.aspect = t.aspect; } });
      if(labels){
        const el = document.createElement('div');
        el.className = 'globe-nick';
        el.innerHTML = `${globeEscapeHtml(rec.nickname || '')}<small>${globeEscapeHtml(rec.heroName || '')}</small>`;   // hover하면 닉네임이 크게 + 아래 작게 영웅 이름
        if(!rec.nickname) el.style.display = 'none';
        labels.appendChild(el);
        it.label = el;
      }
      globe.add(sprite);
      items.push(it);
    });
    if(typeof runSearch === 'function') runSearch();
  }

  // ---- 상태 ----
  let yaw = 0, pitch = 0.25, yawVel = 0, pitchVel = 0;
  let hovered = null, searchLock = null, detailItem = null;
  const focusInfo = document.getElementById('focusInfo');
  let focusKey = null;

  function localPos(it, out){
    const p = it.lat * Math.PI / 180, t = it.lng * Math.PI / 180, r = R * 1.04 + it.H * 0.5 * 0.3;
    return out.set(r * Math.cos(p) * Math.cos(t), r * Math.sin(p), r * Math.cos(p) * Math.sin(t));
  }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  // 화면 좌표(페이지 기준)에서 가장 가까운 앞쪽 기록
  const v3 = new THREE.Vector3(), wp = new THREE.Vector3();
  function pickAt(px, py){
    const rect = container.getBoundingClientRect();
    let best = null, bestD = Infinity;
    items.forEach(it => {
      if(!it.front) return;
      const dx = px - (rect.left + it.sx), dy = py - (rect.top + it.sy);
      const rad = it.sh * 0.6 + 12;
      const d = Math.hypot(dx, dy);
      if(d < rad && d < bestD){ bestD = d; best = it; }
    });
    return best;
  }

  // ---- 매 프레임 ----
  function animate(){
    requestAnimationFrame(animate);
    const now = performance.now();
    if(searchLock){
      localPos(searchLock, v3);
      const ty = -Math.atan2(v3.x, v3.z);
      const zr = Math.hypot(v3.x, v3.z);
      const tp = clamp(Math.atan2(v3.y, zr), -PITCH_LIM, PITCH_LIM);
      yaw += Math.atan2(Math.sin(ty - yaw), Math.cos(ty - yaw)) * 0.1;
      pitch += (tp - pitch) * 0.1;
      yawVel = pitchVel = 0;
    } else if(!grab){
      yaw += yawVel + (detailItem ? 0 : BASELINE_SPIN);
      pitch = clamp(pitch + pitchVel, -PITCH_LIM, PITCH_LIM);
      yawVel *= FRICTION; pitchVel *= FRICTION;
    }
    globe.rotation.set(pitch, yaw, 0, 'XYZ');
    globe.updateMatrixWorld();

    items.forEach(it => {
      const frozen = it === searchLock || it === detailItem || it === hovered;
      if(!frozen){
        it.lat += it.dLat; it.lng += it.dLng;
        if(it.lat > 68 || it.lat < -68) it.dLat *= -1;
      }
      localPos(it, v3);
      it.sprite.position.copy(v3);
      const age = clamp((now - it.born) / 700, 0, 1);
      const intro = age >= 1 ? 1 : 1 - Math.pow(1 - age, 3) * Math.cos(age * 8);
      const target = (it === hovered || it === searchLock || it === detailItem) ? 1 : 0;
      it.hover += (target - it.hover) * 0.15;
      const s = it.H * (1 + it.hover * 0.6) * intro;
      it.sprite.scale.set(Math.max(0.01, s * it.aspect), Math.max(0.01, s), 1);
      const dim = searchHits.length && !searchHits.includes(it);
      it.sprite.material.opacity = dim ? 0.25 : 1;

      // 화면 위치 → 닉네임 라벨
      it.sprite.getWorldPosition(wp);
      it.front = wp.z > 0;   // 지구본 앞쪽 반구
      v3.copy(wp).project(camera);
      it.sx = (v3.x * 0.5 + 0.5) * width;
      it.sy = (-v3.y * 0.5 + 0.5) * height;
      const top = wp.clone(); top.y += s * 0.5;
      top.project(camera);
      const topY = (-top.y * 0.5 + 0.5) * height;
      it.sh = Math.max(8, (it.sy - topY) * 2);
      if(it.label){
        const show = it.front && !dim;
        it.label.style.opacity = show ? (0.35 + 0.65 * clamp(wp.z / R, 0, 1)).toFixed(2) : '0';
        it.label.style.transform = `translate(${it.sx}px, ${topY - 4}px) translate(-50%, -100%)`;
        it.label.classList.toggle('main', it.hover > 0.5);
      }
    });

    // 아래 정보칸 — hover한 기록: 닉네임이 메인
    const f = detailItem ? null : (hovered || searchLock);
    if(focusInfo && f !== focusKey){
      focusKey = f;
      focusInfo.innerHTML = f ? `<span class="fi-name">${globeEscapeHtml(f.rec.nickname || '이름 없는 영웅')}</span><span class="fi-nick">${globeEscapeHtml(f.rec.heroName || '')}</span><span class="fi-series">${globeEscapeHtml(f.rec.heroSeries || '')}</span>` : '';
    }
    renderer.render(scene, camera);
  }

  // ---- 상세 (오른쪽) ----
  const detail = document.getElementById('arDetail');
  const detailBody = document.getElementById('arDetailBody');
  function pad(n){ return String(n).padStart(2, '0'); }
  function similarity(rec){
    if(typeof rec.similarity === 'number') return rec.similarity;
    const r = (rangerData || []).find(x => x.name === rec.heroName);
    if(!r) return null;
    const picked = rec.userKeywords || [];
    const w = (r.weaknessCanon || []), p = (r.personalityCanon || []);
    const max = w.length * 2 + p.length;
    if(!max) return null;
    const got = w.filter(k => picked.includes(k)).length * 2 + p.filter(k => picked.includes(k)).length;
    return Math.round(got / max * 100);
  }
  async function openDetail(it){
    detailItem = it; searchLock = null; hovered = null;
    await rangersReady;
    const rec = it.rec, d = new Date(rec.ts || Date.now());
    const days = ['일','월','화','수','목','금','토'];
    const pct = similarity(rec);
    detailBody.innerHTML = `
      <p class="ad-date">${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${days[d.getDay()]}) <b>${pad(d.getHours())}:${pad(d.getMinutes())}</b></p>
      <p class="ad-nick">${globeEscapeHtml(rec.nickname || '이름 없는 영웅')}</p>
      <div class="ad-hero"><canvas id="adCanvas" width="240" height="320"></canvas>
        <div class="ad-hero-txt"><span class="ad-label">수호 영웅</span><span class="ad-hero-name">${globeEscapeHtml(rec.heroName || '')}</span><span class="ad-series">${globeEscapeHtml(rec.heroSeries || '')}</span>
          ${pct !== null ? `<span class="ad-label">닮은 정도</span><span class="ad-pct">${pct}<small>%</small></span>` : ''}</div></div>
      <div class="ad-talk">
        <p class="ad-label">${globeEscapeHtml(rec.nickname || '당신')}이(가) 남긴 말 <span>— 이루지 못한 꿈, 혹은 스스로 아는 약점</span></p>
        <p class="ad-answer">${rec.freeText ? '“' + globeEscapeHtml(rec.freeText) + '”' : '<span class="ad-empty">(남긴 말 없음)</span>'}</p>
        ${(rec.aiOneLiner || rec.aiExplanation) ? `
        <p class="ad-label ad-reply-label">${globeEscapeHtml(rec.heroName || '영웅')}의 답</p>
        ${rec.aiOneLiner ? `<p class="ad-oneliner">${globeEscapeHtml(rec.aiOneLiner)}</p>` : ''}
        ${rec.aiExplanation ? `<p class="ad-reply">${globeEscapeHtml(rec.aiExplanation)}</p>` : ''}
        ${rec.aiIdentity ? `<p class="ad-label">스스로 생각한 모습과 실제 내면</p><p class="ad-reply">${globeEscapeHtml(rec.aiIdentity)}</p>` : ''}` : ''}
      </div>
      ${(rec.matchedKeywords || []).length ? `<p class="ad-label">겹친 키워드</p><div class="ad-kw">${rec.matchedKeywords.map(k => `<span>${globeEscapeHtml(k)}</span>`).join('')}</div>` : ''}`;
    heroImg(rec.heroName).then(img => {
      const c = document.getElementById('adCanvas'); if(!img || !c) return;
      const k = Math.min(c.width / img.width, c.height / img.height), w = img.width * k, h = img.height * k;
      const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    });
    document.body.classList.add('detail-open');
    if(typeof typeSound !== 'undefined' && typeSound.whoosh) typeSound.whoosh();
  }
  function closeDetail(){
    detailItem = null;
    document.body.classList.remove('detail-open');
  }
  window.closeArchiveDetail = closeDetail;
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeDetail(); });

  // ---- 닉네임 찾기 ----
  const nickInput = document.getElementById('nickSearch');
  const nickCount = document.getElementById('nickCount');
  let searchHits = [], searchIdx = 0;
  function runSearch(){
    if(!nickInput) return;
    const q = (nickInput.value || '').trim().toLowerCase();
    searchHits = q ? items.filter(it => String(it.rec.nickname || '').toLowerCase().includes(q)) : [];
    searchIdx = 0;
    searchLock = searchHits[0] || null;
    nickCount.textContent = q ? (searchHits.length ? (searchHits.length > 1 ? `1/${searchHits.length}` : '') : '없음') : '';
  }
  if(nickInput){
    nickInput.addEventListener('input', runSearch);
    nickInput.addEventListener('keydown', e => {
      if(e.key === 'Enter' && searchHits.length){
        if(searchHits.length === 1){ openDetail(searchHits[0]); }
        else { searchIdx = (searchIdx + 1) % searchHits.length; searchLock = searchHits[searchIdx]; nickCount.textContent = `${searchIdx + 1}/${searchHits.length}`; }
      }
      e.stopPropagation();
    });
  }

  // ---- 손/마우스 공통: 누르기 → (끌기 = 돌리기 | 제자리 놓기 = 클릭) ----
  let grab = null, lastX = 0, lastY = 0, suppressClick = false;
  const cursor = document.getElementById('handCursor');
  function down(x, y, src, target){
    target = target || document.elementFromPoint(x, y);
    if(!target || target.closest('input, label.ar-search, .admin-only')) return;
    grab = { x, y, src, target, t0: performance.now(), dragging: false, onGlobe: !target.closest('#arDetail, a, button'), panel: target.closest('#arDetail') };
    lastX = x; lastY = y; yawVel = pitchVel = 0;
  }
  function move(x, y){
    if(!grab) return;
    if(grab.src === 'hand' && performance.now() - grab.t0 < HAND_SETTLE_MS){ grab.x = x; grab.y = y; lastX = x; lastY = y; return; }
    const lim = grab.src === 'hand' ? innerWidth * HAND_DRAG_START : DRAG_START_PX;
    if(!grab.dragging && (grab.onGlobe || grab.panel) && Math.hypot(x - grab.x, y - grab.y) > lim){ grab.dragging = true; if(grab.onGlobe) searchLock = null; document.body.classList.add('grabbing'); }
    if(grab.dragging && grab.panel){   // 오른쪽 글이 길면 잡고 끌어서 스크롤
      grab.panel.scrollTop -= (y - lastY) * (grab.src === 'hand' ? HAND_GAIN : 1);
      lastX = x; lastY = y; return;
    }
    if(grab.dragging){
      const k = grab.src === 'hand' ? HAND_GAIN : 1;
      const dx = (x - lastX) * k, dy = (y - lastY) * k;
      yaw += dx * ROT_K; pitch = clamp(pitch + dy * PITCH_K, -PITCH_LIM, PITCH_LIM);
      yawVel = clamp(yawVel * 0.5 + dx * ROT_K * 0.5, -0.035, 0.035); pitchVel = clamp(pitchVel * 0.5 + dy * PITCH_K * 0.5, -0.025, 0.025);   // 놓은 뒤 관성 — 너무 멀리 안 돌게
    }
    lastX = x; lastY = y;
  }
  function up(x, y){
    if(!grab) return;
    const g = grab; grab = null;
    document.body.classList.remove('grabbing');
    if(g.dragging){
      if(g.src === 'mouse'){ suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
      return;
    }
    if(g.src === 'hand'){
      const el = g.target.closest('a, button');
      if(el){ el.click(); return; }
    }
    if(g.onGlobe){
      const it = pickAt(x, y);
      if(it) openDetail(it);
      else if(overHeroList(x, y)) heroListPress();
      else if(detailItem && g.src === 'hand') closeDetail();   // 손: 빈 곳을 누르면 닫기
    }
  }
  document.addEventListener('mousedown', e => { if(e.button === 0) down(e.clientX, e.clientY, 'mouse', e.target); });
  window.addEventListener('mousemove', e => { move(e.clientX, e.clientY); if(!grab) hoverAt(e.clientX, e.clientY); });
  window.addEventListener('mouseup', e => up(e.clientX, e.clientY));
  document.addEventListener('click', e => { if(suppressClick){ e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
  container.addEventListener('wheel', e => { camera.position.z = clamp(camera.position.z + e.deltaY * 0.4, MIN_Z, MAX_Z); e.preventDefault(); }, { passive:false });

  // ---- HERO LIST: 지구본 아래에 깔려 있어서 두 번 눌러야 이동 (첫 번째 = 빨갛게 + "한 번 더", 3초 안에 두 번째 = 이동) ----
  const heroLink = document.getElementById('heroListLink');
  let armTimer = null;
  const armHint = document.createElement('div');   // 지구본 위에 보이는 안내
  armHint.className = 'hl-armed'; armHint.textContent = '한 번 더 누르면 HERO LIST로';
  if(heroLink) document.body.appendChild(armHint);
  function overHeroList(x, y){
    if(!heroLink || detailItem) return false;
    const r = heroLink.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  function heroListPress(){
    if(heroLink.classList.contains('armed')){ location.href = heroLink.href; return; }
    heroLink.classList.add('armed'); armHint.classList.add('on');
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { heroLink.classList.remove('armed'); armHint.classList.remove('on'); }, 3000);
  }
  if(heroLink) heroLink.addEventListener('click', e => { e.preventDefault(); heroListPress(); });   // 혹시 직접 눌려도 두 번

  let hoverLink = null;
  function hoverAt(x, y){
    const it = x < 0 ? null : pickAt(x, y);
    hovered = it;
    const onHL = !it && x >= 0 && overHeroList(x, y);
    if(heroLink) heroLink.classList.toggle('dwell-hover', onHL);
    container.style.cursor = (it || onHL) ? 'pointer' : '';
    const el = x < 0 ? null : document.elementFromPoint(x, y);
    const link = el ? el.closest('a, button') : null;
    if(link !== hoverLink){
      if(hoverLink) hoverLink.classList.remove('dwell-hover');
      if(link) link.classList.add('dwell-hover');
      hoverLink = link;
    }
  }

  // ---- 카메라(손) ----
  let FIST_CLOSE = 0.6;
  document.addEventListener('keydown', e => {
    if(e.key === '[') FIST_CLOSE = Math.max(0.1, +(FIST_CLOSE - 0.05).toFixed(2));
    if(e.key === ']') FIST_CLOSE = Math.min(1.5, +(FIST_CLOSE + 0.05).toFixed(2));
  });
  let camOn = false, video = null, landmarker = null, lastVT = -1;
  let fistF = 0, openF = 0, fisted = false, hx = null, hy = null;
  async function startCam(){
    const LOCAL = '../../files/vendor/mediapipe/', CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/';
    const has = async u => { try{ return (await fetch(u, { method:'HEAD', cache:'no-store' })).ok; }catch(e){ return false; } };
    const localLib = await has(LOCAL + 'vision_bundle.js');
    const localModel = await has(LOCAL + 'hand_landmarker.task');
    const { HandLandmarker, FilesetResolver } = await import(localLib ? LOCAL + 'vision_bundle.js' : CDN + 'vision_bundle.mjs');
    const fs = await FilesetResolver.forVisionTasks(localLib ? LOCAL + 'wasm' : CDN + 'wasm');
    landmarker = await HandLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: localModel ? LOCAL + 'hand_landmarker.task' : 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
      runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5
    });
    video = document.createElement('video');
    video.style.display = 'none'; video.muted = true; video.playsInline = true;
    document.body.appendChild(video);
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width:640, height:480 } });
    await video.play();
    camOn = true;
    requestAnimationFrame(track);
  }
  function track(){
    if(!camOn) return;
    if(video.readyState >= 2 && video.currentTime !== lastVT){
      lastVT = video.currentTime;
      const r = landmarker.detectForVideo(video, performance.now());
      if(r.landmarks && r.landmarks.length){
        const lm = r.landmarks[0], c = lm[9], w = lm[0];
        const palm = { x:(lm[5].x+lm[9].x+lm[13].x+lm[17].x)/4, y:(lm[5].y+lm[9].y+lm[13].y+lm[17].y)/4 };
        const tx = (1 - c.x) * innerWidth, ty = c.y * innerHeight;
        hx = hx === null ? tx : hx + (tx - hx) * 0.5;
        hy = hy === null ? ty : hy + (ty - hy) * 0.5;
        const open = [lm[8],lm[12],lm[16],lm[20]].reduce((s,t)=>s+Math.hypot(t.x-palm.x, t.y-palm.y),0) / 4 / (Math.hypot(w.x-c.x, w.y-c.y) || 0.1);
        if(open <= FIST_CLOSE){ fistF++; openF = 0; } else { openF++; fistF = 0; }
        cursor.style.display = 'block'; cursor.style.left = hx + 'px'; cursor.style.top = hy + 'px';
        if(!fisted && fistF >= 2){ fisted = true; down(hx, hy, 'hand'); }
        else if(fisted && openF >= 2){ fisted = false; up(hx, hy); }
        cursor.classList.toggle('fist', fisted);
        if(fisted && fistF > 0) move(hx, hy);
        if(!grab || !grab.dragging) hoverAt(hx, hy); else hoverAt(-1, -1);
      } else {
        if(fisted){ fisted = false; if(grab) grab.dragging = true; up(-1, -1); }
        hx = hy = null; fistF = openF = 0;
        cursor.style.display = 'none'; cursor.classList.remove('fist');
        hoverAt(-1, -1);
      }
    }
    requestAnimationFrame(track);
  }
  let camStarted = false;
  function tryStartCam(){
    if(camStarted) return; camStarted = true;
    startCam().catch(err => { console.warn('camera unavailable:', err); camStarted = false; });
  }
  tryStartCam();
  ['click','keydown','touchstart'].forEach(ev => document.addEventListener(ev, tryStartCam));

  window.addEventListener('resize', () => {
    width = container.clientWidth; height = container.clientHeight;
    if(!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
  });

  build();
  window.refreshGlobePoints = build;
  animate();
})();
