/* Project.S 리디자인 — 카메라 켜기 → 손동작 안내 → Opening → Q1~Q5(키워드) → Q6(주관식) → 결과
   전시 환경은 마우스 없이 카메라(손동작)만 사용한다. 마우스/클릭 코드는 개발 중 테스트 편의용으로 남겨둠. */

/* ---------- 1. 후보 레인저 모자이크 (중앙 이미지) ---------- */
/* 실제 사진이 있는 레인저는 data/hero-images.json에 등록된 이미지를 소스로, 아직 사진이 없는
   레인저는 기존처럼 컬러 블록을 소스로 모자이크를 그린다. (310명 중 303명 사진 연결됨 — 나머지 7명은
   해당 시리즈 사진 자체가 폴더에 없어서 자동으로 컬러 블록 fallback을 쓴다.)
   manifest 값은 보통 문자열 하나(사진 한 장)지만, "루팡 X & 패트렌 X"처럼 콤보 캐릭터는 배열로
   등록해서 여러 장을 한 캔버스에 나란히 동시에 그린다. */
const COLOR_MAP = {
  "레드":"#c94b32","스카이블루":"#6bb3d6","네이비":"#24395c","블루":"#3a6fb0","옐로":"#d9a72c","그린":"#4a8f5c","핑크":"#c9698f",
  "블랙":"#3a3a3d","화이트":"#d8d5cb","골드":"#c9a24b","실버":"#9a9a9d","오렌지":"#d9722c",
  "바이올렛":"#7a5aa8","시안":"#4ab0c9","그레이":"#7d7d7f","브라운":"#8a6a4a"
};
// 오프닝 화면 컬러 그리드 — 연지가 지정한 순서 그대로. rangers.json의 실제 color 필드 값과
// 정확히 일치하는지 python으로 직접 확인함(레드50/오렌지6/옐로45/그린29/스카이블루1/블루50/
// 블랙27/실버13/골드12/화이트16/브라운1/네이비2 — 전부 0명은 없음).
const ID_COLORS = ["레드","오렌지","옐로","그린","스카이블루","블루","블랙","실버","골드","화이트","브라운","네이비"];
function colorFor(name){
  for(const k in COLOR_MAP){ if(name && name.includes(k)) return COLOR_MAP[k]; }
  return "#8a8a8a";
}
function colorCanvasFor(hex){
  const c = document.createElement('canvas');
  c.width = 300; c.height = 300;
  const cx = c.getContext('2d');
  cx.fillStyle = hex; cx.fillRect(0,0,300,300);
  return c;
}

// rangers.json의 name과 정확히 일치하는 키만 사용한다 (오타/공백 차이가 있으면 그냥 못 찾은 것으로 보고
// 컬러 블록으로 자연스럽게 대체된다 — 조용히 잘못된 사진을 붙이는 것보다 안전하다).
let HERO_IMAGES = {};
const heroImageCache = {}; // name -> Image[] (한 장이어도 항상 배열로 통일해서 다룬다)
// 사진을 나중에 다시 바꿔 넣어도(같은 파일명) 브라우저가 예전 캐시를 계속 보여주는 문제가 있었다.
// 페이지를 새로 열 때마다 값이 바뀌는 쿼리스트링을 붙여서 매번 새로 받아오게 한다.
const CACHE_BUST = Date.now();
function preloadHeroImages(){
  Object.entries(HERO_IMAGES).forEach(([name, src]) => {
    const paths = Array.isArray(src) ? src : [src];
    heroImageCache[name] = paths.map(p => {
      const img = new Image();
      img.src = p + (p.includes('?') ? '&' : '?') + 'v=' + CACHE_BUST;
      return img; // 로딩 중이어도 일단 캐시해두고, 쓸 때마다 img.complete로 확인한다
    });
  });
}

// 세로로 긴 투명배경 컷아웃 사진(들)을, 사이트 배경색(짙은 톤)을 채운 정사각형 캔버스 안에
// 비율 그대로(contain) 나란히 그린다 — 늘려서(stretch) 찌그러뜨리지 않기 위함.
// 사진이 한 장이면 캔버스 전체를 쓰고, 콤보처럼 여러 장이면 폭을 n등분해서 각자 중앙 정렬한다.
function heroPhotoCanvasFor(imgs){
  const c = document.createElement('canvas');
  c.width = 300; c.height = 300;
  const cx = c.getContext('2d');
  cx.fillStyle = '#ffffff'; // 사이트 배경색과 통일(흰 배경 테마)
  cx.fillRect(0, 0, 300, 300);
  const n = imgs.length;
  const colW = 300 / n;
  imgs.forEach((img, i) => {
    const scale = Math.min(colW / img.naturalWidth, 300 / img.naturalHeight) * 0.94; // 살짝 여백
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    cx.drawImage(img, i * colW + (colW - dw) / 2, (300 - dh) / 2, dw, dh);
  });
  return c;
}

// 사진이 준비된 레인저는 사진을, 아직 없는 레인저는 기존 컬러 블록을 모자이크 소스로 돌려준다.
function mosaicSourceFor(ranger){
  const imgs = heroImageCache[ranger.name];
  if(imgs && imgs.length && imgs.every(img => img.complete && img.naturalWidth > 0)){
    return heroPhotoCanvasFor(imgs);
  }
  return colorCanvasFor(colorFor(ranger.color));
}

// colorMix: 0=흑백(모노톤), 1=원색. Q.n마다 COLOR_MIX 배열에 정해둔 고정값을 쓴다 (애니메이션으로
// 스며들게 하지 않고, 질문이 넘어갈 때마다 채도 자체가 한 단계씩 오르는 방식).
function renderCandidateFrame(canvasEl, ranger, rate, colorMix = 0){
  // minCell(선명할 때 타일 크기)~maxCell(추상적일 때 타일 크기) 사이를 rate에 비례해 오간다.
  // 타일 크기를 고정 픽셀값으로 주면 캔버스 크기(candidateCanvas 480px, resultCanvas 600px 등)에 따라
  // 같은 rate라도 체감 모자이크 강도가 달라진다 — 캔버스 폭에 비례하게 계산해서 어느 화면에서든
  // 같은 rate=같은 느낌(타일 개수 동일)이 되게 한다. 기준은 처음 튜닝했던 300px 기준(3~30).
  const scale = canvasEl.width / 300;
  const m = new MosaicRenderer(canvasEl, mosaicSourceFor(ranger), { minCell: 3 * scale, maxCell: 30 * scale, bg: '#ffffff' });
  m.render(rate, colorMix);
  return m;
}

// 결과 화면 전용: 기획서의 "Monotone -> color, 변신 모션" 중 "변신" 부분은 기존 질문 전환과 같은
// 100% 모자이크 플래시로만 표현한다 (색이 스며드는 애니메이션은 쓰지 않음 — 질문마다 채도가
// 이미 고정 단계로 올라가 있다가, 결과 화면에서 마지막 단계인 완전한 원색으로 딱 정착하는 방식).
function showFinalFrame(canvasEl, ranger, rate, colorMix){
  renderCandidateFrame(canvasEl, ranger, 1.0, 0); // 100% 모자이크 플래시(흑백)
  setTimeout(() => renderCandidateFrame(canvasEl, ranger, rate, colorMix), 220);
}

let candidateTimer = null;
function startCandidateCycle(canvasEl, pool, rate, colorMix){
  stopCandidateCycle();
  if(!pool || !pool.length) return;
  const tick = () => {
    const r = pool[Math.floor(Math.random()*pool.length)];
    renderCandidateFrame(canvasEl, r, rate, colorMix);
  };
  tick();
  candidateTimer = setInterval(tick, 300); // 0.3초마다 후보가 랜덤하게 바뀐다
}
function stopCandidateCycle(){
  if(candidateTimer){ clearInterval(candidateTimer); candidateTimer = null; }
}
// 질문이 바뀔 때: 잠깐 100% 모자이크로 플래시했다가(변신 효과) 다음 rate·채도로 정착
function flashThenCycle(canvasEl, pool, rate, colorMix){
  stopCandidateCycle();
  const first = pool[0] || RANGERS[0];
  renderCandidateFrame(canvasEl, first, 1.0, 0);
  setTimeout(() => startCandidateCycle(canvasEl, pool, rate, colorMix), 220);
}

/* ---------- 2. 화면 전환 ---------- */
const screens = {
  camstart:'screen-camstart', tutorial:'screen-tutorial', open:'screen-open',
  q:'screen-q', q6:'screen-q6', loading:'screen-loading', result:'screen-result'
};
function goto(name){
  Object.values(screens).forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById(screens[name]).classList.add('active');
  if(name === 'tutorial'){
    resetTutorial();
  }
  if(name === 'open'){
    const input = document.getElementById('nicknameInput');
    setTimeout(() => input.focus(), 30); // 화면 전환 직후 바로 타이핑할 수 있게 자동 포커스
    resetOpenPreview(); // 컬러를 고르기 전까지는 무채색 미리보기만 흐릿하게 보여준다
  }
}

/* 손 사용법 화면 — 타이머로 저절로 넘기지 않고, 실제로 주먹을 쥐었다 폈다를 3번 반복해야
   (=카메라가 실제 제스처를 3번 감지해야) 다음으로 넘어간다. 아이콘은 지금 실제 손 상태를
   그대로 보여준다(주먹을 쥔 순간 바로 주먹 그래픽으로 바뀜) — 직접 해보면서 배우는 화면이라
   타이머보다 훨씬 즉각적이고 정확하다. */
const TUTORIAL_REPS_NEEDED = 3;
let tutorialReps = 0;
let tutorialArmed = true;
// 다시 무장(armed)하는 기준을, 실측 안 된 FIST_OPEN(=1.1) 문턱값 대신 "펴진 상태가 일정 시간
// 이어졌는가"로 바꿨다. FIST_OPEN은 원래 코드 주석에도 "실측 없이 잡은 추정치"라고 적혀 있던
// 값이라, 실제 손이 그 값까지 펴지지 않으면(카메라 각도·손 크기에 따라 충분히 있을 수 있음)
// 첫 번째 쥠 이후 영영 재무장이 안 돼서 3번을 채워도 버튼이 안 뜨는 것처럼 보일 수 있었다.
// FIST_CLOSE(=0.7, 다른 모든 버튼에서 이미 검증된 값)만 기준으로 쓰고, 그 반대 상태(안 쥔 상태)가
// 150ms만 이어지면 재무장하는 쪽이 손 크기/각도 편차에 훨씬 안전하다.
let tutorialOpenSince = 0;
const TUTORIAL_REARM_MS = 150;

function resetTutorial(){
  tutorialReps = 0;
  tutorialArmed = true;
  tutorialOpenSince = 0;
  document.getElementById('iconHandOpen').style.display = 'block';
  document.getElementById('iconFist').style.display = 'none';
  document.getElementById('tutorialCaption').textContent = '손바닥을 편 상태로는 아무 일이 일어나지 않습니다.';
  document.getElementById('tutorialNextBtn').classList.remove('visible');
  updateTutorialProgress();
}

function updateTutorialProgress(){
  const el = document.getElementById('tutorialProgress');
  if(el) el.textContent = Math.min(tutorialReps, TUTORIAL_REPS_NEEDED) + ' / ' + TUTORIAL_REPS_NEEDED;
}

// openness: trackHand가 계산하는 "얼마나 편 손인가" 값 그대로 받는다(작을수록 주먹).
// 카메라가 켜져 있는 동안은 카메라 값만 이 함수를 부른다 — 마우스 폴링 루프(pollMouse)와
// 카메라 루프(trackHand)가 매 프레임 각자 다른 값으로 이 함수를 동시에 부르면, 마우스를 안
// 건드리고 있어도 그 "false" 호출이 카메라가 방금 감지한 "주먹 쥠"을 끼어들어 지워버려서 —
// 카메라가 켜진 동안은 카메라만, 꺼져 있을 때(마우스로만 테스트할 때)는 마우스만 부르게 했다.
function updateTutorial(openness){
  const onTutorial = document.getElementById('screen-tutorial').classList.contains('active');
  if(!onTutorial) return;
  const fisted = openness <= FIST_CLOSE;
  const now = performance.now();

  document.getElementById('iconHandOpen').style.display = fisted ? 'none' : 'block';
  document.getElementById('iconFist').style.display = fisted ? 'block' : 'none';
  document.getElementById('tutorialCaption').textContent = fisted
    ? '주먹을 쥐면 선택이 됩니다.'
    : '손바닥을 편 상태로는 아무 일이 일어나지 않습니다.';

  if(fisted){
    tutorialOpenSince = 0;
    if(tutorialArmed){
      tutorialReps++;
      tutorialArmed = false; // 다시 일정 시간 펴기 전까지는 같은 쥠을 또 세지 않는다
      updateTutorialProgress();
      if(tutorialReps >= TUTORIAL_REPS_NEEDED){
        // 3번 채웠다고 바로 넘기지 않고, "넘어가기" 버튼을 보여준다 — 손을 계속 쥐고 있어도
        // 실수로 바로 넘어가지 않고, 스스로 버튼을 눌러(또는 주먹으로) 확인하고 넘어간다.
        document.getElementById('tutorialNextBtn').classList.add('visible');
      }
    }
  } else {
    if(!tutorialOpenSince) tutorialOpenSince = now;
    if(now - tutorialOpenSince >= TUTORIAL_REARM_MS) tutorialArmed = true;
  }
}

/* ---------- 3. Q1~Q5 데이터 + 진행 상태 ---------- */
const Q_META = [
  { id:'Q1_책임과 사명', title:'Q1 · 책임과 사명', sub:'무거운 걸 짊어질 때, 나는 —' },
  { id:'Q2_감정을 다루는 방식', title:'Q2 · 감정을 다루는 방식', sub:'마음이 흔들릴 때, 나는 —' },
  { id:'Q3_관계 맺는 방식', title:'Q3 · 관계 맺는 방식', sub:'사람과 함께일 때, 나는 —' },
  { id:'Q4_나를 보는 시선', title:'Q4 · 나를 보는 시선', sub:'스스로를 볼 때, 나는 —' },
  { id:'Q5_행동하는 방식', title:'Q5 · 행동하는 방식', sub:'무언가에 부딪힐 때, 나는 —' }
];
const MOSAIC_RATES = [1.00, 0.79, 0.64, 0.50, 0.45]; // Q1~Q5 고정 모자이크 비율
const Q6_RATE = 0.34, RESULT_RATE = 0.1;
// Q.n이 진행될수록(모자이크가 선명해질수록) 채도도 같이 단계적으로 오른다 — 애니메이션으로 스며들게
// 하지 않고, 질문마다 딱 정해둔 값으로 고정. Q1은 완전 흑백, 결과 화면에서 완전한 원색으로 정착.
const COLOR_MIX = [0.15, 0.15, 0.3, 0.45, 0.6]; // Q1~Q5 — Q1도 완전 흑백 대신 Q2와 같은 채도로 시작
const Q6_COLOR_MIX = 0.75, RESULT_COLOR_MIX = 1;
const MAX_PICK = 5, MIN_PICK = 3, TOP_N = 10;

let KEYWORDS = null, RANGERS = null;
let qIndex = 0;
let picks = [[],[],[],[],[]];
let subjectiveText = '';
let nickname = '';
let matched = null;
let selectedColor = null; // 오프닝 화면에서 고른 컬러 (예: "레드") — 닉네임과 합쳐져 최종 아이디가 된다

/* ---------- 오프닝 화면: 컬러 선택 + 닉네임 조합(아이디) + 컬러별 랜덤 모자이크 미리보기 ---------- */
const OPEN_RATE = 0.55, OPEN_COLOR_MIX = 1; // 미리보기는 원색으로, 살짝 추상화된 정도로 보여준다

function initColorGrid(){
  const grid = document.getElementById('colorGrid');
  if(!grid || grid.childElementCount) return; // 이미 만들어놨으면 다시 안 만든다
  ID_COLORS.forEach(name => {
    const el = document.createElement('div');
    el.className = 'color-swatch dwellable';
    el.dataset.color = name;
    // 주의: 손동작(dwellable) 위에 손을 올리면 범용 grip 시스템(updateGrip)이 hover/press 피드백으로
    // 이 엘리먼트의 style.background를 직접 덮어썼다 지웠다 한다(applyGripProgress/resetGripVisual).
    // 스와치의 실제 컬러를 style.background에 그대로 넣어두면, 손을 뗀 순간 resetGripVisual이
    // background를 ''로 비우면서 원래 색까지 같이 지워져 "선택하면 까맣게 변하는" 버그가 났다.
    // CSS 커스텀 프로퍼티에 색을 넣고, 실제 배경은 스타일시트(.color-swatch{background:var(...)})가
    // 그리게 하면, JS가 inline background를 지워도(=빈 문자열) 스타일시트 규칙으로 자연스럽게
    // 되돌아가서 원래 색이 유지된다.
    el.style.setProperty('--swatch-color', COLOR_MAP[name] || '#8a8a8a');
    grid.appendChild(el);
  });
}

function selectColor(el){
  const name = el.dataset.color;
  selectedColor = name;
  document.querySelectorAll('#colorGrid .color-swatch').forEach(s => s.classList.toggle('selected', s === el));
  updateCombinedIdPreview();
  refreshStartBtn();
  // 스카이블루는 rangers.json 안에 딱 1명뿐이라(직접 python으로 세어봄) 같은 계열인 블루 풀도
  // 같이 보여준다 — 연지가 요청한 대로. 블루를 고를 땐 원래도 50명이라 그대로 둔다.
  const pool = RANGERS
    ? RANGERS.filter(r => r.color === name || (name === '스카이블루' && r.color === '블루'))
    : [];
  if(pool.length){
    flashThenCycle(document.getElementById('openCanvas'), pool, OPEN_RATE, OPEN_COLOR_MIX);
  }
}

function updateCombinedIdPreview(){
  const raw = (document.getElementById('nicknameInput').value || '').trim();
  const label = document.getElementById('combinedIdPreview');
  if(raw && selectedColor) label.textContent = raw + ' ' + selectedColor;
  else if(selectedColor) label.textContent = '(아이디를 입력하면 "' + selectedColor + '"과 합쳐져)';
  else label.textContent = '';
}

// 오프닝 화면에 처음 들어왔을 때 / 다시 시작할 때 — 아직 컬러를 고르지 않았으니
// 무작위 레인저 하나를 무채색(흑백)으로 흐릿하게만 보여준다(연지가 준 목업의 흐린 회갈색 프리뷰와 같은 톤).
function resetOpenPreview(){
  stopCandidateCycle();
  const c = document.getElementById('openCanvas');
  if(!c || !RANGERS || !RANGERS.length) return;
  const r = RANGERS[Math.floor(Math.random() * RANGERS.length)];
  renderCandidateFrame(c, r, 0.3, 0);
}

async function loadData(){
  const [kw, rg, heroImages] = await Promise.all([
    fetch('data/keywords.json').then(r=>r.json()),
    fetch('data/rangers.json').then(r=>r.json()),
    fetch('data/hero-images.json').then(r=>r.json()).catch(() => ({})) // 사진 매니페스트가 없어도 컬러 블록으로 정상 동작
  ]);
  KEYWORDS = kw; RANGERS = rg; HERO_IMAGES = heroImages;
  preloadHeroImages();
}

function topKeywords(catId){
  const cat = KEYWORDS.categories.find(c=>c.id===catId);
  const list = [...cat.canon];
  list.sort((a,b) => (KEYWORDS.counts[b]||0) - (KEYWORDS.counts[a]||0));
  return list.slice(0, TOP_N);
}

// 이전 질문까지 확정된 키워드로 후보 레인저 풀을 좁힌다 (진행될수록 범위가 좁아짐)
function computePool(){
  const answered = picks.slice(0, qIndex).flat();
  if(answered.length === 0) return RANGERS;
  const scored = RANGERS.map(r => {
    const w = (r.weaknessCanon||[]).filter(k=>answered.includes(k)).length;
    const p = (r.personalityCanon||[]).filter(k=>answered.includes(k)).length;
    return { r, score: w*2+p };
  });
  scored.sort((a,b)=>b.score-a.score);
  const keep = Math.max(6, 40 - qIndex*8);
  return scored.slice(0, keep).map(s=>s.r);
}

let qEnteredAt = 0;

function renderQuestion(){
  qEnteredAt = performance.now(); // 화면 전환 직후의 자연스러운 손 이동을 펀치로 오인하지 않도록
  dwellTarget = null; dwellProgress = new Map(); // Q2 붙잡기 상태도 문항이 바뀔 때마다 초기화
  floatItems = [];
  paintState = new Map(); paintTarget = null; paintLastBin = -1; // Q3 칠하기 상태도 초기화
  setPaintMode('brush'); // Q3에 새로 들어올 때는 항상 브러시부터
  punchHistory = []; // Q5 펀치 이동 기록도 문항이 바뀔 때마다 초기화
  const meta = Q_META[qIndex];
  // 텍스트 "Q1 · 제목" 대신, 연지가 준 픽셀 로고 이미지(Page 1~5)로 문항 번호를 표시한다.
  const titleImg = document.getElementById('qTitleImg');
  titleImg.src = 'images/ui/page-header-' + (qIndex + 1) + '.png';
  titleImg.alt = meta.title;
  document.getElementById('qSub').innerHTML = meta.sub + '<br>해당하는 걸 3~5개 골라줘.';
  const grid = document.getElementById('kwGrid');
  grid.innerHTML = '';
  grid.className = 'kw-grid'; // 매 질문마다 인터렉션별 클래스 초기화

  const kws = topKeywords(meta.id);
  const isQ1 = qIndex === 0;
  // dwellable(범용 "주먹=클릭" 시스템)은 Q4·브러시/지우개 도구 버튼에만 붙인다.
  // Q1(드래그)·Q2(떠다니다 붙잡기)·Q3(칠하기)·Q5(빠른 스침)는
  // handlePointerActivity/updateQ1Drag에 각자 전용 로직이 있어서, dwellable을 같이 붙이면
  // 전용 제스처 없이도 그냥 주먹을 얹어두기만 해도 범용 클릭이 먼저 선택해버려
  // 의도한 난이도/느낌이 사라진다.
  const usesDwellClick = (qIndex === 3);
  const isQ3 = qIndex === 2;
  kws.forEach((k, i) => {
    const el = document.createElement('div');
    el.className = 'kw' + (usesDwellClick ? ' dwellable' : '') + (isQ3 ? ' kw-paint' : '');
    el.dataset.kw = k;
    el.draggable = isQ1; // Q1만 바구니로 드래그하는 인터렉션 (마우스 테스트용)
    if(isQ3){
      // Q3 — 버튼을 PAINT_BINS개의 세로 칸으로 나눠서, 주먹으로 쓸고 지나간 칸만 색이 채워지게 한다.
      for(let b=0;b<PAINT_BINS;b++){
        const cell = document.createElement('div');
        cell.className = 'paint-cell';
        cell.style.left = (b/PAINT_BINS*100) + '%';
        cell.style.width = (100/PAINT_BINS) + '%';
        el.appendChild(cell);
      }
    }
    const label = document.createElement('span');
    label.className = 'kw-label';
    label.textContent = k;
    el.appendChild(label);
    if(picks[qIndex].includes(k)) el.classList.add('selected');
    grid.appendChild(el);
  });

  document.getElementById('basketZone').style.display = isQ1 ? 'block' : 'none';
  const isQ4 = qIndex === 3;
  // Q4의 눈가리개(eyeMask)는 q-body 밖(화면 전체 fixed)에 따로 떠 있는 엘리먼트라, q-body를
  // 숨긴다고 같이 안 숨는다 — 설명이 보이는 3초 동안은 항상 꺼둔다. 실제로 켜는(display:block +
  // 위치 계산) 건 아래 revealAfterIntro의 onReveal에서, 버튼 영역(q-body)이 진짜로 보이기 시작한
  // 뒤에 한다(안 그러면 아직 안 보이는 kwGrid의 크기가 0이라 마스크 위치가 엉뚱하게 잡힌다).
  const eyeMask = document.getElementById('eyeMask');
  eyeMask.style.display = 'none';
  document.getElementById('paintTools').style.display = isQ3 ? 'flex' : 'none';
  document.getElementById('resetQ5Btn').style.display = (qIndex === 4) ? 'inline-block' : 'none';

  const HINTS = [
    '키워드를 집어서 바구니 안에 놓아야 선택돼.',
    '천천히 떠다니는 키워드를 주먹 쥔 채로 2초간 붙잡으면 불이 켜지듯 담겨.',
    '주먹을 쥔 채로 버튼 위를 쓸어서 칠하면, 다 채워졌을 때 선택돼. 지우개를 고르면 칠한 걸 지워서 해제할 수 있어.',
    '눈을 움직여 원하는 키워드를 찾고 짚어줘.',
    '주먹을 쥔 채로 해당하는 키워드를 펀치하듯 빠르게 쳐내면 날아가.'
  ];
  document.getElementById('qHint').textContent = HINTS[qIndex] || '';

  // Q2 float 클래스는 지금 붙여도 되지만(그냥 CSS), 실제 좌표 계산(initFloatingKeywords)은
  // kwGrid가 아직 안 보이는 상태(q-body가 display:none)라 크기가 0으로 잡혀서 전부 한쪽 구석에
  // 몰려버린다 — 이것도 revealAfterIntro의 onReveal로 미룬다.
  if(qIndex === 1) grid.classList.add('float');
  if(qIndex === 2) grid.classList.add('glow');
  // Q5 — 원형 방어벽 대신 진짜 세로 한 줄로. 한 줄이라 좁고 기니까 이미지 쪽과 가운데로
  // 몰려붙지 않도록 q-layout을 양 끝으로 벌려서(spread) 왼쪽으로 더 빠지게 한다.
  document.getElementById('qLayout').classList.toggle('spread', qIndex === 4);
  if(qIndex === 4){
    grid.classList.add('column');
  }

  refreshNextBtn();

  const pool = computePool();
  // 모자이크 캔버스는 q-body 안에 있어도 display:none과 무관하게 그릴 수 있어서(캔버스는 레이아웃과
  // 상관없이 그려짐), 미리 그려두면 나중에 q-body가 보이는 순간 바로 완성된 그림이 나온다.
  flashThenCycle(document.getElementById('candidateCanvas'), pool, MOSAIC_RATES[qIndex], COLOR_MIX[qIndex]);

  // 설명(q-intro)을 3초 보여준 뒤 페이드 아웃하고, 그다음에야 선택지/그래픽/버튼(q-body)을 보여준다.
  revealAfterIntro('qIntro', 'qBody', 3000, () => {
    if(qIndex === 1) initFloatingKeywords(grid);
    if(isQ4){
      const gridRect = grid.getBoundingClientRect();
      const pad = 14;
      eyeMask.style.display = 'block';
      eyeMask.style.left = (gridRect.left - pad) + 'px';
      eyeMask.style.top = (gridRect.top - pad) + 'px';
      eyeMask.style.width = (gridRect.width + pad * 2) + 'px';
      eyeMask.style.height = (gridRect.height + pad * 2) + 'px';
    }
  });
}

/* Q1~Q6 공통: "설명 먼저 3초 -> 페이드 -> 선택지" 순서로 화면을 보여준다.
   introId 엘리먼트를 3초간 보여준 뒤 400ms로 페이드 아웃하고, bodyId 엘리먼트를 display:flex로
   바꾼 다음 다시 opacity를 0->1로 페이드 인한다. onReveal은 bodyId가 실제로 보이기 시작한
   직후(그 안의 요소들이 진짜 레이아웃/크기를 갖게 된 다음) 한 번 호출된다. */
let qRevealTimer = null;
function revealAfterIntro(introId, bodyId, delayMs, onReveal){
  clearTimeout(qRevealTimer);
  const intro = document.getElementById(introId);
  const body = document.getElementById(bodyId);
  intro.classList.remove('fade-out');
  intro.style.display = 'flex';
  body.classList.remove('visible');
  body.style.display = 'none';
  qRevealTimer = setTimeout(() => {
    intro.classList.add('fade-out');
    setTimeout(() => {
      intro.style.display = 'none';
      body.style.display = 'flex';
      requestAnimationFrame(() => body.classList.add('visible'));
      if(onReveal) onReveal();
    }, 400); // .q-intro의 opacity transition 시간과 맞춘다
  }, delayMs);
}

function refreshNextBtn(){
  const nextBtn = document.getElementById('nextBtn');
  const ok = picks[qIndex].length >= MIN_PICK;
  nextBtn.style.opacity = ok ? '1' : '0.35';
  nextBtn.style.pointerEvents = ok ? 'auto' : 'none';
}

function toggleKeyword(el){
  const k = el.dataset.kw;
  const arr = picks[qIndex];
  const i = arr.indexOf(k);
  const isRing = qIndex === 4;
  const isBasket = qIndex === 0;
  if(i>=0){
    arr.splice(i,1); el.classList.remove('selected');
    if(isRing) el.classList.remove('punched');
    if(isBasket) el.classList.remove('picked-source'); // 바구니에서 빠지면 원래 자리에 다시 보이게
  } else{
    if(arr.length>=MAX_PICK) return;
    arr.push(k); el.classList.add('selected');
    if(isRing) el.classList.add('punched');
    if(isBasket) el.classList.add('picked-source'); // 바구니에 들어가면 원래 자리에서 계속 사라진 채로
  }
  // 카메라로 손을 떼지 않고 같은 자리에서 다시 선택/해제할 때, 손 오므림 진행도로 덧씌워졌던
  // 인라인 테두리/배경색이 그대로 남아 "해제됐는데도 계속 빛나 보이는" 문제를 막는다.
  el.style.borderColor = '';
  el.style.background = '';
  if(qIndex === 1){
    // Q2 — 선택되면 그 자리에 멈춰서 빛나고, 선택 해제되면 다시 떠다니기 시작한다.
    const item = floatItems.find(f => f.el === el);
    if(item) item.frozen = el.classList.contains('selected');
  }
  refreshNextBtn();
}

/* ---------- 4. 매칭 알고리즘 (약점 겹침 ×2, 성격 겹침 ×1) ---------- */
function runMatch(){
  const allPicked = picks.flat();
  let best = [], bestScore = -1;
  RANGERS.forEach(r => {
    const wOverlap = (r.weaknessCanon||[]).filter(k=>allPicked.includes(k)).length;
    const pOverlap = (r.personalityCanon||[]).filter(k=>allPicked.includes(k)).length;
    const score = wOverlap*2 + pOverlap*1;
    if(score > bestScore){ bestScore = score; best = [r]; }
    else if(score === bestScore){ best.push(r); }
  });
  return best[Math.floor(Math.random()*best.length)];
}

function showResult(){
  stopCandidateCycle();
  matched = runMatch();
  document.getElementById('resultName').textContent = matched.name;
  document.getElementById('resultSummary').textContent = matched.summary || matched.description || '';
  showFinalFrame(document.getElementById('resultCanvas'), matched, RESULT_RATE, RESULT_COLOR_MIX);
  renderResultKeywords();
  saveToArchive();
  fetchAiInterpretation();
}

// "영웅의 키워드" — AI를 기다릴 필요 없이 바로 보여줄 수 있는 부분. 매칭된 히어로 자신의
// 약점/성격 키워드를 전부 태그로 보여주되, 그중 관람객이 실제로 고른 것(=이번 매칭의 근거)은
// 밝게 강조해서, 뒤에 나올 "왜 닮았는지" AI 설명을 읽기 전에도 눈으로 먼저 근거가 보이게 한다.
function renderResultKeywords(){
  const wrap = document.getElementById('resultKeywords');
  wrap.innerHTML = '';
  const allPicked = picks.flat();
  const all = [...new Set([...(matched.weaknessCanon||[]), ...(matched.personalityCanon||[])])];
  all.forEach(k => {
    const span = document.createElement('span');
    span.textContent = k;
    if(allPicked.includes(k)) span.classList.add('matched');
    wrap.appendChild(span);
  });
}

// Q6 주관식 답변을 서버(/api/interpret, Claude API 프록시)로 보내서 "왜 이 히어로와 닮았는지"
// 설명과, 히어로의 특징과 관람객의 약점을 짝지은 한 줄 해석 두 가지를 받아온다. 실제 API
// 호출이라 1~수 초 걸릴 수 있어서, 응답이 오기 전까지는 "생성 중" 문구를 보여줘서 사용자가
// 화면이 멈춘 게 아니라 기다리면 된다는 걸 알 수 있게 한다.
// 전시 중 서버/인터넷이 안 되는 경우에도 퀴즈 자체는 끊기면 안 되므로, 실패하면 그냥 조용히
// 문구를 지우고 결과 화면은 정상 진행한다 (에러를 사용자에게 보여주지 않음).
async function fetchAiInterpretation(){
  const explEl = document.getElementById('aiExplanation');
  const lineEl = document.getElementById('aiInterpretation');
  if(!subjectiveText){ explEl.textContent = ''; lineEl.textContent = ''; return; }
  explEl.textContent = '수호 영웅의 답변을 생성하는 중…';
  lineEl.textContent = '';
  try{
    // 왜 닮았는지 설명할 근거로, 실제 매칭에 쓰인 "겹친 키워드"(사용자가 고른 것 중 이
    // 히어로의 약점/성격 키워드와 겹친 것)를 같이 보낸다 — 약점 겹침이 매칭에서 2배 가중치라
    // weakness 쪽이 "왜 닮았는지"의 더 직접적인 근거가 된다.
    const allPicked = picks.flat();
    const weaknessKeywords = (matched.weaknessCanon || []).filter(k => allPicked.includes(k));
    const personalityKeywords = (matched.personalityCanon || []).filter(k => allPicked.includes(k));
    const res = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectiveText,
        heroName: matched.name,
        heroSummary: matched.summary || matched.description || '',
        weaknessKeywords,
        personalityKeywords
      }),
      signal: AbortSignal.timeout(12000)
    });
    if(!res.ok) throw new Error('interpret API status ' + res.status);
    const data = await res.json();
    explEl.textContent = (data && data.explanation) ? data.explanation : '';
    lineEl.textContent = (data && data.oneLiner) ? data.oneLiner : '';
  }catch(err){
    console.warn('AI 해석 불러오기 실패 (조용히 넘어감):', err);
    explEl.textContent = '';
    lineEl.textContent = '';
  }
}

/* 기존 archive/index.html("기록의 벽")이 쓰는 localStorage 키·스키마를 그대로 따른다.
   archive와 이 test 페이지가 같은 오리진(같은 로컬 서버)에서 열려야 데이터가 공유된다. */
const ARCHIVE_KEY = 'projectR_archive';
function saveToArchive(){
  try{
    const allPicked = picks.flat();
    const canon = [...(matched.weaknessCanon||[]), ...(matched.personalityCanon||[])];
    const record = {
      ts: Date.now(),
      nickname,
      heroName: matched.name,
      heroSeries: matched.series || '',
      heroColor: matched.color || '',
      userKeywords: allPicked,
      matchedKeywords: allPicked.filter(k => canon.includes(k)),
      freeText: subjectiveText
    };
    const arr = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
    arr.push(record);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(arr));
  }catch(err){
    console.warn('기록 보관 실패 (localStorage 접근 불가):', err);
  }
}

/* ---------- 5. 액션 ---------- */
function handleAction(action){
  if(action==='camstart'){
    beginCamera();
  } else if(action==='tutorial-done'){
    goto('open');
  } else if(action==='start'){
    // 컬러 + 닉네임을 합쳐서 최종 아이디로 쓴다 (예: "레드" + "지짱" → "지짱 레드")
    const raw = (document.getElementById('nicknameInput').value || '').trim();
    if(!raw || !selectedColor) return;
    nickname = raw + ' ' + selectedColor;
    qIndex = 0; renderQuestion(); goto('q');
  } else if(action==='next'){
    if(qIndex < Q_META.length-1){
      qIndex++; renderQuestion();
    } else {
      goto('q6');
      const pool = computePool();
      flashThenCycle(document.getElementById('candidateCanvasQ6'), pool, Q6_RATE, Q6_COLOR_MIX);
      refreshFinishBtn();
      // Q1~Q5와 같은 순서: 설명(q-intro) 3초 -> 선택지 자리(여기선 입력창)가 있는 q-body.
      // 텍스트 입력창은 보이기 전엔 포커스를 줘봐야 의미 없으니, 진짜 보이기 시작한 뒤에 포커스한다.
      revealAfterIntro('qIntroQ6', 'qBodyQ6', 3000, () => {
        setTimeout(() => document.getElementById('subjectiveInput').focus(), 30);
      });
    }
  } else if(action==='finish'){
    subjectiveText = (document.getElementById('subjectiveInput').value || '').trim();
    if(!subjectiveText) return; // 미기입 시 넘어가지 않음
    goto('loading');
    setTimeout(() => { showResult(); goto('result'); }, 900);
  } else if(action==='prev'){
    // Q6(주관식)은 별도 화면이라 Q5로 돌아갈 땐 화면 자체를 바꿔줘야 한다.
    // Q1~Q5는 같은 화면(screen-q) 안에서 qIndex만 하나 줄이고 다시 그린다.
    // 이미 골랐던 키워드(picks)는 그대로 남아 있어서 되돌아가면 선택된 상태 그대로 보인다.
    const onQ6 = document.getElementById('screen-q6').classList.contains('active');
    if(onQ6){
      qIndex = Q_META.length - 1; // Q5
      renderQuestion();
      goto('q');
    } else if(qIndex > 0){
      qIndex--; renderQuestion();
    } else {
      goto('open'); // Q1보다 더 이전은 오프닝 화면
    }
  } else if(action==='restart'){
    picks = [[],[],[],[],[]]; qIndex = 0; matched = null; subjectiveText = ''; nickname = '';
    selectedColor = null;
    document.querySelectorAll('#colorGrid .color-swatch').forEach(s => s.classList.remove('selected'));
    document.getElementById('nicknameInput').value = '';
    document.getElementById('subjectiveInput').value = '';
    document.getElementById('combinedIdPreview').textContent = '';
    stopCandidateCycle();
    refreshStartBtn();
    refreshFinishBtn();
    goto('open');
  } else if(action==='reset-q5'){
    resetQ5();
  }
}

// Q5 — 펀치는 "아직 선택 안 된 키워드"에만 반응해서, 다른 질문들처럼 다시 눌러 취소하는 게
// 안 된다(이미 날아간 키워드는 화면에서 사라져서 다시 펀치할 대상 자체가 없다). 그래서 잘못
// 날려보냈을 때 이 질문에서 고른 걸 통째로 되돌리는 버튼을 따로 둔다.
function resetQ5(){
  picks[4] = [];
  document.querySelectorAll('#kwGrid .kw').forEach(el => {
    el.classList.remove('selected', 'punched');
    el.style.borderColor = '';
    el.style.background = '';
    el.style.color = '';
    el.style.boxShadow = '';
  });
  refreshNextBtn();
}

document.addEventListener('click', (e) => {
  const swatch = e.target.closest('.color-swatch'); // 오프닝 화면 컬러 선택
  if(swatch){ selectColor(swatch); return; }
  const kw = e.target.closest('.kw');
  const onQ1 = qIndex === 0 && document.getElementById('screen-q').classList.contains('active');
  if(kw && !onQ1){ toggleKeyword(kw); return; } // Q1은 탭으로 선택 안 됨 — 반드시 드래그
  const tool = e.target.closest('[data-tool]'); // Q3 브러시/지우개 전환
  if(tool){ setPaintMode(tool.dataset.tool); return; }
  const btn = e.target.closest('[data-action]');
  if(btn) handleAction(btn.dataset.action);
});

/* 맨 처음 화면(카메라 켜기)은 아직 카메라도 마우스도 없는 상태라 버튼을 누를 방법이 없다.
   전시장 키보드로 엔터만 누르면 켜지게 한다. */
document.addEventListener('keydown', (e) => {
  if(e.key !== 'Enter') return;
  if(document.getElementById('screen-camstart').classList.contains('active')){
    handleAction('camstart');
  }
});

/* 아이디(별명) — 컬러를 고르고 닉네임을 입력해야 시작 버튼이 활성화된다(둘 다 있어야 조합 가능) */
initColorGrid();
const nicknameInput = document.getElementById('nicknameInput');
const startBtn = document.getElementById('startBtn');
function refreshStartBtn(){
  const ok = nicknameInput.value.trim().length > 0 && !!selectedColor;
  startBtn.style.opacity = ok ? '1' : '0.35';
  startBtn.style.pointerEvents = ok ? 'auto' : 'none';
}
nicknameInput.addEventListener('input', () => { refreshStartBtn(); updateCombinedIdPreview(); });
nicknameInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') handleAction('start');
});

/* Q6 주관식 — 입력 전엔 결과 보기 버튼 비활성 */
const subjectiveInput = document.getElementById('subjectiveInput');
const finishBtn = document.getElementById('finishBtn');
function refreshFinishBtn(){
  const ok = subjectiveInput.value.trim().length > 0;
  finishBtn.style.opacity = ok ? '1' : '0.35';
  finishBtn.style.pointerEvents = ok ? 'auto' : 'none';
}
subjectiveInput.addEventListener('input', refreshFinishBtn);

/* Q1 드래그-투-바구니 (마우스 테스트용 — 실제 전시에서는 카메라 손동작으로 동일 처리) */
document.addEventListener('dragstart', (e) => {
  const kw = e.target.closest('.kw');
  if(kw) e.dataTransfer.setData('text/plain', kw.dataset.kw);
});
const basketZone = document.getElementById('basketZone');
basketZone.addEventListener('dragover', (e) => { e.preventDefault(); basketZone.classList.add('drag-over'); });
basketZone.addEventListener('dragleave', () => basketZone.classList.remove('drag-over'));
basketZone.addEventListener('drop', (e) => {
  e.preventDefault();
  basketZone.classList.remove('drag-over');
  const k = e.dataTransfer.getData('text/plain');
  const el = [...document.querySelectorAll('.kw')].find(x=>x.dataset.kw===k);
  if(el) toggleKeyword(el);
});

/* Q2 무작위로 떠다니다 2초 붙잡기 / Q4 눈 마스크 따라가기 / Q5 빠르게 스쳐 날리기
   — 마우스와 카메라 커서 양쪽에서 같은 함수를 공유한다 */
let lastPointer = { x:0, y:0, t:0 };

/* Q5 — 그냥 주먹만 쥐어도 날아가던 문제: 기존엔 "바로 이전 프레임 대비 속도"만 봐서,
   손이 사실상 제자리에서 주먹을 쥘 때 카메라 인식이 미세하게 흔들리기만 해도(잔떨림) 순간
   속도가 튀어서 펀치로 오인됐다. 이제는 최근 PUNCH_WINDOW_MS 동안의 위치 기록을 남겨두고,
   그 구간의 "순 이동 거리"(시작점~지금 직선 거리)로 판정한다 — 잔떨림은 왔다갔다하며
   상쇄되지만, 진짜 펀치처럼 한 방향으로 쭉 뻗어야만 순 이동 거리가 기준을 넘는다. */
let punchHistory = []; // 최근 위치 샘플들 {x,y,t}
const PUNCH_WINDOW_MS = 140;
const PUNCH_MIN_DIST = 70; // px — 이만큼은 실제로 곧게 움직여야 "펀치"로 인정

/* Q2 — 키워드가 화면 안에서 무작위로 천천히 떠다니다가, 하나를 주먹 쥔 채로 2초 동안
   붙잡고 있으면 서서히 밝아지며(불이 켜지듯) 선택된다. 잡고 있는 동안엔 따라다니지
   않아도 되도록 그 키워드만 멈춰서, 흔들리는 카메라 인식에도 2초를 채우기 쉽게 한다.
   선택되면 그 자리에 멈춰 계속 빛나고, 다시 2초 붙잡으면 꺼지며 선택이 풀리고 다시 떠다닌다. */
let floatItems = []; // {el, x, y, vx, vy, w, h, frozen}
let floatRunning = false;
// dwellTarget: 지금 이 프레임에 실제로 붙잡고 있는 키워드(있으면) — 떠다니기 멈추는 용도로만 쓴다.
// dwellProgress: 키워드별로 얼마나 채워졌는지(ms) 누적한 값. 카메라 손 인식이 흔들려서
// 프레임 한두 번 놓쳐도 즉시 0으로 리셋되지 않고 서서히 식기만 하도록(잡을 때의 2배 속도로 감소)
// 해서, 실제 전시의 흔들리는 손 인식에서도 2초 유지가 실질적으로 가능하게 한다.
let dwellTarget = null;
let dwellProgress = new Map();
const DWELL_MS = 2000;
const DWELL_DECAY_MULT = 2; // 안 잡고 있을 때는 채우는 속도의 2배로 식는다
const FLOAT_SPEED_MIN = 10, FLOAT_SPEED_MAX = 22; // px/s — "천천히 둥둥"

function initFloatingKeywords(grid){
  const rect = grid.getBoundingClientRect();
  floatItems = [...grid.children].map(el => {
    const w = el.offsetWidth || 100, h = el.offsetHeight || 50;
    const x = Math.random() * Math.max(1, rect.width - w);
    const y = Math.random() * Math.max(1, rect.height - h);
    const angle = Math.random() * Math.PI * 2;
    const speed = FLOAT_SPEED_MIN + Math.random() * (FLOAT_SPEED_MAX - FLOAT_SPEED_MIN);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    return { el, x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, w, h, frozen: el.classList.contains('selected') };
  });
  startFloatLoop();
}

function startFloatLoop(){
  if(floatRunning) return;
  floatRunning = true;
  let last = performance.now();
  function frame(now){
    const stillOnQ2 = qIndex === 1 && document.getElementById('screen-q').classList.contains('active');
    if(!stillOnQ2){ floatRunning = false; return; } // Q2를 벗어나면 스스로 멈춘다
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const rect = document.getElementById('kwGrid').getBoundingClientRect();
    floatItems.forEach(item => {
      if(item.frozen || item.el === dwellTarget) return; // 선택돼 멈췄거나, 지금 붙잡고 있는 중이면 안 움직인다
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      const maxX = Math.max(1, rect.width - item.w);
      const maxY = Math.max(1, rect.height - item.h);
      if(item.x <= 0){ item.x = 0; item.vx = Math.abs(item.vx); }
      if(item.x >= maxX){ item.x = maxX; item.vx = -Math.abs(item.vx); }
      if(item.y <= 0){ item.y = 0; item.vy = Math.abs(item.vy); }
      if(item.y >= maxY){ item.y = maxY; item.vy = -Math.abs(item.vy); }
      item.el.style.left = item.x + 'px';
      item.el.style.top = item.y + 'px';
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// 잡고 있는 동안 서서히 밝아지는 느낌 — applyGripProgress(범용 dwellable 클릭)와 같은
// 색감(rgba(188,0,0,...) — 연지가 준 픽셀 로고/버튼의 실제 빨강 #bc0000)을 써서 사이트 전체의 "빛" 톤을 그대로 따른다.
function applyDwellGlow(el, p){
  el.style.borderColor = `rgba(188,0,0,${0.35 + p * 0.65})`;
  el.style.color = `rgba(188,0,0,${0.55 + p * 0.45})`;
  el.style.background = `rgba(188,0,0,${p * 0.12})`;
  el.style.boxShadow = `0 0 ${(p * 22).toFixed(1)}px rgba(188,0,0,${(p * 0.4).toFixed(2)})`;
}
function resetDwellGlow(el){
  if(!el) return;
  el.style.borderColor = '';
  el.style.color = '';
  el.style.background = '';
  el.style.boxShadow = '';
}

/* Q3 — 주먹을 쥔 채로 버튼 위를 붓으로 쓸듯이 지나가면 그 부분만 색이 채워진다.
   버튼을 PAINT_BINS개의 세로 칸으로 나눠서, 손이 지나간 칸만 painted 클래스를 붙인다 —
   빠르게 스치면 프레임 사이 칸을 건너뛸 수 있어서 이전 프레임 칸부터 지금 칸까지 보간해서 채운다.
   전부 채워지면 선택(확정)되고, 지우개 모드로 한 칸이라도 지우면 선택이 풀린다. */
const PAINT_BINS = 12;
let paintState = new Map(); // kw엘리먼트 -> 칸별 칠해짐 여부 배열(Array<boolean>)
let paintTarget = null; // 직전 프레임에 칠하던 키워드
let paintLastBin = -1;
let paintMode = 'brush'; // 'brush' | 'erase'

function setPaintMode(mode){
  paintMode = mode;
  const brushBtn = document.getElementById('brushTool');
  const eraseBtn = document.getElementById('eraseTool');
  if(brushBtn) brushBtn.classList.toggle('active', mode === 'brush');
  if(eraseBtn) eraseBtn.classList.toggle('active', mode === 'erase');
}

function updateQ3Paint(kw, x, held){
  const eligible = kw && (kw.classList.contains('selected') || picks[2].length < MAX_PICK);
  if(!held || !eligible){
    paintTarget = null; paintLastBin = -1;
    return;
  }
  const rect = kw.getBoundingClientRect();
  const localX = Math.max(0, Math.min(rect.width, x - rect.left));
  const bin = Math.max(0, Math.min(PAINT_BINS - 1, Math.floor(localX / rect.width * PAINT_BINS)));

  let cells = paintState.get(kw);
  if(!cells){ cells = new Array(PAINT_BINS).fill(false); paintState.set(kw, cells); }

  const from = (paintTarget === kw && paintLastBin >= 0) ? paintLastBin : bin;
  const lo = Math.min(from, bin), hi = Math.max(from, bin);
  const paint = (paintMode === 'brush');
  for(let i = lo; i <= hi; i++){
    cells[i] = paint;
    const cellEl = kw.children[i]; // paint-cell이 항상 앞쪽 자식들이라 인덱스가 그대로 칸 번호
    if(cellEl) cellEl.classList.toggle('painted', paint);
  }
  paintTarget = kw; paintLastBin = bin;

  const full = cells.every(Boolean);
  const isSelected = kw.classList.contains('selected');
  if(full && !isSelected) toggleKeyword(kw);       // 다 채워짐 — 선택 확정
  else if(!full && isSelected) toggleKeyword(kw);  // 지워져서 더 이상 안 가득 참 — 선택 해제
}

function handlePointerActivity(x, y, held){
  const onQScreen = document.getElementById('screen-q').classList.contains('active');
  if(!onQScreen){
    lastPointer = { x, y, t: performance.now() };
    dwellTarget = null;
    paintTarget = null; paintLastBin = -1;
    punchHistory = [];
    return;
  }

  if(qIndex === 3){ // Q4 — 눈 마스크가 커서를 따라간다.
    // 위치/크기를 매 프레임 kwGrid 기준으로 다시 맞춘다 — 한 번만 재보고 고정해두면
    // 폰트 로딩/레이아웃이 살짝 밀릴 때 버튼 오른쪽 끝이 마스크 밖으로 빠져나와 보일 수 있어서,
    // 여유 패딩까지 더해 버튼 영역을 항상 넉넉히 덮게 한다.
    const mask = document.getElementById('eyeMask');
    const gridRect = document.getElementById('kwGrid').getBoundingClientRect();
    const pad = 14;
    mask.style.left = (gridRect.left - pad) + 'px';
    mask.style.top = (gridRect.top - pad) + 'px';
    mask.style.width = (gridRect.width + pad * 2) + 'px';
    mask.style.height = (gridRect.height + pad * 2) + 'px';
    const localX = x - (gridRect.left - pad), localY = y - (gridRect.top - pad);
    const grad = `radial-gradient(circle 110px at ${localX}px ${localY}px, transparent 0 96px, black 118px)`;
    mask.style.webkitMaskImage = grad;
    mask.style.maskImage = grad;
  }

  const now = performance.now();
  const dt = now - lastPointer.t;

  const el = document.elementFromPoint(x, y);
  const kw = el ? el.closest('.kw') : null;

  // Q2 — 주먹을 쥔 채로 같은 키워드를 2초만큼 누적으로 붙잡고 있으면 서서히 밝아지다가 선택된다.
  // 이미 선택된 걸 다시 2초 붙잡으면 꺼지며 선택이 풀린다(취소).
  // 카메라 손 인식은 위치가 흔들려서 프레임 한두 번 정도 다른 키워드로 잠깐 튀는 게 흔한데,
  // dwellStart를 즉시 리셋하는 방식이면 그때마다 처음부터 다시 시작해서 사실상 채워지지 않았다.
  // 그래서 지금은 키워드별로 진행도(ms)를 누적해두고, 지금 안 잡고 있을 때는 리셋 대신
  // (잡을 때 채우는 속도의 2배로) 서서히 식히기만 한다 — 잠깐 놓쳐도 이어서 채울 수 있다.
  if(qIndex === 1){
    dwellTarget = null;
    const dtSafe = Math.max(0, Math.min(dt, 100)); // 탭 전환 등으로 dt가 순간적으로 커지는 것 방지
    floatItems.forEach(item => {
      const fEl = item.el;
      const eligible = fEl.classList.contains('selected') || picks[1].length < MAX_PICK;
      const isCurrent = held && kw === fEl && eligible;
      let prog = dwellProgress.get(fEl) || 0;
      if(isCurrent){
        prog = Math.min(DWELL_MS, prog + dtSafe);
        dwellTarget = fEl; // 지금 실제로 채워지고 있는 키워드 — 떠다니지 않게 멈춘다
      } else {
        prog = Math.max(0, prog - dtSafe * DWELL_DECAY_MULT);
      }
      dwellProgress.set(fEl, prog);
      const p = prog / DWELL_MS;
      if(p > 0) applyDwellGlow(fEl, p); else resetDwellGlow(fEl);
      if(p >= 1){
        toggleKeyword(fEl); // 2초 채움 — 선택 확정(또는 해제)
        dwellProgress.set(fEl, 0);
        if(fEl.classList.contains('selected')){
          applyDwellGlow(fEl, 1); // 선택되는 순간 어두워지지 않고 가장 밝은 상태 그대로 고정
        } else {
          resetDwellGlow(fEl); // 선택 해제된 거면 원래 밝기로 되돌아간다
        }
      }
    });
  }

  // Q3 — 주먹을 쥔 채로 버튼 위를 쓸어서 칠한다(브러시) / 지운다(지우개).
  if(qIndex === 2 && kw){
    updateQ3Paint(kw, x, held);
  } else if(qIndex === 2){
    paintTarget = null; paintLastBin = -1;
  }

  const settled = (now - qEnteredAt) > 400; // 질문 진입 후 0.4초는 펀치 판정 유예
  // Q5 — 반드시 주먹을 쥔 채로(held), 최근 PUNCH_WINDOW_MS 동안 한 방향으로 PUNCH_MIN_DIST 이상
  // 곧게 뻗어와야 펀치로 인식돼 날아간다. 가만히 주먹만 쥐고 있는 잔떨림은 걸리지 않는다.
  if(qIndex === 4){
    punchHistory.push({ x, y, t: now });
    punchHistory = punchHistory.filter(p => now - p.t <= PUNCH_WINDOW_MS);
    const oldest = punchHistory[0];
    const netDist = oldest ? Math.hypot(x - oldest.x, y - oldest.y) : 0;
    if(held && settled && netDist >= PUNCH_MIN_DIST && kw && !kw.classList.contains('selected') && picks[4].length < MAX_PICK){
      toggleKeyword(kw);
      punchHistory = []; // 한 번 맞춘 여세로 바로 옆 키워드까지 잇달아 맞지 않도록 기록 초기화
    }
  }

  lastPointer = { x, y, t: now };
}

// 마우스 테스트는 카메라 손동작 경로(trackHand)와 똑같이 "매 프레임" 계속 폴링해야 한다.
// mousemove 이벤트에만 의존하면, Q2처럼 "가만히 붙잡고 있기"가 필요한 인터렉션은 마우스를
// 움직이지 않는 동안 handlePointerActivity 자체가 아예 호출되지 않아서 2초를 채워도
// 진행되지 않는 것처럼 보인다(실제 전시에서 카메라는 손이 가만히 있어도 매 프레임 호출된다).
let mouseHeld = false;
let mouseX = 0, mouseY = 0;
document.addEventListener('mousedown', () => { mouseHeld = true; });
document.addEventListener('mouseup', () => { mouseHeld = false; });
document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
function pollMouse(){
  handlePointerActivity(mouseX, mouseY, mouseHeld);
  // 카메라가 켜져 있으면 카메라 쪽(trackHand)이 이미 updateTutorial을 부르고 있다 — 여기서 또
  // 부르면 두 루프가 서로 다른 값으로 같은 상태를 지워버리는 문제가 생기므로, 카메라가 꺼져
  // 있을 때(=마우스로만 테스트할 때)만 마우스 클릭(누름=주먹)으로 대신 센다.
  if(!camOn) updateTutorial(mouseHeld ? 0 : 2);
  requestAnimationFrame(pollMouse);
}
requestAnimationFrame(pollMouse);

/* Q1 전용: 주먹을 쥔 순간 그 위치의 키워드를 "집어서" 실제로 손을 따라 움직이는
   고스트 엘리먼트를 만들고, 바구니 위에서 손을 펴야(놓아야) 선택이 확정된다.
   다른 곳에서 펴면 원래 자리로 돌아가고 취소된다. */
let draggingKeyword = null;
let dragGhost = null;

function spawnGhost(sourceEl, x, y){
  sourceEl.classList.add('picked-source'); // 잡는 순간부터 원래 자리에서 숨긴다
  dragGhost = sourceEl.cloneNode(true);
  dragGhost.className = 'drag-ghost';
  document.body.appendChild(dragGhost);
  moveGhost(x, y);
}
function moveGhost(x, y){
  if(!dragGhost) return;
  dragGhost.style.left = x + 'px';
  dragGhost.style.top = y + 'px';
}
function removeGhostEl(){
  if(dragGhost){ dragGhost.remove(); dragGhost = null; }
}

// 손을 펴는(놓는) 순간 그 자리에서 바로 성공/실패를 정하지 않고, 중력으로 아래로 떨어뜨린다.
// 떨어지는 동안 바구니 영역에 한 번이라도 닿으면 그 순간 담긴 것으로 처리한다 — 정확히 바구니
// 위에서 놓지 않아도 되니, 손 인식이 흔들려도 훨씬 관대하게 성공한다.
const GRAVITY = 2600; // px/s^2
function startGravityFall(ghostEl, dropped, x0, y0){
  let x = x0, y = y0, vy = 60; // 놓는 순간 살짝 떨어지기 시작
  let last = performance.now();
  let resolved = false;

  function frame(now){
    if(resolved) return;
    const dt = Math.min(0.05, (now - last) / 1000); // 프레임 급증 방지용 클램프
    last = now;
    vy += GRAVITY * dt;
    y += vy * dt;
    ghostEl.style.left = x + 'px';
    ghostEl.style.top = y + 'px';

    const gr = ghostEl.getBoundingClientRect();
    const br = basketZone.getBoundingClientRect();
    const overlap = gr.left < br.right && gr.right > br.left && gr.top < br.bottom && gr.bottom > br.top;

    if(overlap){
      resolved = true;
      basketZone.classList.remove('drag-over');
      ghostEl.remove();
      toggleKeyword(dropped); // 선택 확정 — 떨어지다 바구니에 닿은 순간 담긴다
      return;
    }
    basketZone.classList.toggle('drag-over', false);
    if(y - gr.height/2 > window.innerHeight + 40){
      // 바구니를 못 만나고 화면 밖으로 떨어짐 — 취소, 제자리로 복귀
      resolved = true;
      basketZone.classList.remove('drag-over');
      ghostEl.remove();
      dropped.classList.remove('picked-source');
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function updateQ1Drag(x, y, fisted){
  const onQ1 = qIndex === 0 && document.getElementById('screen-q').classList.contains('active');
  if(!onQ1){
    if(draggingKeyword){
      draggingKeyword.classList.remove('picked-source'); // 화면 전환 등 강제 취소 — 제자리로 복귀
      removeGhostEl();
      draggingKeyword = null;
    }
    basketZone.classList.remove('drag-over');
    return;
  }

  const el = document.elementFromPoint(x, y);
  const overBasket = !!(el && el.closest('#basketZone'));
  const overKw = el ? el.closest('.kw') : null;

  if(!draggingKeyword){
    if(fisted && overKw && !overKw.classList.contains('selected')){
      draggingKeyword = overKw;
      spawnGhost(overKw, x, y);
    }
  } else {
    moveGhost(x, y);
    basketZone.classList.toggle('drag-over', overBasket);
    if(!fisted){
      const dropped = draggingKeyword;
      const fallingGhost = dragGhost;
      dragGhost = null; // 새 드래그를 바로 시작할 수 있도록 떼어놓는다 (떨어지는 고스트는 독립적으로 관리)
      draggingKeyword = null;
      basketZone.classList.remove('drag-over');
      if(overBasket){
        // 놓는 순간 이미 바구니 위라면 즉시 확정 (기존 동작 유지, 자연스러움)
        fallingGhost.remove();
        toggleKeyword(dropped);
      } else {
        startGravityFall(fallingGhost, dropped, x, y);
      }
    }
  }
}

loadData().catch(err => console.error('데이터 로드 실패 (data/ 폴더가 같은 위치에 있는지 확인):', err));

/* ---------- 6. 손동작(카메라) 인터렉션 ---------- */
/* 이 전시는 마우스 없이 카메라로만 조작한다. 손을 펴면 아무 것도 인식되지 않고,
   주먹을 쥐면 그 위치에서 클릭이 발생한다(손 크기로 정규화한, 손끝-손바닥 평균 거리 기반).
   커서 위치는 손가락 끝이 아니라 중지 뿌리(손바닥 중심 부근)를 따라가서 주먹을 쥐어도 커서가 튀지 않는다.
   화면에는 카메라 영상 자체는 절대 표시하지 않는다.
   (Q4의 왼손 마스크+오른손 주먹처럼 완전한 양손 인터렉션은 아직 없음 — 지금은 한 손으로 마스크 이동과
   선택을 함께 처리하는 단순화된 버전) */

const camStatus = document.getElementById('camStatus');
const cursor = document.getElementById('handCursor');
let camOn = false, video = null, landmarker = null;
let hoverTarget = null, gripFired = false;
let camStarting = false; // 로딩 중 엔터를 연타/누르고 있어도 beginCamera가 중복 실행되지 않도록
// 아래 두 값은 실측 없이 잡은 추정치라 실제로 켜보면 재조정이 필요할 수 있다.
const FIST_CLOSE = 0.7; // 이보다 오므라들면 주먹(클릭)으로 인식
const FIST_OPEN = 1.1;  // 이보다 펴져야 다음 클릭을 다시 인식 (연속 클릭 방지용 히스테리시스)

async function beginCamera(){
  if(camStarting) return;
  camStarting = true;
  camStatus.textContent = '카메라: 로딩 중…';
  try{
    await startCam();
    goto('tutorial');
  }catch(err){
    console.warn('camera interaction unavailable:', err);
    // 에러 종류에 따라 원인을 구체적으로 알려준다 (그냥 "권한을 확인해줘"만으로는 뭐가 문제인지 알기 어려워서).
    let reason = '카메라를 켤 수 없었어.';
    if(!window.isSecureContext){
      reason = '이 페이지가 안전한 연결(localhost/https)이 아니라서 카메라를 아예 요청할 수 없어. 파일을 더블클릭해서 열었다면, 로컬 서버(http://localhost:8000/...)로 열어줘야 해.';
    } else if(err && err.name === 'NotAllowedError'){
      reason = '카메라 권한이 거부돼 있어. 주소창 왼쪽 자물쇠(또는 카메라) 아이콘을 눌러 이 사이트의 카메라 권한을 "허용"으로 바꾸고 새로고침해줘. macOS 시스템 설정 > 개인정보 보호 및 보안 > 카메라에서도 이 브라우저가 켜져 있는지 확인해줘.';
    } else if(err && err.name === 'NotFoundError'){
      reason = '카메라 장치를 찾지 못했어. 카메라가 연결돼 있는지, 다른 브라우저/장치가 카메라를 점유하고 있진 않은지 확인해줘.';
    } else if(err && err.name === 'NotReadableError'){
      reason = '카메라가 이미 다른 프로그램(예: 화상회의 앱, 다른 탭)에서 사용 중이라 켤 수 없어. 다른 프로그램에서 카메라를 끄고 다시 시도해줘.';
    } else if(err){
      reason = `카메라를 켤 수 없었어 (${err.name || 'Error'}: ${err.message || err}).`;
    }
    document.getElementById('camStartSub').textContent = reason + ' 확인 후 다시 엔터를 눌러줘.';
    camStatus.textContent = '카메라: 사용 불가' + (err && err.name ? ` (${err.name})` : '');
    camOn = false;
  } finally {
    camStarting = false;
  }
}

async function startCam(){
  const { HandLandmarker, FilesetResolver } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
  );
  const filesetResolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  landmarker = await HandLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  video = document.createElement('video');
  video.style.display = 'none';
  document.body.appendChild(video);
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width:640, height:480 } });
  video.srcObject = stream;
  await video.play();

  camOn = true;
  camStatus.textContent = '카메라: 켜짐 (화면엔 영상이 나오지 않음)';
  cursor.style.display = 'block';
  requestAnimationFrame(trackHand);
}

function trackHand(){
  if(!camOn) return;
  if(video && video.readyState >= 2 && landmarker){
    const result = landmarker.detectForVideo(video, performance.now());
    if(result.landmarks && result.landmarks.length){
      const lm = result.landmarks[0];
      const cursorPoint = lm[9]; // 중지 뿌리 — 주먹을 쥐어도 위치가 크게 안 흔들림
      const wrist = lm[0];
      const fingertips = [lm[8], lm[12], lm[16], lm[20]]; // 검지·중지·약지·소지 끝
      const palm = {
        x: (lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 4,
        y: (lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 4
      };

      const x = (1 - cursorPoint.x) * window.innerWidth; // 좌우 반전(거울 모드)
      const y = cursorPoint.y * window.innerHeight;
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';

      const handScale = Math.hypot(wrist.x-cursorPoint.x, wrist.y-cursorPoint.y) || 0.1;
      const avgTipDist = fingertips.reduce((s,t)=>s+Math.hypot(t.x-palm.x, t.y-palm.y), 0) / 4;
      const openness = avgTipDist / handScale; // 작을수록 주먹

      const fisted = openness <= FIST_CLOSE;
      updateGrip(x, y, openness);
      updateQ1Drag(x, y, fisted);
      handlePointerActivity(x, y, fisted);
      updateTutorial(openness);
      camStatus.textContent = '카메라: 켜짐 · 손 인식됨';
    } else {
      cursor.classList.remove('ready');
      clearHover();
      camStatus.textContent = '카메라: 켜짐 · 손 찾는 중 (카메라 앞에 손을 크게 펴서 비춰줘)';
    }
  }
  requestAnimationFrame(trackHand);
}

function updateGrip(x, y, openness){
  const el = document.elementFromPoint(x, y);
  const target = el ? el.closest('.dwellable') : null;

  if(target !== hoverTarget){
    if(hoverTarget){ hoverTarget.classList.remove('dwell-hover'); resetGripVisual(hoverTarget); }
    hoverTarget = target;
    gripFired = false;
    if(target){ target.classList.add('dwell-hover'); cursor.classList.add('ready'); }
    else cursor.classList.remove('ready');
  }

  const progress = Math.max(0, Math.min(1, (FIST_OPEN - openness) / (FIST_OPEN - FIST_CLOSE)));
  if(hoverTarget) applyGripProgress(hoverTarget, progress);
  else applyCursorGlow(progress);

  if(hoverTarget && openness <= FIST_CLOSE && !gripFired){
    gripFired = true;
    hoverTarget.click();
  }
  if(openness >= FIST_OPEN){
    gripFired = false;
  }
}

function applyGripProgress(target, p){
  applyCursorGlow(p);
  target.style.borderColor = `rgba(188,0,0,${0.35 + p * 0.65})`;
  target.style.background = `rgba(188,0,0,${p * 0.12})`;
}
function applyCursorGlow(p){
  const scale = 1 + p * 0.7;
  cursor.style.transform = `translate(-50%,-50%) scale(${scale})`;
  cursor.style.background = `rgba(188,0,0,${0.12 + p * 0.68})`;
  cursor.style.borderColor = `rgba(188,0,0,${0.5 + p * 0.5})`;
}

function resetGripVisual(target){
  if(!target) return;
  target.style.borderColor = '';
  target.style.background = '';
  cursor.style.transform = 'translate(-50%,-50%) scale(1)';
  cursor.style.background = '';
  cursor.style.borderColor = '';
}

function clearHover(){
  if(hoverTarget){
    hoverTarget.classList.remove('dwell-hover');
    resetGripVisual(hoverTarget);
  }
  hoverTarget = null; gripFired = false;
}
