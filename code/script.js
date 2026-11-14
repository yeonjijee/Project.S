/* Project.S 리디자인 — 카메라 켜기 → 손동작 안내 → Opening → Q1~Q5(키워드) → Q6(주관식) → 결과
   전시 환경은 마우스 없이 카메라(손동작)만 사용한다. 마우스/클릭 코드는 개발 중 테스트 편의용으로 남겨둠. */

/* ---------- 1. 후보 레인저 모자이크 (중앙 이미지) ---------- */
/* 실제 사진이 있는 레인저는 data/hero-images.json에 등록된 이미지를 소스로, 아직 사진이 없는
   레인저는 기존처럼 컬러 블록을 소스로 모자이크를 그린다. (310명 중 303명 사진 연결됨 — 나머지 7명은
   해당 시리즈 사진 자체가 폴더에 없어서 자동으로 컬러 블록 fallback을 쓴다.)
   manifest 값은 보통 문자열 하나(사진 한 장)지만, "루팡 X & 패트렌 X"처럼 콤보 캐릭터는 배열로
   등록해서 여러 장을 한 캔버스에 나란히 동시에 그린다. */
const COLOR_MAP = {
  "레드":"#a70000","스카이블루":"#6bb3d6","네이비":"#24395c","블루":"#3a6fb0","옐로":"#d9a72c","그린":"#4a8f5c","핑크":"#c9698f",
  "블랙":"#3a3a3d","화이트":"#d8d5cb","골드":"#c9a24b","실버":"#9a9a9d","오렌지":"#d9722c",
  "바이올렛":"#7a5aa8","시안":"#4ab0c9","그레이":"#7d7d7f","브라운":"#8a6a4a"
};
// 오프닝 화면 컬러 그리드 — 연지가 지정한 순서 그대로. rangers.json의 실제 color 필드 값과
// 정확히 일치하는지 python으로 직접 확인함(레드50/오렌지6/옐로45/그린29/스카이블루1/블루50/
// 블랙27/실버13/골드12/화이트16/브라운1/네이비2 — 전부 0명은 없음).
const ID_COLORS = ["레드","오렌지","옐로","그린","스카이블루","블루","브라운","실버","골드","네이비","화이트","블랙"]; // 시안(3ID_01) 3×4 순서
// 이름 짓기 화면 색 칸 전용 색 — 시안에서 직접 뽑은 값 (레인저 데이터 색 COLOR_MAP과는 별개)
const SWATCH_COLORS = {
  "레드":"#a70000","오렌지":"#cf711b","옐로":"#e2c536","그린":"#39a935","스카이블루":"#3798b9","블루":"#1c1991",
  "브라운":"#4a2c11","실버":"#898986","골드":"#907a1d","네이비":"#17172c","화이트":"#e2e2dc","블랙":"#000000"
};
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
// 이미지·데이터는 전부 project_S/files/ 에 있다 (code/ 기준 상대경로)
const FILES = '../files/';
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
      img.src = FILES + p + (p.includes('?') ? '&' : '?') + 'v=' + CACHE_BUST;
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
  // 배경은 칠하지 않는다(투명) — Q4처럼 어두운 화면 위에서도 레인저만 보이게
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
  const m = new MosaicRenderer(canvasEl, mosaicSourceFor(ranger), { minCell: 3 * scale, maxCell: 30 * scale, bg: 'transparent' });
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
  camstart:'screen-camstart', tutorial:'screen-tutorial', open:'screen-open', story:'screen-story',
  q:'screen-q', q6:'screen-q6', loading:'screen-loading', result:'screen-result'
};
// 카메라 손 커서를 문항별 도구 그래픽으로 바꾼다 (Q2 집게 / Q4 야광봉 / Q5 주먹). 그 외 화면은 기본 원형 커서.
function updateCursorMode(){
  const onQ = document.getElementById('screen-q').classList.contains('active');
  let cur = '';
  if(onQ){
    if(qIndex === 1) cur = '';   // Page 2 — 집게 그림 없이 손(기본 커서) 그대로
    else if(qIndex === 2) cur = paintMode === 'erase' ? 'eraser' : paintMode === 'brush' ? 'pen' : '';
    else if(qIndex === 3) cur = 'glow';
    else if(qIndex === 4) cur = 'fist';
  }
  document.body.dataset.cur = cur;
}
/* 화면별 배경 — 피그마 프레임 기준: 하늘색(오프닝→튜토리얼에서 구름이 위→아래로 흐름) / 노을색(이름 짓기·시작 스토리) /
   연분홍(질문·결과). bgy = 구름 이미지의 세로 위치(0% 위쪽 구름 ~ 100% 아래쪽 구름). */
const BG_BY_SCREEN = {
  camstart:['sky','0%'], tutorial:['sky','99%'], open:['peach','100%'], story:['peach','100%'],
  q:['page','100%'], q6:['page','100%'], loading:['page','100%'], result:['page','100%']
};
function setBackground(kind, y){
  document.body.dataset.bg = kind;
  const layer = document.getElementById('bgLayer');
  if(!layer) return; // 배경 레이어를 HTML에서 지웠을 때도 멈추지 않도록
  layer.style.setProperty('--bgy', y);
  layer.style.setProperty('--bgf', parseFloat(y)/100); // 숫자 버전(자산 40 위치 계산용)
}
setBackground('sky','0%'); // 첫 화면(오프닝)도 하늘색으로 시작 — goto()가 불리기 전이라 따로 지정
function goto(name){
  Object.values(screens).forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById(screens[name]).classList.add('active');
  const bg = BG_BY_SCREEN[name]; if(bg) setBackground(bg[0], bg[1]);
  updateCursorMode();
  const fab = document.getElementById('resetFab');
  if(fab) fab.style.display = (name === 'q' || name === 'q6') ? 'block' : 'none';
  if(fab) fab.classList.toggle('on-q6', name === 'q6');   // Page 6은 RE가 왼쪽 정보 칸 안  // 피그마: RE 버튼은 질문 페이지(Page 1~6)에만
  if(name === 'tutorial'){
    resetTutorial();
  }
  if(name === 'story'){
    runStory();
  }
  clearTimeout(openTitleTimer);
  if(name === 'open'){
    refreshStartBtn();
    if(selectedColor && nicknameInput.value.trim()){
      setOpenStep(3);   // 이전 질문에서 돌아온 경우 — 이미 다 정했으니 이름 칸으로
    } else {
      resetOpenPreview(); // 컬러를 고르기 전까지는 무채색 미리보기
      setOpenStep(1);     // 1 제목 → 잠깐 뒤 2 색 고르기
      openTitleTimer = setTimeout(() => { setOpenStep(2); typeSound.whoosh(); }, OPEN_TITLE_MS);
    }
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

// 시안(2tutorial_01/02)의 줄바꿈 그대로
const TUT_CAPTIONS = {
  open: '손을 편<br>상태로는<br>아무 일도<br>일어나지<br>않습니다.',
  fist: '주먹을<br>쥐면<br>무언가를<br>선택할 수<br>있습니다.'
};
function setTutorialCaption(key){
  const el = document.getElementById('tutorialCaption');
  if(el.dataset.key !== key){ el.dataset.key = key; el.innerHTML = TUT_CAPTIONS[key]; }
}
function resetTutorial(){
  tutorialReps = 0;
  tutorialArmed = true;
  tutorialOpenSince = 0;
  const tscr = document.getElementById('screen-tutorial');
  tscr.classList.remove('finished', 'fisted');
  tscr.dataset.step = 0;   // 배경 TUTORIAL 가로 비율 단계(0~3) — design.css --tut-sx-0~3
  document.getElementById('iconHandOpen').style.display = 'block';
  document.getElementById('iconFist').style.display = 'none';
  setTutorialCaption('open');
  document.getElementById('tutorialNextBtn').classList.remove('visible');
  updateTutorialProgress();
}

// 주먹 아이콘 3개 중 쥔 횟수만큼 빨갛게 채운다
function updateTutorialProgress(){
  document.querySelectorAll('#tutorialProgress i').forEach((el, i) => el.classList.toggle('on', i < tutorialReps));
}

// openness: trackHand가 계산하는 "얼마나 편 손인가" 값 그대로 받는다(작을수록 주먹).
// 카메라가 켜져 있는 동안은 카메라 값만 이 함수를 부른다 — 마우스 폴링 루프(pollMouse)와
// 카메라 루프(trackHand)가 매 프레임 각자 다른 값으로 이 함수를 동시에 부르면, 마우스를 안
// 건드리고 있어도 그 "false" 호출이 카메라가 방금 감지한 "주먹 쥠"을 끼어들어 지워버려서 —
// 카메라가 켜진 동안은 카메라만, 꺼져 있을 때(마우스로만 테스트할 때)는 마우스만 부르게 했다.
function updateTutorial(openness){
  const scr = document.getElementById('screen-tutorial');
  if(!scr.classList.contains('active') || scr.classList.contains('finished')) return;
  const fisted = openness <= FIST_CLOSE;
  const now = performance.now();

  document.getElementById('iconHandOpen').style.display = fisted ? 'none' : 'block';
  document.getElementById('iconFist').style.display = fisted ? 'block' : 'none';
  scr.classList.toggle('fisted', fisted);   // 주먹 쥔 동안 텍스트 박스 노랑

  if(fisted){
    tutorialOpenSince = 0;
    if(tutorialArmed){
      tutorialReps++;
      tutorialArmed = false; // 다시 일정 시간 펴기 전까지는 같은 쥠을 또 세지 않는다
      updateTutorialProgress();
      scr.dataset.step = Math.min(tutorialReps, TUTORIAL_REPS_NEEDED); // TUTORIAL 글자가 한 단계 넓어진다
      typeSound.whoosh(SOUND_TUT_STRETCH, 'tutorial');                   // 늘어나는 동안 부드러운 '스윽'
      if(tutorialReps >= TUTORIAL_REPS_NEEDED){
        // 3번 채우면 "이제 좀 익숙해지셨나요??" + NEXT. 바로 넘기지 않고 버튼으로 확인한다.
        setTimeout(() => {
          scr.classList.add('finished');
          typeSound.clack('next', 0.4);   // 달칵 — TUTORIAL이 꽉 차고 NEXT 등장 (NEXT가 오른쪽이라 소리도 살짝 오른쪽)
          scr.classList.remove('fisted');
          document.getElementById('tutorialNextBtn').classList.add('visible');
        }, 600);
      }
    }
    setTutorialCaption('fist');
  } else {
    setTutorialCaption('open');
    if(!tutorialOpenSince) tutorialOpenSince = now;
    if(now - tutorialOpenSince >= TUTORIAL_REARM_MS) tutorialArmed = true;
  }
}

/* 시작 스토리 (시안 4_01 → 4_02 → 4_03)
   A: 두 단락이 좌상단부터 차례로 타이핑(단락마다 STORY_PARA_MS)
   B: 화면을 꽉 채운 세 줄이 한 글자씩 튀어나오며 타이핑
   C: 세 줄이 위로 납작하게 줄어들고, "진짜진짜 시작" + NEXT가 오른쪽에서 밀려 나옴 */
const STORY_P1_MS = 500;      // A 첫 단락(갑자기 웬 히어로냐구요?) 타이핑 시간
const STORY_P1_PAUSE = 500;   // 첫 단락 다 나온 뒤 두 번째 단락까지 쉬는 시간
const STORY_PARA_MS = 2000;   // A 두 번째 단락(가끔~없나요?) 타이핑 시간
const STORY_B_MS = 2000;      // B 세 줄 전체 타이핑 시간
const STORY_HOLD_A = 600;     // A 다 쳐진 뒤(없나요?) 다음 멘트까지 머무는 시간
const STORY_HOLD_B = 900;     // B 다 쳐진 뒤 줄어들기 전까지
const STORY_SHRINK_MS = 700;  // 위로 줄어드는 시간 (style.css와 같게)
let storyTimers = [];
let storyTimer = null; // (예전 코드 호환)
function storyLater(fn, ms){ storyTimers.push(setTimeout(fn, ms)); }
function clearStoryTimers(){ storyTimers.forEach(clearTimeout); storyTimers = []; }

// HTML 단락 → 글자마다 span (줄바꿈은 \n)
function buildTypePara(el){
  if(el.dataset.built) return [...el.querySelectorAll('.ch')];
  const text = el.dataset.text.replace(/\\n/g, '\n');
  el.innerHTML = '';
  const chars = [];
  for(const c of text){
    if(c === '\n'){ el.appendChild(document.createElement('br')); continue; }
    const s = document.createElement('span'); s.className = 'ch'; s.textContent = c;
    el.appendChild(s); if(c !== ' ') chars.push(s);
  }
  el.dataset.built = 1;
  return chars;
}
// SVG 한 줄 → 글자마다 <text>. viewBox를 실제 글자 잉크 영역으로 잡아서 박스에 꽉 맞게 늘어난다
const storyMeasure = document.createElement('canvas').getContext('2d');
function buildStretchLine(svg){
  if(svg.dataset.built) return [...svg.querySelectorAll('.ch')];
  const text = svg.dataset.text;
  storyMeasure.font = '1000px AGSuperBlack';
  const m = storyMeasure.measureText(text);
  const x0 = -m.actualBoundingBoxLeft, x1 = m.actualBoundingBoxRight;
  const y0 = -m.actualBoundingBoxAscent, y1 = m.actualBoundingBoxDescent;
  svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
  const NS = 'http://www.w3.org/2000/svg';
  const chars = [];
  [...text].forEach((c, i) => {
    if(c === ' ') return;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', storyMeasure.measureText(text.slice(0, i)).width); // 앞 글자들 폭 = 이 글자 위치(커닝 포함)
    t.setAttribute('y', 0); t.setAttribute('font-size', 1000);
    t.setAttribute('class', 'ch'); t.textContent = c;
    svg.appendChild(t); chars.push(t);
  });
  svg.dataset.built = 1;
  return chars;
}
function typeChars(chars, ms, done, sound = 'key'){
  const step = ms / Math.max(1, chars.length);
  chars.forEach((c, i) => storyLater(() => { c.classList.add('on'); typeSound.click(sound); }, Math.round(step * i)));
  if(done) storyLater(done, ms);
}

/* 타이핑 소리 — 파일 없이 Web Audio로 직접 만든다(짧은 잡음을 필터로 깎아서 '탁' 소리).
   글자마다 높이·세기를 조금씩 바꿔서 기계음처럼 똑같이 반복되지 않게 '타다다닥'.
   'key' = 작은 문장(A), 'stamp' = 화면을 꽉 채운 세 줄(B) — 더 낮고 묵직하게 '탕'.
   브라우저는 사용자가 키/클릭을 한 번 하기 전엔 소리를 막으므로, 첫 화면 Enter 때 소리를 깨워둔다. */
const MASTER_VOL = 1.0;       // 모든 효과음 마지막 볼륨 (전부 같이 키우고 줄일 때 이것만)
const TYPE_SOUND_VOL = 0.5;   // 효과음 기본 세기 (0~1)
// 효과음 켜고 끄기 — 합 보고 별로면 false로 바꾸면 그 소리만 꺼진다
const SOUND_CLACK = true;     // NEXT 누를 때 '달칵'
const SOUND_SPARKLE = false;  // '뾰로롱' — 꺼둠 (튜토리얼 끝은 달칵만)   // 전환점이 나올 때 '뾰로롱' (튜토리얼: TUTORIAL이 꽉 차고 NEXT 등장)
const SOUND_SLIDE = true;     // 화면 전체가 움직일 때 '슈욱' — 화면이 밀려 들어올 때 / Page N이 대각선으로 들어올 때 / 스토리 세 줄이 위로 줄어들며 '진짜진짜 시작'이 밀려 나올 때
const SOUND_TUT_STRETCH = true; // 튜토리얼에서 주먹 쥘 때마다 TUTORIAL 글자가 가로로 늘어나며 '슈욱'. 별로면 false
// 헤드셋용 공간감 — 튜토리얼 '스윽'의 좌우 메아리 / 달칵의 좌우 위치
const ECHO_TIME = 0.16;       // 메아리 간격(초) — 왼쪽·오른쪽 귀를 이 간격으로 번갈아
const ECHO_FEEDBACK = 0.42;   // 메아리가 얼마나 오래 남는지 (0~0.8, 클수록 길게)
const ECHO_MIX = 0.55;        // 메아리 크기 (원래 소리 대비)
const ECHO_TONE = 1600;       // 메아리 음색(Hz) — 낮출수록 더 멀고 먹먹하게
const CLACK_PAN = 0.55;       // 달칵이 누른 버튼 쪽 귀로 치우치는 정도 (0 = 가운데, 1 = 완전히 한쪽)
const SOUND_PEN = true;       // Page 3 칠할 때 만년필 '슥슥' (지우개는 더 낮고 둔하게)
const PEN_VOL = 0.9;          // 펜 소리 크기 (0~1)
const PEN_TOP = 3600;         // 펜 소리에서 남길 가장 높은 소리(Hz) — 낮출수록 덜 날카롭게
const PEN_FULL_SPEED = 1.2;   // 이 속도(1초에 화면 폭의 120%)로 칠하면 펜 소리가 최대
// 손(커서)을 움직일 때 나는 소리
//   'sentai' = 특촬 변신 느낌 — 휘두르면 '위이잉~' 에너지가 차오르고, 세게 휘두르면 '챙!'
//   'hum'    = 우웅 하는 전자 공간음 / 'rustle' = 먹먹한 사각사각 / 'off' = 없음
const CURSOR_SOUND = 'mecha';
// 'mecha' = 합체 메카 — 낮은 바람 + 엔진 우웅 + 묘한 전자음이 손 속도만큼 살살, 멈추면 MECHA_SUSTAIN초에 걸쳐 잦아듦.
//           (주먹 쥘 때 '위잉-철컥'은 MECHA_MOTOR로 켜고 끔)
const MECHA_VOL = 0.45;       // 바람·엔진·전자음 전체 크기 (0~1) — 살살 깔리는 정도
const MECHA_MOTOR = false;    // 주먹 쥘 때 '위잉-철컥' — 꺼둠 (true로 켜면 다시 남)
const MECHA_MOTOR_VOL = 0.4;  // 위잉-철컥 크기 (0~1)
const MECHA_SUSTAIN = 1.2;    // 손이 멈춘 뒤 바람·엔진·전자음이 서서히 사라지는 시간(초) — 늘리면 더 길게 남음
const SENTAI_VOL = 0.3;       // 위이잉 소리 크기 (0~1)
const SENTAI_SHING = true;    // 세게 휘두를 때 '챙!' 켜기
const SENTAI_SHING_AT = 0.7;  // 이 세기(0~1)를 넘는 순간 '챙!' — 낮추면 더 자주
const HUM_VOL = 0.35;          // 우웅 소리 최대 볼륨 (0~1)
const HUM_PITCH = 98;         // 우웅 기본 높이(Hz) — 낮출수록 더 낮고 묵직하게 (55 = 아주 낮음, 110 = 조금 높음)
const SOUND_RUSTLE = true;    // 'rustle'을 골랐을 때 사각 소리 켜기
const RUSTLE_VOL = 0.18;      // 사각 소리 최대 볼륨 (0~1, 전체 볼륨 TYPE_SOUND_VOL에 곱해짐)
const RUSTLE_TOP = 2600;      // 사각 소리에서 남길 가장 높은 소리(Hz) — 낮출수록 더 먹먹하게 (900 이하면 노트북 스피커에선 거의 안 들림)
const typeSound = (() => {
  let ctx = null, noise = null, out = null;
  function ensure(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    // 마스터: 전체 볼륨 → 컴프레서(갑자기 큰 소리가 겹쳐도 찢어지지 않게) → 스피커
    const master = ctx.createGain(); master.gain.value = MASTER_VOL;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
    master.connect(comp).connect(ctx.destination);
    out = master;
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function unlock(){ const c = ensure(); if(c && c.state === 'suspended') c.resume(); }
  function click(kind){
    if(!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const heavy = kind === 'stamp';
    const vol = TYPE_SOUND_VOL * (heavy ? 0.9 : 0.55) * (0.8 + Math.random() * 0.4);
    const len = heavy ? 0.075 : 0.035;
    // 잡음 '탁'
    const src = ctx.createBufferSource(); src.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = heavy ? 900 + Math.random() * 400 : 1800 + Math.random() * 1600;
    bp.Q.value = heavy ? 0.9 : 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp).connect(g).connect(out);
    src.start(t, Math.random() * 0.05, len + 0.01);
    // 묵직한 쪽은 아래에 짧은 '둥'을 깔아서 도장 찍는 느낌
    if(heavy){
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.08);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(og).connect(out); o.start(t); o.stop(t + 0.12);
    }
  }
  /* '달칵' — 버튼 종류마다 조금씩 다르게. [딸깍 사이 간격(초), 첫 딸깍 높이, 둘째 딸깍 높이, 울림 길이, 몸통 '톡' 높이]
     next   : 무겁고 확실한 '달-칵' (NEXT 화살표)
     select : 가볍고 높은 '딸깍' (색 칸·키워드 고르기)
     nav    : 짧고 건조한 '탁' 한 번에 가까움 (HERO LIST·ARCHIVE·이전 질문 등 글자 버튼)
     tool   : 플라스틱 '똑딱' (펜·지우개 같은 도구)
     reset  : 낮고 둔한 '덜컥' (RE)
     start  : 가장 크고 단단한 '철컥' (첫 화면 시작) */
  const CLACK_TYPES = {
    next:   [0.045, 2600, 1500, 0.035, 320],
    select: [0.025, 4200, 3000, 0.022, 0],
    nav:    [0.012, 3200, 2400, 0.020, 0],
    tool:   [0.035, 1900, 2800, 0.028, 520],
    reset:  [0.060, 1300,  800, 0.045, 180],
    start:  [0.050, 2200, 1100, 0.050, 140],
  };
  let lastClack = 0;
  function clack(type = 'next', pan = 0){
    if(!SOUND_CLACK || !ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    if(t0 - lastClack < 0.05) return;   // 같은 누름에서 두 번 나지 않게
    lastClack = t0;
    const [gap, f1, f2, len, body] = CLACK_TYPES[type] || CLACK_TYPES.next;
    const vol = TYPE_SOUND_VOL * 1.6;
    [[0, f1, 0.7], [gap, f2, 1]].forEach(([dt, f, v]) => {
      const t = t0 + dt;
      const src = ctx.createBufferSource(); src.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (0.95 + Math.random() * 0.1); bp.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * v, t + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      // 누른 버튼이 있는 쪽 귀에서 들리게 (헤드셋에서 바로 옆에서 누른 듯한 느낌)
      let node = src.connect(bp).connect(g);
      if(pan && ctx.createStereoPanner){ const pn = ctx.createStereoPanner(); pn.pan.value = pan; node = node.connect(pn); }
      node.connect(out);
      src.start(t, Math.random() * 0.05, len + 0.01);
    });
    if(body){   // 버튼 몸통이 울리는 짧은 '톡'
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(body, t0 + gap);
      o.frequency.exponentialRampToValueAtTime(body * 0.6, t0 + gap + 0.05);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t0 + gap);
      og.gain.exponentialRampToValueAtTime(vol * 0.5, t0 + gap + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + gap + 0.06);
      let on = o.connect(og);
      if(pan && ctx.createStereoPanner){ const pn = ctx.createStereoPanner(); pn.pan.value = pan; on = on.connect(pn); }
      on.connect(out); o.start(t0 + gap); o.stop(t0 + gap + 0.08);
    }
  }
  // '뾰로롱' — 위로 올라가는 짧은 4음 (도-미-솔-도)
  function sparkle(){
    if(!SOUND_SPARKLE || !ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
      const t = t0 + i * 0.055;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(TYPE_SOUND_VOL * 0.35, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.2);
    });
  }
  // '슈욱' — 화면 전환용. 잡음이 높은 쪽에서 낮은 쪽으로 쓸려 내려가는 바람 소리
  let lastWhoosh = 0;
  /* 슈욱 — opts로 모양을 바꾼다
     len: 길이(초) / f0→f1: 소리 높이가 이동하는 범위(Hz) / peak: 가장 커지는 지점(0~1, 모션이 가장 빠른 순간에 맞춤)
     soft: true면 고음을 저역 필터로 잘라내서 종이에 '스윽' 쓰는 듯한 부드러운 소리 */
  const WHOOSH = {
    slide:   { len: 0.45, f0: 3200, f1: 400, peak: 0.27, soft: false, vol: 1.8 },  // 화면이 밀려 들어옴 / Page N 날아옴
    // TUTORIAL 늘어남 — 원래 소리(0.7초, 처음에 빠르고 끝에 느려짐) 그대로, 높은음만 내림 (f0 1500→900, f1 500→320)
    tutorial:{ len: 0.70, f0: 900, f1: 320, peak: 0.14, soft: true,  vol: 2.2 },
    story:   { len: 0.70, f0: 1300, f1: 450, peak: 0.50, soft: true,  vol: 2.2 },  // 세 줄이 위로 줄어듦 — 천천히 시작해서 가운데가 가장 빠른 모션
  };
  function whoosh(on = SOUND_SLIDE, kind = 'slide'){
    if(!on || !ctx || ctx.state !== 'running') return;
    const o = WHOOSH[kind] || WHOOSH.slide;
    const t = ctx.currentTime, len = o.len;
    if(t - lastWhoosh < 0.6) return;   // 화면 이동이 연달아 겹칠 땐 한 번만
    lastWhoosh = t;
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.soft ? 'lowpass' : 'bandpass'; f.Q.value = o.soft ? 0.9 : 1.2;
    f.frequency.setValueAtTime(o.f0, t); f.frequency.exponentialRampToValueAtTime(o.f1, t + len);
    let last = f;
    if(o.soft){   // 한 번 더 깎아서 높은 '쉭' 성분 제거
      const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.f0 * 1.2; f2.Q.value = 0.6;
      f.connect(f2); last = f2;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(TYPE_SOUND_VOL * o.vol, t + len * o.peak);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f); last.connect(g);
    let dest = g;
    if(o.pan && ctx.createStereoPanner){   // 소리가 글자가 늘어나는 방향(왼→오)으로 귀 사이를 지나간다
      const pn = ctx.createStereoPanner();
      pn.pan.setValueAtTime(o.pan[0], t);
      pn.pan.linearRampToValueAtTime(o.pan[1], t + len);
      g.connect(pn); dest = pn;
    }
    dest.connect(out);
    if(o.echo) pingPong(dest, t, len);
    src.start(t); src.stop(t + len + 0.02);
  }
  /* 메아리 — 왼쪽·오른쪽 귀를 번갈아 오가며 점점 작아지고 먹먹해지는 되울림 (ECHO_* 숫자로 조절) */
  function pingPong(input, t, len){
    const merger = ctx.createChannelMerger(2);
    const dl = ctx.createDelay(1), dr = ctx.createDelay(1);
    dl.delayTime.value = ECHO_TIME; dr.delayTime.value = ECHO_TIME;
    const fb = ctx.createGain(); fb.gain.value = ECHO_FEEDBACK;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = ECHO_TONE;   // 되울릴수록 고음이 빠져 멀어지는 느낌
    const send = ctx.createGain(); send.gain.value = ECHO_MIX;
    const mono = ctx.createGain(); mono.channelCount = 1; mono.channelCountMode = 'explicit';
    input.connect(send).connect(mono).connect(tone).connect(dl);
    dl.connect(dr); dr.connect(fb).connect(dl);              // 왼 → 오 → 왼 … 반복
    dl.connect(merger, 0, 0); dr.connect(merger, 0, 1);
    merger.connect(out);
    // 다 울리고 나면 연결을 끊어 쌓이지 않게
    setTimeout(() => { try{ send.disconnect(); merger.disconnect(); fb.disconnect(); }catch(e){} }, (len + ECHO_TIME * 14) * 1000);
  }
  /* '사각사각' (먹먹하게) — 고음은 전부 잘라내고 낮은 쪽만 남겨서, 천 너머로 들리는 듯한 '스윽스윽'.
     ① 바닥: 계속 깔린 낮은 잡음. 커서가 빠를수록 커지고 살짝 열린다(그래도 최대 RUSTLE_TOP Hz까지만).
     ② 알갱이: 짧은 '툭' 소리를 움직인 양만큼 무작위로 — 높이도 낮게, 시작도 부드럽게.
     둘 다 마지막에 저역 필터(RUSTLE_TOP)를 한 번 더 지나서 하이톤이 새지 않는다. 멈추면 0.1초 안에 사라진다. */
  let rBed = null, rBedGain = null, rBedFilter = null, rOut = null;
  function rustle(amount, dt){
    if(CURSOR_SOUND !== 'rustle' || !SOUND_RUSTLE || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    if(!rBed){
      rOut = ctx.createBiquadFilter(); rOut.type = 'lowpass'; rOut.frequency.value = RUSTLE_TOP; rOut.Q.value = 0.5;
      const rOut2 = ctx.createBiquadFilter(); rOut2.type = 'lowpass'; rOut2.frequency.value = RUSTLE_TOP * 1.3; rOut2.Q.value = 0.5; // 두 번 걸어서 더 확실히 먹먹하게
      rOut.connect(rOut2).connect(out);
      rBed = ctx.createBufferSource(); rBed.buffer = noise; rBed.loop = true;
      rBedFilter = ctx.createBiquadFilter(); rBedFilter.type = 'lowpass'; rBedFilter.Q.value = 0.6; rBedFilter.frequency.value = 800;
      rBedGain = ctx.createGain(); rBedGain.gain.value = 0;
      rBed.connect(rBedFilter).connect(rBedGain).connect(rOut); rBed.start();
    }
    const vol = TYPE_SOUND_VOL * RUSTLE_VOL;
    // ① 바닥
    const bed = amount <= 0 ? 0 : vol * 2.2 * Math.pow(amount, 0.7) * (0.6 + Math.random() * 0.8);
    rBedGain.gain.setTargetAtTime(bed, t, amount <= 0 ? 0.05 : 0.02);
    rBedFilter.frequency.setTargetAtTime(700 + amount * (RUSTLE_TOP - 700) + Math.random() * 120, t, 0.04);
    // ② 알갱이
    if(amount <= 0.02) return;
    let n = amount * 220 * dt;                     // 초당 최대 약 220알
    while(n > 0){
      if(n < 1 && Math.random() > n) break;
      n -= 1;
      const at = t + Math.random() * dt;
      const len = 0.012 + Math.random() * 0.025;
      const src = ctx.createBufferSource(); src.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 500 + Math.random() * 1100; bp.Q.value = 1.5 + Math.random() * 2;
      const g = ctx.createGain();
      const peak = vol * (1.5 + Math.random() * 2.5) * (0.5 + amount * 0.5);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + 0.004);   // 부드러운 시작 — '틱'이 아니라 '툭'
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      src.connect(bp).connect(g).connect(rOut);
      src.start(at, Math.random() * 0.08, len + 0.005);
    }
  }
  /* '우웅' — 전자 공간음
     · 음: 살짝 어긋난 높이의 톱니파 2개(서로 맥놀이 → 우웅우웅 흔들림) + 한 옥타브 아래 사인파(묵직한 바닥)
     · 움직임이 빠를수록: 소리가 커지고, 저역 필터가 열려 밝아지고, 높이가 조금 올라간다(최대 +5도)
     · 공간감: 손의 좌우 위치에 따라 왼쪽/오른쪽 스피커로 이동 + 메아리(딜레이) + 넓은 울림(리버브)
     · 멈추면 0.5초에 걸쳐 스르륵 사라진다 */
  let hum = null;
  function buildHum(){
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth';
    const sub = ctx.createOscillator(); sub.type = 'sine';
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35;     // 아주 느린 흔들림
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 6;            // 필터를 ±6Hz 흔들어서 살아 있는 느낌
    const mix = ctx.createGain(); mix.gain.value = 0.5;
    const subG = ctx.createGain(); subG.gain.value = 0.8;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 6;  // 공명을 살짝 줘서 '우웅'
    lfo.connect(lfoAmt).connect(lp.frequency);
    const amp = ctx.createGain(); amp.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o1.connect(mix); o2.connect(mix); mix.connect(lp); sub.connect(subG).connect(lp);
    lp.connect(amp);
    const dry = pan ? (amp.connect(pan), pan) : amp;
    // 메아리 — 0.33초 간격, 점점 작아지며 3~4번
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.33;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1200;
    delay.connect(dlp).connect(fb).connect(delay);
    const wetD = ctx.createGain(); wetD.gain.value = 0.45;
    dry.connect(delay); dlp.connect(wetD);
    // 리버브 — 2.5초짜리 잡음 울림을 만들어서 넓은 공간처럼
    const len = Math.floor(ctx.sampleRate * 2.5), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for(let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wetR = ctx.createGain(); wetR.gain.value = 0.55;
    dry.connect(verb).connect(wetR);
    const bus = ctx.createGain(); bus.gain.value = 1;
    dry.connect(bus); wetD.connect(bus); wetR.connect(bus); bus.connect(out);
    [o1, o2, sub, lfo].forEach(o => o.start());
    return { o1, o2, sub, lp, amp, pan };
  }
  function humUpdate(amount, xNorm){
    if(CURSOR_SOUND !== 'hum' || !ctx || ctx.state !== 'running') return;
    if(!hum) hum = buildHum();
    const t = ctx.currentTime;
    const f = HUM_PITCH * Math.pow(2, (amount * 7) / 12);              // 빠를수록 최대 +7반음(5도) 올라감
    hum.o1.frequency.setTargetAtTime(f, t, 0.15);
    hum.o2.frequency.setTargetAtTime(f * 1.006, t, 0.15);             // 살짝 어긋나서 맥놀이
    hum.sub.frequency.setTargetAtTime(f / 2, t, 0.15);
    hum.lp.frequency.setTargetAtTime(420 + amount * 1400, t, 0.12);     // 빠를수록 밝게 열림 (420Hz 아래로 닫으면 노트북 스피커에선 안 들림)
    const g = amount <= 0 ? 0 : TYPE_SOUND_VOL * HUM_VOL * (0.25 + 0.75 * Math.pow(amount, 0.7));
    hum.amp.gain.setTargetAtTime(g, t, amount > 0 ? 0.08 : 0.18);     // 들어올 땐 0.08초, 사라질 땐 천천히
    if(hum.pan && xNorm != null) hum.pan.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, xNorm * 2 - 1)), t, 0.1);
  }
  /* 공간 — 메아리(0.28초 간격) + 넓은 울림. 소리를 넣으면 원음+공간이 같이 나간다 */
  let spaceIn = null;
  function space(){
    if(spaceIn) return spaceIn;
    spaceIn = ctx.createGain();
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.28;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2500;
    delay.connect(dlp).connect(fb).connect(delay);
    const wetD = ctx.createGain(); wetD.gain.value = 0.35;
    spaceIn.connect(delay); dlp.connect(wetD).connect(out);
    const len = Math.floor(ctx.sampleRate * 2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for(let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wetR = ctx.createGain(); wetR.gain.value = 0.4;
    spaceIn.connect(verb).connect(wetR).connect(out);
    spaceIn.connect(out);
    return spaceIn;
  }

  /* '위이잉~' — 특촬 변신·에너지 충전 느낌 (80~90년대 신시사이저 톤)
     · 각진 사각파 + 한 옥타브 위 톱니파를 겹쳐서 쨍한 전자음
     · 빠른 떨림(비브라토)이 '위위위위' 하고 손이 빠를수록 더 빠르고 깊게 떨림
     · 손이 빠를수록 음이 최대 2옥타브까지 쭉 올라감 → 에너지가 차오르는 느낌
     · 공명 필터가 음을 따라 열려서 '이잉' 하는 날 선 소리 */
  let sentai = null, prevAmt = 0, lastShing = 0;
  function buildSentai(){
    const o1 = ctx.createOscillator(); o1.type = 'square';
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth';
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 9;
    const vibAmt = ctx.createGain(); vibAmt.gain.value = 0;
    vib.connect(vibAmt); vibAmt.connect(o1.frequency); vibAmt.connect(o2.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 9; lp.frequency.value = 800;
    const amp = ctx.createGain(); amp.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(amp);
    (pan ? (amp.connect(pan), pan) : amp).connect(space());
    [o1, o2, vib].forEach(o => o.start());
    return { o1, o2, vib, vibAmt, lp, amp, pan };
  }
  /* '챙!' — 변신 포즈/칼 빼는 순간 같은 금속성 울림 (FM 합성 종소리 + 짧은 '샥') */
  function shing(){
    if(!SENTAI_SHING) return;
    const t = ctx.currentTime;
    [[1568, 1], [2093 * 1.004, 0.6]].forEach(([f, v]) => {
      const car = ctx.createOscillator(); car.frequency.value = f;
      const mod = ctx.createOscillator(); mod.frequency.value = f * 2.76;
      const idx = ctx.createGain(); idx.gain.setValueAtTime(f * 3, t); idx.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.5);
      mod.connect(idx).connect(car.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(TYPE_SOUND_VOL * SENTAI_VOL * 0.9 * v, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      car.connect(g).connect(space());
      car.start(t); mod.start(t); car.stop(t + 0.75); mod.stop(t + 0.75);
    });
    const n = ctx.createBufferSource(); n.buffer = noise;   // '샥'
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(TYPE_SOUND_VOL * SENTAI_VOL * 0.8, t + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(hp).connect(ng).connect(space()); n.start(t, 0, 0.1);
  }
  function sentaiUpdate(amount, xNorm){
    if(!sentai) sentai = buildSentai();
    const t = ctx.currentTime;
    const f = 220 * Math.pow(2, (amount * 24) / 12);                 // 220Hz → 최대 2옥타브 위
    sentai.o1.frequency.setTargetAtTime(f, t, 0.06);
    sentai.o2.frequency.setTargetAtTime(f * 2.004, t, 0.06);
    sentai.vib.frequency.setTargetAtTime(7 + amount * 11, t, 0.1);    // 떨림 속도 7 → 18번/초
    sentai.vibAmt.gain.setTargetAtTime(f * (0.015 + amount * 0.035), t, 0.08);
    sentai.lp.frequency.setTargetAtTime(Math.min(9000, f * 2.2 + 500), t, 0.06);
    const g = amount <= 0 ? 0 : TYPE_SOUND_VOL * SENTAI_VOL * (0.2 + 0.8 * Math.pow(amount, 0.8));
    sentai.amp.gain.setTargetAtTime(g, t, amount > 0 ? 0.05 : 0.12);
    if(sentai.pan && xNorm != null) sentai.pan.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, xNorm * 2 - 1)), t, 0.08);
    if(amount > SENTAI_SHING_AT && prevAmt <= SENTAI_SHING_AT && t - lastShing > 0.6){ lastShing = t; shing(); }
    prevAmt = amount;
  }
  /* ===== 합체 메카 ===== 세 겹이 손 속도만큼 같이 커지고, 손이 멈추면 0.1초 안에 같이 멈춘다
     ① 바람: 잡음을 낮게 깎은 '쉬이—' (천천히 일렁이는 필터)
     ② 엔진: 낮은 톱니파 '우웅' + 엔진처럼 털털거리는 진동. 빠를수록 회전이 살짝 올라감
     ③ 묘한 전자음: 맑은 사인파 두 개를 서로 변조시켜 금속성으로 '이이잉—' (아주 작게)
     울림은 짧게만 — 멈추면 바로 끝나도록 */
  let mecha = null;
  function buildMecha(){
    const bus = ctx.createGain(); bus.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    // 짧은 울림 (0.6초) — 꼬리가 길면 '멈추면 같이 멈춤'이 안 되므로
    const len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);   // 울림 1.6초 — 소리가 공간에 좀 더 머묾
    for(let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.3;
    const post = pan ? (bus.connect(pan), pan) : bus;
    post.connect(out); post.connect(verb).connect(wet).connect(out);
    // ① 바람
    const wn = ctx.createBufferSource(); wn.buffer = noise; wn.loop = true;
    const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 500; wlp.Q.value = 0.7;
    const wbp = ctx.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 350; wbp.Q.value = 1.2;
    const wlfo = ctx.createOscillator(); wlfo.frequency.value = 0.25;   // 바람이 천천히 일렁임
    const wlfoAmt = ctx.createGain(); wlfoAmt.gain.value = 150;
    wlfo.connect(wlfoAmt).connect(wbp.frequency);
    const wg = ctx.createGain(); wg.gain.value = 1.4;
    wn.connect(wlp).connect(wbp).connect(wg).connect(bus);
    // ② 엔진
    // 부드럽게: 각진 톱니파 대신 둥근 삼각파, 공명 낮춤, 털털거림은 아주 약하고 느리게
    const e1 = ctx.createOscillator(); e1.type = 'triangle'; e1.frequency.value = 55;
    const e2 = ctx.createOscillator(); e2.type = 'sine'; e2.frequency.value = 55 * 1.5;   // 5도 위를 섞어 엔진 화음
    const e2g = ctx.createGain(); e2g.gain.value = 0.3;
    const elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 240; elp.Q.value = 0.7;
    const rumble = ctx.createOscillator(); rumble.frequency.value = 6;    // 털털거림 → 느린 숨결 같은 일렁임
    const rumbleAmt = ctx.createGain(); rumbleAmt.gain.value = 0.08;
    const eg = ctx.createGain(); eg.gain.value = 0.55;
    rumble.connect(rumbleAmt).connect(eg.gain);
    e1.connect(elp); e2.connect(e2g).connect(elp); elp.connect(eg).connect(bus);
    // ③ 묘한 전자음 — 링 변조: 맑은 사인파 두 개를 서로 곱해서 금속성 '이이잉—' (처음 버전, 연지가 고름)
    const c1 = ctx.createOscillator(); c1.type = 'sine'; c1.frequency.value = 740;
    const c2 = ctx.createOscillator(); c2.type = 'sine'; c2.frequency.value = 517;
    const ring = ctx.createGain(); ring.gain.value = 0;              // c1 × c2 → 금속성
    c2.connect(ring.gain);
    const cvib = ctx.createOscillator(); cvib.frequency.value = 4.5;
    const cvibAmt = ctx.createGain(); cvibAmt.gain.value = 9;
    cvib.connect(cvibAmt).connect(c1.frequency);
    const cg = ctx.createGain(); cg.gain.value = 0.07;
    const clp = ctx.createBiquadFilter(); clp.type = 'lowpass'; clp.frequency.value = 2200;
    c1.connect(ring).connect(clp).connect(cg).connect(bus);
    [wn, wlfo, e1, e2, rumble, c1, c2, cvib].forEach(o => o.start());
    return { bus, pan, wlp, e1, e2, elp, rumble, c1, c2 };
  }
  function mechaUpdate(amount, xNorm){
    if(!mecha) mecha = buildMecha();
    const t = ctx.currentTime;
    const rpm = 55 * Math.pow(2, (amount * 5) / 12);                 // 엔진 회전 최대 +5반음
    mecha.e1.frequency.setTargetAtTime(rpm, t, 0.12);
    mecha.e2.frequency.setTargetAtTime(rpm * 1.5, t, 0.12);
    mecha.rumble.frequency.setTargetAtTime(5 + amount * 4, t, 0.3);
    mecha.elp.frequency.setTargetAtTime(220 + amount * 260, t, 0.15);
    mecha.wlp.frequency.setTargetAtTime(380 + amount * 700, t, 0.1);  // 빠를수록 바람이 조금 더 '쉬익'
    mecha.c1.frequency.setTargetAtTime(700 + amount * 160, t, 0.2);
    const g = amount <= 0 ? 0 : TYPE_SOUND_VOL * MECHA_VOL * (0.3 + 0.7 * Math.pow(amount, 0.8));
    mecha.bus.gain.setTargetAtTime(g, t, amount > 0 ? 0.08 : MECHA_SUSTAIN / 3);   // 멈추면 MECHA_SUSTAIN초에 걸쳐 잦아듦
    if(mecha.pan && xNorm != null) mecha.pan.pan.setTargetAtTime(Math.max(-0.7, Math.min(0.7, xNorm * 2 - 1)), t, 0.1);
  }
  /* '위잉-철컥' 모터 — dir 'up' = 힘 받는 소리(주먹 쥠·끌기 시작), 'down' = 감속하며 멈추는 소리(덜컥 멈춤) */
  let lastMotor = 0;
  function motor(dir = 'up'){
    if(!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    if(t - lastMotor < 0.35) return;
    lastMotor = t;
    const vol = TYPE_SOUND_VOL * MECHA_MOTOR_VOL;
    const whirLen = 0.2;
    // 위잉 — 서보 모터: 톱니파 높이가 미끄러지고, 기어처럼 '드르르' 떨림
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const [f0, f1] = dir === 'up' ? [160, 420] : [420, 150];
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + whirLen);
    const gear = ctx.createOscillator(); gear.type = 'square'; gear.frequency.value = 55;
    const gearAmt = ctx.createGain(); gearAmt.gain.value = 0.35;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(vol * 0.55, t + 0.03);
    og.gain.setValueAtTime(vol * 0.55, t + whirLen - 0.04);
    og.gain.exponentialRampToValueAtTime(0.0001, t + whirLen);
    gear.connect(gearAmt).connect(og.gain);
    const obp = ctx.createBiquadFilter(); obp.type = 'bandpass'; obp.frequency.value = 900; obp.Q.value = 0.8;
    o.connect(obp).connect(og).connect(out);
    o.start(t); gear.start(t); o.stop(t + whirLen + 0.02); gear.stop(t + whirLen + 0.02);
    // 철컥 — 금속 두 번 + 묵직한 '쿵'
    const tc = t + whirLen - 0.01;
    [[0, 2400, 0.9], [0.035, 1300, 1]].forEach(([dt, f, v]) => {
      const n = ctx.createBufferSource(); n.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, tc + dt);
      g.gain.exponentialRampToValueAtTime(vol * 1.6 * v, tc + dt + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, tc + dt + 0.05);
      n.connect(bp).connect(g).connect(out); n.start(tc + dt, Math.random() * 0.05, 0.06);
    });
    const th = ctx.createOscillator(); th.type = 'sine';
    th.frequency.setValueAtTime(120, tc); th.frequency.exponentialRampToValueAtTime(50, tc + 0.09);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, tc); tg.gain.exponentialRampToValueAtTime(vol * 1.1, tc + 0.004);
    tg.gain.exponentialRampToValueAtTime(0.0001, tc + 0.12);
    th.connect(tg).connect(out); th.start(tc); th.stop(tc + 0.14);
  }

  // 손 소리 고르기 — 루프는 이것만 부른다
  function handUpdate(amount, xNorm){
    if(!ctx || ctx.state !== 'running') return;
    if(CURSOR_SOUND === 'sentai') sentaiUpdate(amount, xNorm);
    else if(sentai) sentai.amp.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    if(CURSOR_SOUND === 'mecha') mechaUpdate(amount, xNorm);
    else if(mecha) mecha.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    humUpdate(amount, xNorm);   // 'hum'일 때만 실제로 소리 남
  }
  function debug(){ return { ctx, out, state: ctx && ctx.state }; }   // 개발 확인용
  /* 펜 소리 — 만년필 촉이 종이를 긁는 '슥슥'. 칠하는 속도만큼 커지고, 멈추면 0.1초 안에 사라진다.
     ① 바닥: 종이결 마찰음(잡음을 중간 높이로만 걸러서 — 날카로운 고음은 PEN_TOP에서 자름)
     ② 알갱이: 종이 섬유에 촉이 걸리는 아주 짧은 '틱'을 움직인 만큼 무작위로
     지우개는 같은 구조에서 더 낮고 둔하게(고무가 문질러지는 소리). */
  let penBed = null, penGain = null, penBand = null, penLow = null, penKind = '';
  function buildPen(){
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    penBand = ctx.createBiquadFilter(); penBand.type = 'bandpass'; penBand.Q.value = 0.8;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
    penLow = ctx.createBiquadFilter(); penLow.type = 'lowpass'; penLow.Q.value = 0.5;
    penGain = ctx.createGain(); penGain.gain.value = 0;
    src.connect(hp).connect(penBand).connect(penLow).connect(penGain).connect(out);
    src.start(); penBed = src;
  }
  function pen(amount, kind = 'pen'){
    if(!SOUND_PEN || !ctx || ctx.state !== 'running') return;
    if(!penBed) buildPen();
    const t = ctx.currentTime;
    const a = Math.max(0, Math.min(1, amount || 0));
    if(kind !== penKind){   // 펜 ↔ 지우개 음색 바꾸기
      penKind = kind;
      penBand.frequency.setTargetAtTime(kind === 'erase' ? 700 : 1900, t, 0.02);
      penLow.frequency.setTargetAtTime(kind === 'erase' ? 1500 : PEN_TOP, t, 0.02);
    }
    // 빠를수록 크고 살짝 밝아진다 (붓질 한 번 = '슥')
    penGain.gain.setTargetAtTime(TYPE_SOUND_VOL * PEN_VOL * a, t, a > 0 ? 0.025 : 0.06);
    if(a > 0 && Math.random() < a * 0.5){   // 종이결 알갱이
      const g = ctx.createBufferSource(); g.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
      bp.frequency.value = (kind === 'erase' ? 900 : 2300) * (0.8 + Math.random() * 0.4);
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.exponentialRampToValueAtTime(TYPE_SOUND_VOL * PEN_VOL * 0.9 * a + 0.0002, t + 0.003);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      g.connect(bp).connect(gg).connect(out);
      g.start(t, Math.random() * 0.08, 0.03);
    }
  }
  return { unlock, click, clack, sparkle, whoosh, rustle, humUpdate, handUpdate, motor, debug, pen };
})();
// 카메라로 잡은 '손' 커서의 움직임만 보고 소리 세기를 정한다 (마우스는 무시)
// 카메라는 손 위치를 1초에 수십 번만 새로 주므로, 위치가 실제로 바뀐 순간끼리의 거리/시간으로 속도를 잰다.
const HAND_SOUND_MIN_SPEED = 0.08;  // 이보다 느린 움직임(손 인식 떨림)은 소리 없음 — 1초에 화면 폭의 8%
const HAND_SOUND_FULL_SPEED = 0.8;  // 이 속도(1초에 화면 폭 80%)면 소리가 최대
(function handSoundLoop(){
  const cur = document.getElementById('handCursor');
  let lx = null, ly = null, lt = 0, speed = 0, pt = 0, smooth = 0;
  let recentPeak = 0, recentPeakAt = 0, wasFist = false, fistMoving = false, fistAt = 0;
  function frame(now){
    const dt = pt ? Math.min(0.1, (now - pt) / 1000) : 0.02; pt = now;
    const handVisible = (typeof camOn !== 'undefined' && camOn) && cur && cur.style.display === 'block';
    if(handVisible){
      const x = parseFloat(cur.style.left), y = parseFloat(cur.style.top);
      if(!isNaN(x) && !isNaN(y)){
        if(lx === null){ lx = x; ly = y; lt = now; }
        else if(x !== lx || y !== ly){                       // 카메라가 새 위치를 줬을 때만
          const sec = Math.max(0.016, (now - lt) / 1000);
          speed = Math.hypot(x - lx, y - ly) / sec / window.innerWidth;   // 1초에 화면 폭 몇 개만큼
          lx = x; ly = y; lt = now;
        } else if(now - lt > 100){ speed = 0; }             // 0.1초 동안 위치 그대로면 멈춘 것
      }
    } else { lx = ly = null; speed = 0; }
    const amount = Math.min(1, Math.max(0, (speed - HAND_SOUND_MIN_SPEED) / (HAND_SOUND_FULL_SPEED - HAND_SOUND_MIN_SPEED)));
    smooth += (amount - smooth) * (amount > smooth ? 0.5 : 0.08);  // 움직이기 시작하면 바로, 느려질 땐 천천히 따라 내려감 → 소리가 덜 끊김
    if(!isFinite(smooth)) smooth = 0;                               // 혹시 값이 깨져도 다음 틱에 바로 회복
    const a = smooth < 0.01 ? 0 : smooth;
    // 모터 '위잉-철컥' (메카 모드) — ① 주먹을 쥠 ② 주먹 쥔 채 끌기 시작
    if(CURSOR_SOUND === 'mecha' && MECHA_MOTOR && handVisible){
      const fist = cur.classList.contains('fist');
      if(fist && !wasFist){ typeSound.motor('up'); fistAt = now; }
      if(fist && !fistMoving && amount > 0.15){
        if(now - fistAt > 600) typeSound.motor('up');   // 막 쥐자마자 끄는 건 위에서 이미 소리남 → 겹치지 않게
        fistMoving = true;
      }
      if(!fist || amount < 0.03) fistMoving = false;
      wasFist = fist;
    } else { recentPeak = 0; wasFist = false; fistMoving = false; }
    typeSound.rustle(a, dt);
    // 손의 가로 위치(0=왼쪽 끝, 1=오른쪽 끝) → 우웅 소리가 그쪽 스피커로
    typeSound.handUpdate(a, lx === null ? 0.5 : lx / window.innerWidth);
  }
  // 화면 그리기(rAF)와 별개로 일정 간격으로 돈다 — 창이 가려지거나 프레임이 밀려도 소리가 끊기지 않게
  setInterval(() => frame(performance.now()), 20);
})();

// 모든 버튼 — 누르면 종류별 '달칵' (손 주먹 클릭도 click 이벤트로 들어온다)
function clackTypeFor(el){
  if(el.closest('.next-btn, .q-chev')) return 'next';
  if(el.closest('.color-swatch, .kw')) return 'select';
  if(el.closest('.tool-btn')) return 'tool';
  if(el.closest('.reset-fab')) return 'reset';
  if(el.closest('[data-action="camstart"]')) return 'start';
  return 'nav';
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('button, a, .dwellable, .color-swatch, .kw, [data-action]');
  if(el){
    const r = el.getBoundingClientRect();
    const pan = r.width ? ((r.left + r.width / 2) / window.innerWidth * 2 - 1) * CLACK_PAN : 0;
    typeSound.clack(clackTypeFor(el), pan);
  }
}, true);

// 첫 키 입력 / 클릭 때 소리를 깨운다 (첫 화면 Enter가 여기 해당)
['keydown', 'pointerdown'].forEach(ev => document.addEventListener(ev, () => typeSound.unlock(), true));

async function runStory(){
  clearStoryTimers();
  const scr = document.getElementById('screen-story');
  const alive = () => scr.classList.contains('active');
  scr.classList.remove('phase-b', 'phase-c', 'go');
  try{ await document.fonts.load('1000px AGSuperBlack', '310명의 히어로 중 당신에게 딱 맞는 수호 영웅을 매칭해드립니다! 진짜진짜 시작'); }catch(e){}
  const p1 = buildTypePara(scr.querySelector('.story-para-1'));
  const p2 = buildTypePara(scr.querySelector('.story-para-2'));
  const lines = [...scr.querySelectorAll('.story-line')].map(buildStretchLine).flat();
  const go = buildStretchLine(scr.querySelector('.story-go'));
  [...p1, ...p2, ...lines].forEach(c => c.classList.remove('on'));
  go.forEach(c => c.classList.add('on'));

  typeChars(p1, STORY_P1_MS, () => storyLater(() => {
    if(!alive()) return;
    typeChars(p2, STORY_PARA_MS, () => {
      if(!alive()) return;
      storyLater(() => {
        scr.classList.add('phase-b');
        typeChars(lines, STORY_B_MS, () => {
          storyLater(() => {
            scr.classList.add('phase-c');                                  // 위로 줄어듦
            typeSound.whoosh(SOUND_SLIDE, 'story');                         // 줄어드는 0.7초에 맞춘 부드러운 '스윽'
            storyLater(() => scr.classList.add('go'), STORY_SHRINK_MS * 0.5); // 진짜진짜 시작 + NEXT 밀려 나옴 (소리 없음)
          }, STORY_HOLD_B);
        }, 'stamp');                                                       // 세 줄은 묵직한 '탕' 소리
      }, STORY_HOLD_A);
    });
  }, STORY_P1_PAUSE));
}

/* 화면 전환 — 다음 화면이 오른쪽에서 밀려 들어오고 지금 화면은 왼쪽으로 밀려 나간다 */
const SLIDE_MS = 650;
function slideTo(name){
  const from = document.querySelector('.screen.active');
  goto(name);
  const to = document.getElementById(screens[name]);
  if(!from || from === to) return;
  typeSound.whoosh();                       // 화면 전환 '슈욱' (SOUND_SLIDE)
  from.classList.add('leaving');            // goto가 active를 지워도 애니메이션 동안은 보이게
  to.classList.add('enter-right');
  void to.offsetWidth;                      // 시작 위치를 먼저 그리게 한 뒤
  from.classList.add('slide', 'exit-left');
  to.classList.add('slide');
  to.classList.remove('enter-right');
  setTimeout(() => {
    from.classList.remove('leaving', 'slide', 'exit-left');
    to.classList.remove('slide');
  }, SLIDE_MS + 50);
}

/* ---------- 3. Q1~Q5 데이터 + 진행 상태 ---------- */
const Q_META = [
  { id:'Q1_책임과 사명', title:'Q1 · 책임과 사명', sub:'무거운걸 짊어질 때,\n당신은 어떤 상태가 되나요?' },   // 시안 5_page1_01 문구·줄바꿈
  { id:'Q2_감정을 다루는 방식', title:'Q2 · 감정을 다루는 방식', sub:'마음이 흔들릴 때 당신의 마음속에서는 어떤게 떠오르나요?' },
  { id:'Q3_관계 맺는 방식', title:'Q3 · 관계 맺는 방식', sub:'다른 사람들 속 당신의 모습을 칠해주세요' },
  { id:'Q4_나를 보는 시선', title:'Q4 · 나를 보는 시선', sub:'당신이 바라보는 스스로의 모습은 어떤가요?' },
  { id:'Q5_행동하는 방식', title:'Q5 · 행동하는 방식', sub:'벽에 부딪힐 때 발휘되는 당신의 특성은 무엇인가요?' }
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
let selfName = ''; // 오프닝에서 입력한 원본 이름(컬러 조합 전) — "스스로 생각하는 모습" 비교용
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
    el.style.setProperty('--swatch-color', SWATCH_COLORS[name] || COLOR_MAP[name] || '#8a8a8a');
    for(let i = 0; i < 9; i++) el.appendChild(document.createElement('i')); // 3×3 칸 — 가운데(5번째)가 색
    grid.appendChild(el);
  });
}

/* 이름 짓기 — 한 화면에 한 단계: 1 제목 / 2 색 고르기 / 3 이름 쓰기 + 레인저 */
const OPEN_TITLE_MS = 2600;   // 1 제목을 보여주는 시간
const OPEN_PICK_MS = 600;     // 색을 고른 뒤 선택 표시를 보여주고 3으로 넘어가기까지
let openTitleTimer = null, openStepTimer = null;
function setOpenStep(n){
  const scr = document.getElementById('screen-open');
  if(n === 1) document.fonts.load('1000px AGSuperBlack').then(() => document.querySelectorAll('.id-title-line').forEach(buildStretchLine));
  scr.dataset.step = n;
  clearTimeout(openStepTimer);
  if(n === 3) setTimeout(() => { nicknameInput.focus(); renderNameType(); }, 60);
}
function selectColor(el){
  const name = el.dataset.color;
  selectedColor = name;
  document.querySelectorAll('#colorGrid .color-swatch').forEach(s => s.classList.toggle('selected', s === el));
  updateCombinedIdPreview();
  refreshStartBtn();
  // 색을 고르면 선택 표시를 잠깐 보여주고 3 이름 쓰기로
  const scrOpen = document.getElementById('screen-open');
  if(scrOpen.dataset.step === '2'){
    clearTimeout(openStepTimer);
    openStepTimer = setTimeout(() => { setOpenStep(3); typeSound.whoosh(); }, OPEN_PICK_MS);
  }
  // 스카이블루는 rangers.json 안에 딱 1명뿐이라(직접 python으로 세어봄) 같은 계열인 블루 풀도
  // 같이 보여준다 — 연지가 요청한 대로. 블루를 고를 땐 원래도 50명이라 그대로 둔다.
  const pool = RANGERS
    ? RANGERS.filter(r => r.color === name || (name === '스카이블루' && r.color === '블루'))
    : [];
  if(pool.length){
    flashThenCycle(document.getElementById('openCanvas'), pool, OPEN_RATE, OPEN_COLOR_MIX);
  }
}

// 흰 글자가 검은 글자보다 대비가 큰 색이면 '어두운 색' (WCAG 대비 공식)
function isDarkColor(hex){
  if(!hex) return false;
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const n = parseInt(hex.slice(1), 16);
  const L = 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255);
  return (1.05 / (L + 0.05)) > ((L + 0.05) / 0.05);
}
function updateCombinedIdPreview(){
  const raw = (document.getElementById('nicknameInput').value || '').trim();
  const label = document.getElementById('combinedIdPreview');
  label.textContent = (raw && selectedColor) ? raw + ' ' + selectedColor : '';
  // 가운데 이름 타이포는 고른 색으로 (화이트는 배경과 같은 색이라 --id-name-white로)
  const scr = document.getElementById('screen-open');
  if(selectedColor) scr.style.setProperty('--id-name-color', selectedColor === '화이트' ? 'var(--id-name-white)' : SWATCH_COLORS[selectedColor]);
  else scr.style.removeProperty('--id-name-color');
  // 어두운 색 타이포 위에선 "2) 닉네임을 입력하세요" 문구를 흰색으로 (이름이 보이고 있을 때만)
  scr.classList.toggle('name-dark', !!(raw && selectedColor && isDarkColor(SWATCH_COLORS[selectedColor])));
  document.getElementById('screen-open').classList.toggle('has-id', !!(raw && selectedColor));
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
    fetch(FILES + 'data/keywords.json').then(r=>r.json()),
    fetch(FILES + 'data/rangers.json').then(r=>r.json()),
    fetch(FILES + 'data/hero-images.json').then(r=>r.json()).catch(() => ({})) // 사진 매니페스트가 없어도 컬러 블록으로 정상 동작
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
function computePool(upTo = qIndex){
  const answered = picks.slice(0, upTo).flat();
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

/* ---------- Page 1~6 화면 디자인 (design/아트보드 9~20) ---------- */
// 인트로 질문(줄바꿈 그대로) — 정보 패널에도 같은 두 줄이 들어간다
const Q_SUBS = [
  '무거운걸 짊어질 때,\n당신은 어떤 상태가 되나요?',
  '마음이 흔들릴 때,\n당신은 어떻게 되나요?',
  '타인과 함께 있는\n당신의 모습은 어떤가요?',
  '당신이 바라보는\n스스로의 모습은 어떤가요?',
  '벽에 부딪힐 때 나타나는\n당신의 특성은 무엇인가요?'
];
// 왼쪽 아래 한 줄 이야기 (시안에 있는 Page만 — 4·5는 시안에 없음)
const Q_CAPTIONS = [
  '자고로 영웅이란 세계의 존망을 책임지는 아주 무거운 무게를 짊어지게 되기 마련이죠...',
  '영웅에게 닥치는 시련은 비단 육체적인 싸움 뿐만이 아닙니다...',
  '변신 후에 사람들에게 보이는 모습이 달라질 수도 있어요. 과연 어떤 상태가 진정한 당신의 모습일까요?',
  '',
  ''
];
// 오른쪽 아래 안내 — 뒤에 (고른 개수/3)이 붙는다. 1·2는 시안 문구, 3~5는 시안에 없어서 같은 말투로 채움
const Q_HINTS = [
  '당신에게\n해당되는\n키워드를 골라\n보물상자에\n넣으세요!',
  '당신에게\n해당되는\n키워드를 찾아\n1초 이상\n붙들고\n있으세요!',
  '당신에게\n해당되는\n키워드를\n펜으로\n칠하세요!',
  '야광봉으로\n어둠 속을 비춰\n해당되는\n키워드를\n짚으세요!',
  '당신에게\n해당되는\n벽돌을\n주먹으로\n깨부수세요!'
];
// "Page N" 중심 — 페이지마다 글자 폭이 달라서 시안과 겹쳐 맞춘 값 (일치율 98~99%)
const Q_LOGO_POS = [[45.11,53.06],[48.50,55.93],[49.75,55.84],[49.17,57.32],[47.82,54.91],[50.27,55.65]];
const Q_PROGRESS = [0.095, 0.269, 0.442, 0.689, 0.875, 1];   // 시안의 빨간 진행 바 길이 (Page 6 = 끝까지)
// Page 1 — 레인저 9명 자리 (레인저 몸통 왼쪽 위, vw/vh). 윗줄 5 / 아랫줄 4
const Q1_SLOTS = [[39.99,50.1],[46.14,50.1],[52.26,50.1],[58.38,50.2],[64.50,50.2],[43.33,70.17],[49.25,70.17],[55.16,70.17],[61.09,70.17]];
// Page 2 — 키워드 → 구슬 그림 (그림 안에 글자가 이미 있음)
const Q2_BEADS = {'침착함':'calm','냉철함':'cool-teaded','감정억제':'emotional-suppression','감정적':'emotional','열정':'enthusiastic',
  '다혈질':'hot-tempered','즉흥성':'improvisational','자존심':'pride','경직됨':'rigid','트라우마':'trauma'};
// Page 3 — [키워드(없으면 검은 칸), 열, 행]
const Q3_CELLS = [['거리감',1,0],['다정함',1,1],['의리',2,1],['고독함',0,2],[null,1,2],[null,2,2],[null,1,3],['배려심',2,3],
  ['무뚝뚝함',1,4],[null,2,4],['경계심',3,4],['친화력',1,5],[null,3,5],['독자성',1,6],['과묵함',3,6]];
// Page 4 — 어둠 속에 흩어진 자리 (검은 판 안 %, 가장자리 번지는 곳은 피함)
const Q4_SPOTS = [[24,26],[50,21],[76,30],[33,46],[62,44],[20,66],[45,64],[73,62],[34,82],[60,83]];
// Page 5 — 벽돌 탑 (위→아래, 시안 순서). 경솔함(1위)은 시안 탑에 없어서 뺐다
const Q5_BRICKS = ['경솔함','지적 능력','강인함','낙천적','용기','밝음','무모함','솔직함','성장','행동력'];

let qRecapMeasure = null;
// 질문 두 줄을 AG로 쓰고, 가장 긴 줄이 --qi-q-w 폭이 되도록 가로로만 눌러 넣는다
async function fitRecapText(el, text){
  el.innerHTML = '';
  const lines = text.split('\n');
  lines.forEach(t => { const s = document.createElement('span'); s.textContent = t; el.appendChild(s); });
  try{ await document.fonts.load('100px AGSuperBlack'); }catch(e){}
  const cs = getComputedStyle(el);
  const fs = parseFloat(cs.fontSize);
  qRecapMeasure = qRecapMeasure || document.createElement('canvas').getContext('2d');
  qRecapMeasure.font = `${fs}px AGSuperBlack`;
  const widest = Math.max(...lines.map(t => qRecapMeasure.measureText(t).width));
  const target = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--qi-q-w')) * window.innerWidth / 100;
  el.style.setProperty('--sx', widest > 0 ? Math.min(1, target / widest).toFixed(4) : 1);
}
function setLogoPos(el, page){
  const p = Q_LOGO_POS[page];
  el.style.setProperty('--q-logo-x', p[0] + 'vw');
  el.style.setProperty('--q-logo-y', p[1] + 'vh');
}
function refreshHint(){
  const n = picks[qIndex].length;
  const of = n > MIN_PICK ? MAX_PICK : MIN_PICK;
  document.getElementById('qHint').textContent = Q_HINTS[qIndex].replace(/\n/g, ' ') + ' (' + n + '/' + of + ')';   // 화면 위 한 줄
}

function renderQuestion(){
  qEnteredAt = performance.now(); // 화면 전환 직후의 자연스러운 손 이동을 펀치로 오인하지 않도록
  dwellTarget = null; dwellProgress = new Map(); dwellLocked = new Set(); // Q2 붙잡기 상태도 문항이 바뀔 때마다 초기화
  floatItems = [];
  paintTarget = null; paintLast = null; // Q3 칠하기 상태도 초기화
  setPaintMode('none'); // Q3에 들어오면 도구 없이 시작 — 펜/지우개를 눌러야 커서가 바뀐다
  punchHistory = []; // Q5 펀치 이동 기록도 문항이 바뀔 때마다 초기화
  const meta = Q_META[qIndex];
  const screen = document.getElementById('screen-q');
  // 페이지별 클래스 (q1~q5) — 배치·배경은 전부 CSS가 이 클래스로 나눈다
  for(let i = 1; i <= 5; i++) screen.classList.toggle('q' + i, qIndex === i - 1);
  screen.classList.remove('q-shown');

  // 큰 "Page N" — PNG 모양을 마스크로 써서 --red로 칠한다. 파일마다 가로 길이가 달라서 비율·중심도 같이 넘긴다
  const titleImg = document.getElementById('qTitleImg');
  titleImg.src = FILES + 'images/ui/icons/page-header-' + (qIndex + 1) + '.png';
  titleImg.alt = meta.title;
  const qLogo = document.getElementById('qLogo');
  qLogo.style.setProperty('--logo', `url('${titleImg.src}')`);
  qLogo.style.setProperty('--logo-ratio', `${PAGE_HEADER_W[qIndex]}/501`);
  qLogo.setAttribute('aria-label', 'Page ' + (qIndex + 1));
  setLogoPos(document.getElementById('qIntro'), qIndex);
  document.getElementById('qSub').textContent = Q_SUBS[qIndex];
  updateCursorMode();

  // 정보 패널 — 질문 / 진행 바 / 이야기
  fitRecapText(document.getElementById('qRecapText'), Q_SUBS[qIndex]);
  document.getElementById('qInfo').style.setProperty('--qi-progress', (Q_PROGRESS[qIndex] * 100) + '%');
  document.getElementById('qCaption').textContent = Q_CAPTIONS[qIndex];
  document.getElementById('qQuestion').textContent = Q_SUBS[qIndex];   // 왼쪽 아래 질문 단락
  document.getElementById('qDnd').classList.remove('on');

  const grid = document.getElementById('kwGrid');
  grid.innerHTML = '';
  grid.className = 'kw-grid'; // 매 질문마다 인터렉션별 클래스 초기화
  setBasketOpen(false);

  const isQ1 = qIndex === 0, isQ2 = qIndex === 1, isQ3 = qIndex === 2, isQ4 = qIndex === 3, isQ5 = qIndex === 4;
  // Q1은 연지가 만든 9명의 레인저 그래픽과 키워드를 1:1로 맞춘다.
  const Q1_HEROES = ['리더십','완벽주의','책임감','근성','성실함','무리함','자기희생','신념','정의감']; // 윗줄 빨강·검정·파랑·노랑·초록 / 아랫줄 보라·주황·금·분홍
  const Q1_FILES = {'책임감':'responsibility','리더십':'leadrship','정의감':'justice','자기희생':'secrifice','성실함':'diligence','근성':'tenacity','완벽주의':'perfectionism','신념':'faith','무리함':'excessiveness'};
  let kws;
  if(isQ1) kws = Q1_HEROES;
  else if(isQ2) kws = Object.keys(Q2_BEADS);
  else if(isQ3) kws = Q3_CELLS.filter(c => c[0]).map(c => c[0]);
  else if(isQ5) kws = Q5_BRICKS;
  else kws = topKeywords(meta.id);
  // dwellable(범용 "주먹=클릭")은 Q4에만. Q1(드래그)·Q2(붙잡기)·Q3(칠하기)·Q5(펀치)는 전용 로직이 있다.
  const usesDwellClick = isQ4;

  // Page 3 검은 칸 (장식 — 선택지 아님)
  if(isQ3){
    Q3_CELLS.filter(c => !c[0]).forEach(c => {
      const b = document.createElement('div');
      b.className = 'q3-cell q3-black';
      b.style.setProperty('--c', c[1]); b.style.setProperty('--r', c[2]);
      grid.appendChild(b);
    });
  }

  kws.forEach((k, i) => {
    const el = document.createElement('div');
    el.className = 'kw' + (usesDwellClick ? ' dwellable' : '') + (isQ3 ? ' kw-paint q3-cell' : '');
    el.dataset.kw = k;
    el.draggable = false;
    if(isQ1){
      el.classList.add('kw-hero');
      el.style.setProperty('--x', Q1_SLOTS[i][0] + 'vw');
      el.style.setProperty('--y', Q1_SLOTS[i][1] + 'vh');
      // A = 기본(레인저만), B = hover/잡았을 때(말풍선에 키워드 이름)
      ['a','b'].forEach(v => {
        const img = document.createElement('img');
        img.className = 'img-' + v;
        img.src = FILES + 'images/ui/icons/page-1/' + Q1_FILES[k] + (v === 'a' ? 'A' : 'B') + '.png';
        img.alt = v === 'a' ? k : '';
        img.draggable = false;
        el.appendChild(img);
      });
    }
    if(isQ2){
      el.classList.add('bead');
      const img = document.createElement('img');
      img.src = FILES + 'images/ui/icons/page-2/bead2_' + Q2_BEADS[k] + '.png';   // 글자 고친 새 구슬 (원본: 자산 14~23.png)
      img.alt = k; img.draggable = false;
      el.appendChild(img);
    }
    if(isQ3){
      const c = Q3_CELLS.find(c => c[0] === k);
      el.style.setProperty('--c', c[1]); el.style.setProperty('--r', c[2]);
      // 칠하기용 픽셀 캔버스 — 펜이 지나간 자리만 아이디 색으로 칠해진다
      const cv = document.createElement('canvas');
      cv.className = 'paint-canvas'; cv.width = PAINT_RES; cv.height = PAINT_RES;
      el.appendChild(cv);
    }
    if(isQ4){
      el.classList.add('q4-word');
      const s = Q4_SPOTS[i % Q4_SPOTS.length];
      el.style.setProperty('--x', s[0] + '%'); el.style.setProperty('--y', s[1] + '%');
    }
    if(isQ5){
      el.classList.add('brick');
      el.style.setProperty('--i', i);
      ['A','B','C'].forEach(v => {
        const img = document.createElement('img');
        img.className = 'b-' + v.toLowerCase();
        img.src = FILES + 'images/ui/icons/page-5/brick_' + v + '.png';
        img.alt = ''; img.draggable = false;
        el.appendChild(img);
      });
    }
    const label = document.createElement('span');
    label.className = 'kw-label';
    label.textContent = isQ5 ? k.replace(/\s/g, '') : k;   // 벽돌엔 시안처럼 붙여서(지적능력)
    el.appendChild(label);
    if(picks[qIndex].includes(k)){
      el.classList.add('selected');
      if(isQ5) el.classList.add('punched');
      if(isQ1) el.classList.add('picked-source');
      if(isQ3) fillPaintCanvas(el);
    }
    grid.appendChild(el);
  });

  // Q4 눈가리개는 인트로가 끝나고 q-body가 보인 뒤에 켠다
  const eyeMask = document.getElementById('eyeMask');
  eyeMask.style.display = 'none';
  eyeMask.style.background = '';
  document.getElementById('paintTools').style.display = isQ3 ? 'block' : 'none';
  if(isQ2) grid.classList.add('float');

  refreshNextBtn();

  const pool = computePool();
  // 모자이크는 q-body가 숨어 있어도 미리 그려둘 수 있다
  // (정보 패널을 없애서 질문 화면 안 모자이크는 그리지 않는다 — 페이지 사이 모자이크 화면이 대신 보여준다)

  // 인트로를 3초 보여준 뒤 → "Page N"은 20%로 흐려져 배경으로 남고, 질문 화면이 나타난다
  revealAfterIntro('qIntro', 'qBody', 1500, () => {
    screen.classList.add('q-shown');
    fitRecapText(document.getElementById('qRecapText'), Q_SUBS[qIndex]);
    if(qIndex === 1) initFloatingKeywords(grid);
    if(isQ4){
      setTimeout(() => { if(qIndex === 3) eyeMask.style.display = 'block'; }, 30);
    }
  });
}

/* Q1~Q6 공통: "인트로 3초 -> 질문 화면" 순서.
   인트로는 사라지지 않고 dim 클래스로 질문만 빠지고 "Page N"은 20%로 흐려져 배경이 된다.
   onReveal은 bodyId가 실제로 보이기 시작한 직후 한 번 호출된다. */
let qRevealTimer = null;
const PAGE_HEADER_W = [1834, 1959, 1917, 1959, 1959, 1959, 1876]; // page-header-1~7.png 가로 픽셀(세로는 모두 501)
const Q_INTRO_MS = 3200;  // Page 인트로를 보여주는 시간 (대각선으로 들어오는 0.45초 대기 + 0.8초 모션 + 읽는 시간)
function revealAfterIntro(introId, bodyId, delayMs, onReveal){
  clearTimeout(qRevealTimer);
  delayMs = Math.max(delayMs, Q_INTRO_MS);
  const intro = document.getElementById(introId);
  const body = document.getElementById(bodyId);
  intro.classList.remove('fade-out', 'play', 'dim');
  intro.style.display = 'block';
  void intro.offsetWidth;          // 애니메이션을 처음부터 다시
  intro.classList.add('play');     // "Page N"이 좌상단에서 대각선으로 들어옴
  setTimeout(() => typeSound.whoosh(), 450);   // 로고 출발에 맞춰 슈욱 (화면 전환 직후면 한 번만 남)
  body.classList.remove('visible');
  body.style.display = 'none';
  document.body.classList.add('q-intro-on');   // 인트로 동안엔 RE도 숨김
  qRevealTimer = setTimeout(() => {
    document.body.classList.remove('q-intro-on');
    intro.classList.add('dim');    // 질문은 빠지고 "Page N"은 배경으로 흐려진다
    setTimeout(() => {
      body.style.display = 'block';
      requestAnimationFrame(() => body.classList.add('visible'));
      if(onReveal) onReveal();
    }, 400); // .q-intro의 opacity transition 시간과 맞춘다
  }, delayMs);
}

function refreshNextBtn(){
  const ok = picks[qIndex].length >= MIN_PICK;
  document.getElementById('nextBtn').disabled = !ok;   // 꺼져 있으면 회색, 3개 채우면 빨갛게
  refreshHint();
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
    if(isBasket) typeSound.clack('next', -CLACK_PAN * 0.7);   // 레인저키가 보물상자에 들어가는 순간 달칵 (상자가 왼쪽이라 왼쪽 귀 쪽)
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

/* 결과 — ① 룰렛(레인저가 타다다닥 바뀌다 점점 느려지며 매칭된 레인저로 짜잔) → ② AI 답이 오면 왼쪽으로 밀리고 자세히.
   AI 답은 룰렛과 동시에 받기 시작해서, 기다리는 시간을 룰렛이 채운다. */
const ROULETTE_TICKS = 24;        // 바뀌는 횟수
const ROULETTE_START_MS = 55;     // 처음 간격 (빠르게 타다다닥)
const ROULETTE_SLOW = 1.12;       // 한 번 바뀔 때마다 간격이 이만큼 길어짐 (점점 느려짐)
const RESULT_HOLD_MS = 1600;      // 짜잔 하고 나타난 뒤, 왼쪽으로 밀리기 전 최소 보여주는 시간
let resSpinDone = false, resAiDone = false, resTimers = [];
const resNameMeasure = document.createElement('canvas').getContext('2d');
function setResultCard(r){
  document.getElementById('resultSeries').textContent = r.series || '';
  document.getElementById('resultSummary').textContent = r.summary || r.description || '';
  const svg = document.getElementById('resultNameSvg');
  resNameMeasure.font = '1000px AGSuperBlack';
  const m = resNameMeasure.measureText(r.name);
  const x0 = -m.actualBoundingBoxLeft, x1 = m.actualBoundingBoxRight, y0 = -m.actualBoundingBoxAscent, y1 = m.actualBoundingBoxDescent;
  svg.setAttribute('viewBox', `${x0} ${y0} ${Math.max(1, x1 - x0)} ${Math.max(1, y1 - y0)}`);
  svg.innerHTML = '<text x="0" y="0" font-size="1000"></text>';
  svg.querySelector('text').textContent = r.name;
  renderCandidateFrame(document.getElementById('resultCanvas'), r, RESULT_RATE, RESULT_COLOR_MIX);
}
function maybeShowDetail(){
  if(!resSpinDone || !resAiDone) return;
  const scr = document.getElementById('screen-result');
  if(scr.dataset.phase === 'detail') return;
  scr.dataset.phase = 'detail';
  typeSound.whoosh();
  setTimeout(fitResultStep2, 50);
  setTimeout(fitResultStep2, 1300);   // 밀려 들어온 뒤 한 번 더
}
function showResult(){
  stopCandidateCycle();
  resTimers.forEach(clearTimeout); resTimers = [];
  matched = runMatch();
  resSpinDone = false; resAiDone = false;
  const scr = document.getElementById('screen-result');
  scr.dataset.phase = 'spin';
  scr.classList.remove('landed'); scr.classList.add('spinning');
  document.getElementById('resultName').textContent = matched.name;
  renderResultKeywords();
  saveToArchive();
  fetchAiInterpretation().finally(() => { resAiDone = true; maybeShowDetail(); });
  // 룰렛 — 사진이 있는 레인저 중에서 무작위로, 간격이 점점 길어지다 마지막에 매칭된 레인저
  const pool = RANGERS.filter(r => r !== matched && heroImageCache[r.name]);
  document.fonts.load('1000px AGSuperBlack').finally(() => {
    let t = 0, gap = ROULETTE_START_MS;
    for(let i = 0; i < ROULETTE_TICKS; i++){
      const last = i === ROULETTE_TICKS - 1;
      t += gap; gap *= ROULETTE_SLOW;
      resTimers.push(setTimeout(() => {
        if(last){
          setResultCard(matched);
          scr.classList.remove('spinning'); scr.classList.add('landed');
          typeSound.clack('start');   // 짜잔
          resTimers.push(setTimeout(() => { resSpinDone = true; maybeShowDetail(); }, RESULT_HOLD_MS));
        } else {
          setResultCard(pool[Math.floor(Math.random() * pool.length)] || matched);
          typeSound.click('key');     // 타다다닥
        }
      }, t));
    }
  });
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
/* 결과 2단계 — AI 글이 길어도 한 화면(스크롤 없이)에 들어가도록 글자 크기를 줄여 맞춘다 */
function fitResultStep2(){
  const box = document.getElementById('resDetail');
  if(!box || document.getElementById('screen-result').dataset.phase !== 'detail') return;
  const vh = window.innerHeight / 100;
  let size = 5;                                   // 시작: 5vh (design.css --res-body-size와 같게)
  const apply = () => { box.style.setProperty('--res2-body', size + 'vh'); box.style.setProperty('--res2-k', (size / 5).toFixed(3)); };
  apply();
  while(size > 2.6 && box.scrollHeight > box.clientHeight + 1){ size -= 0.2; apply(); }
}
window.addEventListener('resize', fitResultStep2);
async function fetchAiInterpretation(){
  const explEl = document.getElementById('aiExplanation');
  const lineEl = document.getElementById('aiInterpretation');
  const identityEl = document.getElementById('aiIdentityCompare');
  if(!subjectiveText){ explEl.textContent = ''; lineEl.textContent = ''; if(identityEl) identityEl.textContent = ''; return; }
  explEl.textContent = '수호 영웅의 답변을 생성하는 중…';
  lineEl.textContent = '';
  if(identityEl) identityEl.textContent = '';
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
        personalityKeywords,
        // 오프닝에서 스스로 지은 이름/색 — "스스로 생각하는 모습" vs "실제 매칭(내면)" 비교용
        selfName,
        selfColor: selectedColor || ''
      }),
      signal: AbortSignal.timeout(20000)   // AI 답이 6초 이상 걸리는 경우가 많아서 넉넉히 — 이 안에 안 오면 기본 문장
    });
    if(!res.ok) throw new Error('interpret API status ' + res.status);
    const data = await res.json();
    explEl.textContent = (data && data.explanation) ? data.explanation : '';
    lineEl.textContent = (data && data.oneLiner) ? data.oneLiner : '';
    if(identityEl) identityEl.textContent = (data && data.identityCompare) ? data.identityCompare : '';
    attachAiToArchive({ aiOneLiner: lineEl.textContent, aiExplanation: explEl.textContent, aiIdentity: identityEl ? identityEl.textContent : '' });
    fitResultStep2();
  }catch(err){
    console.warn('AI 해석 불러오기 실패 — 인터넷 없이 만든 기본 문장으로 대신:', err);
    // 전시장 인터넷이 끊겨도 빈칸이 되지 않게, 실제로 겹친 키워드로 문장을 만든다
    const allPicked = picks.flat();
    const w = (matched.weaknessCanon || []).filter(k => allPicked.includes(k));
    const p = (matched.personalityCanon || []).filter(k => allPicked.includes(k));
    const both = [...w, ...p].slice(0, 3);
    explEl.textContent = both.length
      ? `${matched.name}와(과) 당신은 ${both.join(', ')}이라는 결을 함께 지녔어요. ${w.length ? '특히 ' + w[0] + '은(는) 영웅에게도 약점이었지만, 그 약점을 안고서도 끝까지 싸웠다는 점이 두 사람을 닮게 만듭니다.' : '서로 다른 시대에 있었지만 같은 방식으로 세상을 대하고 있어요.'}`
      : `${matched.name}은(는) 당신이 고른 답들과 가장 가까운 영웅이에요.`;
    lineEl.textContent = '';
    if(identityEl) identityEl.textContent = '';
    attachAiToArchive({ aiExplanation: explEl.textContent, aiFallback: true });   // 인터넷이 없어 키워드로 만든 문장
  }
}

/* 기존 archive/index.html("기록의 벽")이 쓰는 localStorage 키·스키마를 그대로 따른다.
   archive와 이 test 페이지가 같은 오리진(같은 로컬 서버)에서 열려야 데이터가 공유된다. */
const ARCHIVE_KEY = 'projectR_archive';
let lastArchiveTs = null;   // 방금 저장한 기록 — AI 답이 오면 같은 기록에 덧붙인다
function attachAiToArchive(fields){
  try{
    if(!lastArchiveTs) return;
    const arr = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
    const rec = arr.find(r => r.ts === lastArchiveTs);
    if(!rec) return;
    Object.assign(rec, fields);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(arr));
  }catch(e){}
}
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
      freeText: subjectiveText,
      // 닮은 정도 = (겹친 약점×2 + 겹친 성격×1) ÷ (이 영웅의 약점 수×2 + 성격 수×1) — 매칭 점수와 같은 가중치
      similarity: (() => {
        const w = matched.weaknessCanon || [], p = matched.personalityCanon || [];
        const max = w.length * 2 + p.length;
        return max ? Math.round((w.filter(k => allPicked.includes(k)).length * 2 + p.filter(k => allPicked.includes(k)).length) / max * 100) : null;
      })()
    };
    const arr = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
    arr.push(record);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(arr));
    lastArchiveTs = record.ts;
  }catch(err){
    console.warn('기록 보관 실패 (localStorage 접근 불가):', err);
  }
}

/* ---------- 5. 액션 ---------- */
// NEXT 버튼 — 살짝 커지는 게 보이도록 잠깐 뒤에 실행 (연속 클릭은 무시)
function pressThen(btn, fn){
  if(btn.classList.contains('pressed')) return;
  btn.classList.add('pressed');
  setTimeout(() => { btn.classList.remove('pressed'); fn(); }, 220);
}
/* Page 6로 들어가기 (Page 5 다음, 모자이크 화면 뒤) */
function enterQ6(){
  goto('q6');
  setLogoPos(document.getElementById('qIntroQ6'), 5);
  renderQ6Type();
  refreshFinishBtn();
  // Q1~Q5와 같은 순서: 설명(q-intro) 3초 -> 선택지 자리(여기선 입력창)가 있는 q-body.
  // 텍스트 입력창은 보이기 전엔 포커스를 줘봐야 의미 없으니, 진짜 보이기 시작한 뒤에 포커스한다.
  revealAfterIntro('qIntroQ6', 'qBodyQ6', 1500, () => {
    fitRecapText(document.getElementById('qRecapTextQ6'), document.getElementById('qRecapTextQ6').dataset.text);
    renderQ6Type();
    setTimeout(() => document.getElementById('subjectiveInput').focus(), 30);
  });
}

/* 페이지 사이 모자이크 화면 — 화면 전체에 지금까지의 답으로 좁혀진 레인저만 STAGE_MS 동안 */
const STAGE_MS = 1800;
let stageBusy = false;
function showMosaicStage(answeredCount, rate, colorMix, then){
  if(stageBusy) return;
  stageBusy = true;
  const st = document.getElementById('mosaicStage');
  document.getElementById('stageProgress').style.width = (Q_PROGRESS[Math.min(answeredCount, Q_PROGRESS.length) - 1] * 100) + '%';
  st.classList.add('on');
  flashThenCycle(document.getElementById('stageCanvas'), computePool(answeredCount), rate, colorMix);
  typeSound.whoosh();
  setTimeout(() => {
    then();
    st.classList.remove('on');
    stopCandidateCycle();
    stageBusy = false;
  }, STAGE_MS);
}

function handleAction(action){
  if(action==='camstart'){
    typeSound.unlock(); typeSound.clack('start');
    beginCamera();
  } else if(action==='tutorial-done'){
    // 버튼이 살짝 커지는 게 보이도록 잠깐 뒤에 넘어간다
    pressThen(document.getElementById('tutorialNextBtn'), () => goto('open'));
  } else if(action==='start'){
    // 컬러 + 닉네임을 합쳐서 최종 아이디로 쓴다 (예: "레드" + "지짱" → "지짱 레드")
    const raw = (document.getElementById('nicknameInput').value || '').trim();
    if(!raw || !selectedColor) return;
    pressThen(document.getElementById('startBtn'), () => {
      selfName = raw;
      nickname = raw + ' ' + selectedColor;
      goto('story'); // 시작 스토리 → START 를 누르면 Q1
    });
  } else if(action==='story-done'){
    pressThen(document.getElementById('storyStartBtn'), () => {
      clearStoryTimers();
      qIndex = 0; renderQuestion(); slideTo('q');   // Page 1이 오른쪽에서 밀려 들어온다
    });
  } else if(action==='next'){
    if(qIndex < Q_META.length-1){
      // 한 화면에 한 단계: 답을 마치면 좁혀진 레인저 모자이크만 잠깐 보여준 뒤 다음 Page로
      showMosaicStage(qIndex + 1, MOSAIC_RATES[qIndex + 1], COLOR_MIX[qIndex + 1], () => { qIndex++; renderQuestion(); });
    } else {
      showMosaicStage(Q_META.length, Q6_RATE, Q6_COLOR_MIX, () => enterQ6());
    }
  } else if(action==='finish'){
    subjectiveText = (document.getElementById('subjectiveInput').value || '').trim();
    if(!subjectiveText) return; // 미기입 시 넘어가지 않음
    showResult(); goto('result');   // 로딩 화면 대신 결과의 룰렛이 기다리는 시간을 채운다
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
      goto('open'); // Q1보다 더 이전은 이름 짓기 화면
    }
  } else if(action==='restart'){
    picks = [[],[],[],[],[]]; qIndex = 0; matched = null; subjectiveText = ''; nickname = '';
    selfName = ''; selectedColor = null;
    document.querySelectorAll('#colorGrid .color-swatch').forEach(s => s.classList.remove('selected'));
    document.getElementById('nicknameInput').value = '';
    document.getElementById('subjectiveInput').value = '';
    document.getElementById('combinedIdPreview').textContent = '';
    stopCandidateCycle();
    refreshStartBtn();
    refreshFinishBtn();
    goto('camstart');   // 처음으로 = 맨 첫 화면(로고 + 엔터키)
  } else if(action==='result-next'){
    handleAction('restart');   // 결과 → 처음으로
  } else if(action==='reset-q5'){
    resetQ5();
  } else if(action==='reset'){
    resetCurrentScreen();
  }
}

// Q5 — 펀치는 "아직 선택 안 된 키워드"에만 반응해서, 다른 질문들처럼 다시 눌러 취소하는 게
// 안 된다(이미 날아간 키워드는 화면에서 사라져서 다시 펀치할 대상 자체가 없다). 그래서 잘못
// 날려보냈을 때 이 질문에서 고른 걸 통째로 되돌리는 버튼을 따로 둔다.
// 모든 화면 우하단 리셋 버튼 — 지금 보고 있는 화면의 입력/선택만 처음 상태로 되돌린다
function resetCurrentScreen(){
  const active = id => document.getElementById(id).classList.contains('active');
  if(active('screen-tutorial')){ resetTutorial(); }
  else if(active('screen-open')){
    selectedColor = null;
    document.querySelectorAll('#colorGrid .color-swatch').forEach(s => s.classList.remove('selected'));
    document.getElementById('nicknameInput').value = '';
    document.getElementById('combinedIdPreview').textContent = '';
    refreshStartBtn();
    resetOpenPreview();
  }
  else if(active('screen-q')){ picks[qIndex] = []; renderQuestion(); }
  else if(active('screen-q6')){ document.getElementById('subjectiveInput').value = ''; refreshFinishBtn(); }
  else if(active('screen-result')){ handleAction('restart'); }
}

function resetQ5(){
  picks[4] = [];
  document.querySelectorAll('#kwGrid .kw').forEach(el => {
    el.classList.remove('selected', 'punched', 'hit1', 'hit2', 'shake');
    delete el.dataset.hits;
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
  // Q1(드래그)·Q2(집게로 붙들기)·Q3(칠하기)·Q5(세 번 펀치)는 클릭으로 선택 안 됨 — 칠하고 손을 뗄 때의 클릭이 선택을 뒤집지 않게
  if(kw && !onQ1 && !kw.matches('.q3-cell, .brick, .bead')){ toggleKeyword(kw); return; }
  const tool = e.target.closest('[data-tool]'); // Q3 브러시/지우개 전환
  if(tool){ setPaintMode(paintMode === tool.dataset.tool ? 'none' : tool.dataset.tool); return; } // 같은 도구를 한 번 더 누르면 내려놓기(커서 그림 사라짐)
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
  startBtn.classList.toggle('visible', ok);   // 색 + 이름이 다 있어야 NEXT가 나타난다
  nicknameInput.disabled = !selectedColor;     // 색을 고르기 전엔 이름 입력 잠금
  document.getElementById('screen-open').classList.toggle('can-type', !!selectedColor); // 캐럿 표시
  document.getElementById('screen-open').classList.toggle('name-empty', !nicknameInput.value.trim()); // 비었으면 "닉네임을 입력하세요"
  renderNameType();
  updateCombinedIdPreview();
}

/* 가운데 노란 타이포 — 입력한 글자의 실제 잉크 영역을 재서(canvas measureText) 칸 높이를 꽉 채우고,
   가로는 원래 비율대로 두되 칸보다 넓어지면 칸 폭에 맞게 줄인다. */
const nameMeasure = document.createElement('canvas').getContext('2d');
async function renderNameType(){
  const svg = document.getElementById('nameType');
  const txt = document.getElementById('nameTypeText');
  const cell = document.getElementById('nameCell');
  const value = nicknameInput.value;
  txt.textContent = value;
  if(!value.trim()){ svg.style.display = 'none'; return; }
  try{ await document.fonts.load('1000px AGSuperBlack', value); }catch(e){}
  if(nicknameInput.value !== value) return; // 기다리는 사이 또 입력됨 → 최신 호출이 그린다
  nameMeasure.font = '1000px AGSuperBlack';
  const m = nameMeasure.measureText(value);
  const x0 = -m.actualBoundingBoxLeft, x1 = m.actualBoundingBoxRight;
  const y0 = -m.actualBoundingBoxAscent, y1 = m.actualBoundingBoxDescent;
  const iw = Math.max(1, x1 - x0), ih = Math.max(1, y1 - y0);
  svg.setAttribute('viewBox', `${x0} ${y0} ${iw} ${ih}`);
  const box = cell.getBoundingClientRect();
  const naturalW = box.height * iw / ih;               // 높이를 칸에 맞췄을 때의 원래 폭
  svg.style.display = 'block';
  // 캐럿이 글자 뒤에 붙으므로 그만큼 뺀 폭 안에서 줄어든다
  const caret = document.getElementById('nameCaret');
  const cs = getComputedStyle(caret);
  const caretSpace = caret.offsetWidth + parseFloat(cs.marginLeft || 0);
  svg.style.width = Math.max(0, Math.min(box.width - caretSpace, naturalW)) + 'px';
}
window.addEventListener('resize', () => { if(document.getElementById('screen-open').classList.contains('active')) renderNameType(); });
// 이름 짓기 화면에서 아무 키나 누르면 입력칸으로 (포커스를 놓쳐도 바로 칠 수 있게)
document.addEventListener('keydown', (e) => {
  if(!document.getElementById('screen-open').classList.contains('active')) return;
  if(document.getElementById('screen-open').dataset.step !== '3') return;
  if(nicknameInput.disabled || document.activeElement === nicknameInput) return;
  if(e.key.length === 1 || e.key === 'Backspace' || e.key === 'Process') nicknameInput.focus();
});
nicknameInput.addEventListener('input', () => {
  refreshStartBtn();
  // 치는 동안엔 캐럿이 켜진 상태로 보이게 깜빡임을 처음부터 다시 시작
  const caret = document.getElementById('nameCaret');
  caret.style.animation = 'none'; void caret.offsetWidth; caret.style.animation = '';
});
nicknameInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') handleAction('start');
  // 사용자가 직접 치는 키마다 '타닥' (한글 조합 중엔 key가 'Process'로 들어온다)
  else if(!e.repeat && (e.key.length === 1 || e.key === 'Process' || e.key === 'Backspace' || e.key === 'Delete')) typeSound.click('key');
});

/* Q6 주관식 — 입력 전엔 결과 보기 버튼 비활성 */
const subjectiveInput = document.getElementById('subjectiveInput');
const finishBtn = document.getElementById('finishBtn');
function refreshFinishBtn(){
  const ok = subjectiveInput.value.trim().length > 0;
  finishBtn.disabled = !ok;     // 한 글자라도 쓰면 다음 화살표가 빨갛게
  renderQ6Type();
}
subjectiveInput.addEventListener('input', refreshFinishBtn);

/* Page 6 입력 — 실제 입력은 숨은 textarea가 받고, 화면에는 AG 빨간 글씨 + 큰 캐럿으로 보여준다.
   처음엔 캐럿 높이 그대로(시안 41.4vh) 크게 쓰이다가, 글이 길어져 상자를 넘치면 상자에 맞을 때까지 글자가 줄어든다. */
const q6Type = document.getElementById('q6Type');
const q6Text = document.getElementById('q6Text');
let q6TypingTimer = null;
function renderQ6Type(){
  if(!q6Type) return;
  q6Text.textContent = subjectiveInput.value;
  const box = q6Type.getBoundingClientRect();
  if(!box.height) return;   // 아직 안 보이는 중
  const max = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--q6-caret-h')) * window.innerHeight / 100;
  let fs = max;
  q6Type.style.setProperty('--q6-fs', fs + 'px');
  while(fs > 12 && (q6Type.scrollHeight > q6Type.clientHeight + 1 || q6Type.scrollWidth > q6Type.clientWidth + 1)){
    fs *= 0.92;
    q6Type.style.setProperty('--q6-fs', fs + 'px');
  }
  q6Type.classList.add('typing');            // 치는 동안엔 깜빡이지 않고 켜져 있게
  clearTimeout(q6TypingTimer);
  q6TypingTimer = setTimeout(() => q6Type.classList.remove('typing'), 600);
}
document.getElementById('q6Write').addEventListener('click', () => subjectiveInput.focus());
document.getElementById('qRecapTextQ6').dataset.text = document.getElementById('qRecapTextQ6').textContent;
window.addEventListener('resize', () => { if(document.getElementById('screen-q6').classList.contains('active')) renderQ6Type(); });

/* Q1 드래그-투-바구니 (마우스 테스트용 — 실제 전시에서는 카메라 손동작으로 동일 처리) */
document.addEventListener('dragstart', (e) => {
  const kw = e.target.closest('.kw');
  if(kw){ e.dataTransfer.setData('text/plain', kw.dataset.kw); setBasketOpen(true); }
});
document.addEventListener('dragend', () => setBasketOpen(false));
const basketZone = document.getElementById('basketZone');
basketZone.addEventListener('dragover', (e) => { e.preventDefault(); basketZone.classList.add('drag-over'); });
basketZone.addEventListener('dragleave', () => basketZone.classList.remove('drag-over'));
basketZone.addEventListener('drop', (e) => {
  e.preventDefault();
  basketZone.classList.remove('drag-over');
  setBasketOpen(false);
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
let dwellLocked = new Set(); // Q2 — 방금 바뀐 구슬(손을 뗄 때까지 잠금)
const DWELL_MS = 500; // Q2 집게로 잡고 있어야 하는 시간
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
// 색감(rgba(167,0,0,...) — 연지가 준 픽셀 로고/버튼의 고정 빨강 #a70000)을 써서 사이트 전체의 "빛" 톤을 그대로 따른다.
function applyDwellGlow(el, p){
  if(el.classList.contains('bead')){ el.style.setProperty('--glow', p.toFixed(3)); return; }   // 구슬: 안에서 하얀 빛이 차오른다
  el.style.borderColor = `rgba(167,0,0,${0.35 + p * 0.65})`;
  el.style.color = `rgba(167,0,0,${0.55 + p * 0.45})`;
  el.style.background = `rgba(167,0,0,${p * 0.12})`;
  el.style.boxShadow = `0 0 ${(p * 22).toFixed(1)}px rgba(167,0,0,${(p * 0.4).toFixed(2)})`;
}
function resetDwellGlow(el){
  if(!el) return;
  el.style.removeProperty('--glow');
  el.style.borderColor = '';
  el.style.color = '';
  el.style.background = '';
  el.style.boxShadow = '';
}

/* Q3 — 펜을 든 채(주먹) 칸 위를 문지르면, 손이 지나간 길 그대로 아이디에서 고른 색으로 칠해진다.
   칸마다 24×24 픽셀 캔버스가 있고, 직전 위치→지금 위치를 픽셀 붓으로 잇는다(빠르게 움직여도 끊기지 않게).
   칸의 PAINT_SELECT_AT 이상이 칠해지면 선택, 지우개로 PAINT_RELEASE_AT 아래까지 지우면 선택 해제. */
const PAINT_RES = 24;            // 칸 하나의 픽셀 수(가로=세로) — 작을수록 픽셀이 굵다
const PAINT_BRUSH = 3.2;         // 붓 반지름(픽셀 칸 기준)
const PAINT_SELECT_AT = 0.6;     // 60% 칠하면 선택
const PAINT_RELEASE_AT = 0.3;    // 30% 아래로 지우면 선택 해제
let paintTarget = null;          // 직전 프레임에 칠하던 칸
let paintLast = null;            // 직전 프레임 손 위치 {x,y} (화면 좌표)
let paintMode = 'none';          // 'none'(도구 없음) | 'brush' | 'erase'

function setPaintMode(mode){
  paintMode = mode;
  const brushBtn = document.getElementById('brushTool');
  const eraseBtn = document.getElementById('eraseTool');
  if(brushBtn) brushBtn.classList.toggle('active', mode === 'brush');
  if(eraseBtn) eraseBtn.classList.toggle('active', mode === 'erase');
  updateCursorMode(); // Q3 커서가 고른 도구(펜/지우개) 그림으로, 도구가 없으면 기본 커서로
}
function paintColor(){ return SWATCH_COLORS[selectedColor] || '#a70000'; }   // 이름 짓기에서 고른 색
function fillPaintCanvas(kw){
  const cv = kw.querySelector('.paint-canvas'); if(!cv) return;
  const c = cv.getContext('2d'); c.fillStyle = paintColor(); c.fillRect(0, 0, PAINT_RES, PAINT_RES);
  kw.classList.toggle('ink-dark', isDarkColor(paintColor()));
  setPaintMeter(kw, 1);
}
// 칸 아래 진행 막대 — 얼마나 칠했는지(선택 기준 60%까지 몇 % 왔는지) 바로 보이게
function setPaintMeter(kw, cov){
  kw.style.setProperty('--fill', Math.min(1, cov / PAINT_SELECT_AT).toFixed(3));
}
function paintCoverage(cv){
  const d = cv.getContext('2d').getImageData(0, 0, PAINT_RES, PAINT_RES).data;
  let n = 0; for(let i = 3; i < d.length; i += 4) if(d[i] > 0) n++;
  return n / (PAINT_RES * PAINT_RES);
}
function updateQ3Paint(kw, x, y, held){
  const eligible = kw && (kw.classList.contains('selected') || picks[2].length < MAX_PICK || paintMode === 'erase');
  if(!held || !eligible || paintMode === 'none'){
    paintTarget = null; paintLast = null;
    typeSound.pen(0);
    return;
  }
  const cv = kw.querySelector('.paint-canvas'); if(!cv) return;
  const r = kw.getBoundingClientRect();
  const toLocal = (px, py) => [(px - r.left) / r.width * PAINT_RES, (py - r.top) / r.height * PAINT_RES];
  const [x1, y1] = toLocal(x, y);
  const [x0, y0] = (paintTarget === kw && paintLast) ? toLocal(paintLast.x, paintLast.y) : [x1, y1];
  const c = cv.getContext('2d');
  c.globalCompositeOperation = paintMode === 'erase' ? 'destination-out' : 'source-over';
  c.fillStyle = paintColor();
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for(let s = 0; s <= steps; s++){
    const cx = x0 + (x1 - x0) * s / steps, cy = y0 + (y1 - y0) * s / steps;
    // 픽셀 붓: 반지름 안의 칸을 정사각 픽셀로 찍는다
    for(let py = Math.floor(cy - PAINT_BRUSH); py <= Math.ceil(cy + PAINT_BRUSH); py++){
      for(let px = Math.floor(cx - PAINT_BRUSH); px <= Math.ceil(cx + PAINT_BRUSH); px++){
        if(Math.hypot(px + .5 - cx, py + .5 - cy) <= PAINT_BRUSH) c.fillRect(px, py, 1, 1);
      }
    }
  }
  c.globalCompositeOperation = 'source-over';
  // 만년필 소리 — 직전 프레임에서 움직인 거리(화면 폭 기준 속도)만큼
  const now = performance.now();
  if(paintTarget === kw && paintLast && paintLast.t){
    const dt = Math.max(1, now - paintLast.t) / 1000;
    const speed = Math.hypot(x - paintLast.x, y - paintLast.y) / window.innerWidth / dt;
    typeSound.pen(Math.min(1, speed / PEN_FULL_SPEED), paintMode === 'erase' ? 'erase' : 'pen');
  }
  paintTarget = kw; paintLast = { x, y, t: now };
  kw.classList.toggle('ink-dark', isDarkColor(paintColor()));

  const cov = paintCoverage(cv);
  setPaintMeter(kw, cov);
  const isSelected = kw.classList.contains('selected');
  if(cov >= PAINT_SELECT_AT && !isSelected){          // 충분히 칠함 — 선택 (번쩍 + 달칵)
    toggleKeyword(kw);
    if(kw.classList.contains('selected')){
      fillPaintCanvas(kw);   // 선택 표시 = 칸 전체를 칠하는 색으로 채움
      kw.classList.remove('just-picked'); void kw.offsetWidth; kw.classList.add('just-picked');
      const r = kw.getBoundingClientRect();
      typeSound.clack('next', ((r.left + r.width / 2) / window.innerWidth * 2 - 1) * CLACK_PAN);
    }
  }
  else if(cov < PAINT_RELEASE_AT && isSelected) toggleKeyword(kw);      // 지워짐 — 선택 해제
}

/* Q5 — 벽돌은 세 번 쳐야 깨진다: 1번 금 감(B) → 2번 부서짐(C) → 3번 날아가며 선택 */
const BRICK_HITS = 3;
const BRICK_HIT_GAP = 450;   // 같은 벽돌을 다시 칠 수 있기까지(ms) — 한 번 휘두를 때 여러 번 맞지 않게
let lastPunchAt = 0;
function punchBrick(el){
  const now = performance.now();
  if(now - lastPunchAt < BRICK_HIT_GAP) return;   // 방금 친 주먹의 여세 — 무시
  lastPunchAt = now;
  const hits = (+el.dataset.hits || 0) + 1;
  el.dataset.hits = hits;
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  const r = el.getBoundingClientRect();
  typeSound.clack(hits >= BRICK_HITS ? 'start' : 'next', ((r.left + r.width / 2) / window.innerWidth * 2 - 1) * CLACK_PAN);   // 맞을 때마다 쿵 (마지막은 더 묵직하게)
  el.classList.toggle('hit1', hits === 1);
  el.classList.toggle('hit2', hits === 2);
  if(hits >= BRICK_HITS){ el.classList.remove('hit1', 'hit2'); toggleKeyword(el); }
}
function handlePointerActivity(x, y, held){
  const onQScreen = document.getElementById('screen-q').classList.contains('active');
  if(!onQScreen){
    lastPointer = { x, y, t: performance.now() };
    dwellTarget = null;
    paintTarget = null; paintLast = null;
    punchHistory = [];
    return;
  }

  if(qIndex === 1){
    // Q2 — 집게 없이 손 위치 그대로 붙든다
  }

  if(qIndex === 3){ // Q4 — 눈 마스크가 커서를 따라간다.
    // 위치/크기를 매 프레임 kwGrid 기준으로 다시 맞춘다 — 한 번만 재보고 고정해두면
    // 폰트 로딩/레이아웃이 살짝 밀릴 때 버튼 오른쪽 끝이 마스크 밖으로 빠져나와 보일 수 있어서,
    // 여유 패딩까지 더해 버튼 영역을 항상 넉넉히 덮게 한다.
    const mask = document.getElementById('eyeMask');
    // 검은 판을 한 번 더 덮는 어둠 — 야광봉 자리만 동그랗게 걷혀서 그 아래 키워드가 보인다
    const mr = mask.getBoundingClientRect();
    const hole = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--q4-hole')) * window.innerWidth / 100;
    mask.style.background = `radial-gradient(circle ${hole}px at ${x - mr.left}px ${y - mr.top}px, transparent 0, transparent ${hole * 0.55}px, #000 ${hole}px)`;
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
      const eligible = !fEl.classList.contains('selected') && picks[1].length < MAX_PICK;   // 한 번 켜진 구슬은 다시 붙들어도 안 꺼진다 (취소는 RE로)
      // 한 번 켜지거나 꺼진 구슬은 손을 떼거나 벗어날 때까지 다시 바뀌지 않는다 (계속 붙들고 있어도 1초 뒤 다시 꺼지지 않게)
      if(dwellLocked.has(fEl) && !(held && kw === fEl)) dwellLocked.delete(fEl);
      const isCurrent = held && kw === fEl && eligible && !dwellLocked.has(fEl);
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
        toggleKeyword(fEl); // 다 채움 — 선택 확정(또는 해제)
        dwellLocked.add(fEl);
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
  if(qIndex === 2 && kw && kw.classList.contains('q3-cell')){
    updateQ3Paint(kw, x, y, held);
  } else if(qIndex === 2){
    paintTarget = null; paintLast = null;
    typeSound.pen(0);
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
      punchBrick(kw);
      punchHistory = []; // 한 번 맞춘 여세로 바로 옆 벽돌까지 잇달아 맞지 않도록 기록 초기화
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
let mouseSeen = false;
document.addEventListener('mousemove', () => { mouseSeen = true; });
function pollMouse(){
  handlePointerActivity(mouseX, mouseY, mouseHeld);
  syncBasketFront();
  if(!camOn){
    // 카메라 없이 마우스로 테스트할 때도 "손 위치" 커서를 똑같이 보여주고, 누름=주먹으로 취급한다
    if(mouseSeen){
      document.body.classList.add('hand-mouse');
      cursor.style.display = 'block';
      cursor.style.left = mouseX + 'px';
      cursor.style.top = mouseY + 'px';
      cursor.classList.toggle('fist', mouseHeld);
    }
    updateQ1Drag(mouseX, mouseY, mouseHeld);
  }
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
let q1HoverEl = null;
let dragGhost = null;

// 바구니 그래픽: 키워드를 끌고 있는 동안 B(열림), 선택이 확정/취소되면 A(닫힘)
let lastRejectAt = 0;
function rejectBasket(){
  const now = performance.now();
  if(now - lastRejectAt < 700) return;
  lastRejectAt = now;
  const b = document.getElementById('basketZone');
  b.classList.remove('reject'); void b.offsetWidth; b.classList.add('reject');
  setTimeout(() => b.classList.remove('reject'), 480);
}
function setBasketOpen(on){
  if(on && qIndex === 0 && picks[0].length >= MAX_PICK) on = false; // 가득 찼으면 열리지 않는다(A 고정)
  const b = document.getElementById('basketZone');
  if(b) b.classList.toggle('open', !!on);
  syncBasketFront();
}
// 바구니 C(앞면): 열린 바구니(B)와 같은 자리에 맨 위로 겹쳐 보이게 한다 (떨어지는 키워드 위, A/B 아래가 아니라 "위")
function syncBasketFront(){
  const f = document.getElementById('basketFront');
  const b = document.getElementById('basketZone');
  if(!f || !b) return;
  const show = b.classList.contains('open') && qIndex === 0 && document.getElementById('screen-q').classList.contains('active');
  if(!show){ f.classList.remove('on'); return; }
  const r = b.getBoundingClientRect();
  f.style.left = r.left + 'px'; f.style.top = r.top + 'px';
  f.style.width = r.width + 'px'; f.style.height = r.height + 'px';
  f.classList.add('on');
}
// 떨어지는 키워드가 바구니 세로 1/3 지점(열린 바구니의 보이는 부분 기준)까지 들어오고, 가로로 바구니 안에 있으면 "담긴 것"
function ghostInBasket(gr){
  const br = basketZone.getBoundingClientRect();
  const left = br.left + br.width * 0.096, right = br.left + br.width * 0.903;
  const visTop = br.top + br.height * 0.083, visH = br.height * 0.861;
  const line = visTop + visH * 0.8; // 열린 바구니 보이는 부분의 아래에서 1/5 지점(깊이 80%)까지 들어와야 담긴다
  const cx = (gr.left + gr.right) / 2;
  return cx > left && cx < right && gr.bottom >= line && gr.top < br.bottom;
}
function spawnGhost(sourceEl, x, y){
  setBasketOpen(true);
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
    const overlap = ghostInBasket(gr);

    if(overlap){
      resolved = true;
      basketZone.classList.remove('drag-over');
      ghostEl.remove();
      setBasketOpen(false);
      toggleKeyword(dropped); // 선택 확정 — 떨어지다 바구니에 닿은 순간 담긴다
      return;
    }
    basketZone.classList.toggle('drag-over', false);
    if(y - gr.height/2 > window.innerHeight + 40){
      // 바구니를 못 만나고 화면 밖으로 떨어짐 — 취소, 제자리로 복귀
      resolved = true;
      basketZone.classList.remove('drag-over');
      ghostEl.remove();
      setBasketOpen(false);
      dropped.classList.remove('picked-source');
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Page 1 "Drag and Drop!" — 손을 올리거나 잡은 레인저 바로 오른쪽에 (시안: 몸 오른쪽 1.19vw, 머리에서 8.07vh 아래)
function placeDnd(target){
  const d = document.getElementById('qDnd');
  if(!target){ d.classList.remove('on'); return; }
  const r = target.getBoundingClientRect();
  d.style.left = (r.right + window.innerWidth * 0.0119) + 'px';
  d.style.top = (r.top + window.innerHeight * 0.0807) + 'px';
  d.classList.add('on');
}
function updateQ1Drag(x, y, fisted){
  const onQ1 = qIndex === 0 && document.getElementById('screen-q').classList.contains('active');
  if(!onQ1){
    if(draggingKeyword){
      draggingKeyword.classList.remove('picked-source'); // 화면 전환 등 강제 취소 — 제자리로 복귀
      removeGhostEl();
      draggingKeyword = null;
    }
    setBasketOpen(false);
    basketZone.classList.remove('drag-over');
    if(q1HoverEl){ q1HoverEl.classList.remove('dwell-hover'); q1HoverEl = null; }
    placeDnd(null);
    return;
  }

  const el = document.elementFromPoint(x, y);
  const overBasket = !!(el && el.closest('#basketZone'));
  const overKw = el ? el.closest('.kw') : null;

  // 손(카메라)이 레인저 위에 올라가면 A -> B 그래픽으로 (마우스는 CSS :hover가 처리)
  if(q1HoverEl !== overKw){
    if(q1HoverEl) q1HoverEl.classList.remove('dwell-hover');
    q1HoverEl = overKw;
    if(overKw) overKw.classList.add('dwell-hover');
  }

  placeDnd(dragGhost || (overKw && !overKw.classList.contains('selected') ? overKw : null));

  if(!draggingKeyword){
    if(fisted && overKw && !overKw.classList.contains('selected')){
      if(picks[0].length >= MAX_PICK){
        rejectBasket(); // 이미 5개 — 바구니는 닫힌 채로 떨며 거부
      } else {
        draggingKeyword = overKw;
        spawnGhost(overKw, x, y);
      }
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
        setBasketOpen(false);
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

if(/[?&]debug/.test(location.search)) document.body.classList.add('debug');
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
  if(camOn){ goto('tutorial'); return; }   // 결과 화면에서 처음으로 돌아온 경우 — 카메라는 이미 켜져 있다
  camStarting = true;
  camStatus.textContent = '카메라: 로딩 중…';
  showCamLoading(true);   // 엔터 누르자마자 — 손 인식 준비가 끝날 때까지
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
    showCamLoading(false);
  }
}
/* 로딩 화면 — 움직임은 CSS(opacity/transform)만 써서, 손 인식 준비로 페이지가 바빠도 멈추지 않고 돈다 */
function showCamLoading(on){
  let el = document.getElementById('camLoading');
  if(!el){
    el = document.createElement('div');
    el.id = 'camLoading';
    el.innerHTML = '<div class="cl-title">LOADING</div><div class="cl-dots"><i></i><i></i><i></i><i></i><i></i></div><p class="cl-sub">카메라와 손 인식을 준비하고 있어요</p>';
    document.body.appendChild(el);
  }
  el.classList.toggle('on', on);
}

/* 손 인식(MediaPipe) — 인터넷 없이도 돌도록 files/vendor/mediapipe/에 넣어둔 파일을 먼저 쓰고,
   없을 때만 인터넷(CDN)에서 받는다. hand_landmarker.task(모델)가 vendor 폴더에 있어야 완전히 오프라인. */
const MP_LOCAL = FILES + 'vendor/mediapipe/';
const MP_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/';
const MP_MODEL_CDN = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
async function localExists(url){
  try{ const r = await fetch(url, { method:'HEAD', cache:'no-store' }); return r.ok; }catch(e){ return false; }
}
// 손 인식 모델은 첫 화면이 열리면 미리 준비해둔다 — 엔터를 누를 땐 카메라만 켜면 되게
let landmarkerReady = null;
function prepareLandmarker(){
  if(!landmarkerReady) landmarkerReady = buildLandmarker().catch(e => { landmarkerReady = null; throw e; });
  return landmarkerReady;
}
window.addEventListener('load', () => setTimeout(() => prepareLandmarker().catch(e => console.warn('[손 인식] 미리 준비 실패 — 엔터 때 다시', e)), 1200));
async function startCam(){
  landmarker = await prepareLandmarker();
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
async function buildLandmarker(){
  let landmarker;
  const localLib = await localExists(MP_LOCAL + 'vision_bundle.js');
  const { HandLandmarker, FilesetResolver } = await import(localLib ? MP_LOCAL + 'vision_bundle.js' : MP_CDN + 'vision_bundle.mjs');
  const filesetResolver = await FilesetResolver.forVisionTasks(localLib ? MP_LOCAL + 'wasm' : MP_CDN + 'wasm');
  const localModel = await localExists(MP_LOCAL + 'hand_landmarker.task');
  console.log('[손 인식]', localLib ? '라이브러리: 로컬' : '라이브러리: 인터넷', '/', localModel ? '모델: 로컬' : '모델: 인터넷');
  // 손 인식을 그래픽카드(GPU)로 돌려서 CPU 부담(렉)을 줄인다 — 안 되는 컴퓨터면 예전처럼 CPU로
  const mpOptions = (delegate) => { const o = {
    baseOptions: {
      modelAssetPath: localModel ? MP_LOCAL + 'hand_landmarker.task' : MP_MODEL_CDN
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  }; o.baseOptions.delegate = delegate; return o; };
  // 오래된 컴퓨터는 GPU 준비가 끝나지 않고 멈춰 있을 수 있어서, 8초 안에 안 되면 CPU로 넘어간다
  const gpuTry = Promise.race([
    HandLandmarker.createFromOptions(filesetResolver, mpOptions('GPU')),
    new Promise((_, rej) => setTimeout(() => rej(new Error('GPU 준비 8초 초과')), 8000))
  ]);
  try{ landmarker = await gpuTry; console.log('[손 인식] GPU'); }
  catch(e){ console.warn('[손 인식] GPU 안 됨 → CPU', e); landmarker = await HandLandmarker.createFromOptions(filesetResolver, mpOptions('CPU')); }
  return landmarker;
}

let lastVideoTime = -1;
function trackHand(){
  if(!camOn) return;
  // 카메라는 1초에 30장인데 화면은 60번 그려진다 — 새 카메라 장면이 없으면 손 인식을 다시 안 돌린다
  if(video && video.readyState >= 2 && landmarker && video.currentTime === lastVideoTime){ requestAnimationFrame(trackHand); return; }
  if(video) lastVideoTime = video.currentTime;
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
      cursor.classList.toggle('fist', fisted); // 편 손 / 주먹 아이콘 전환
      updateGrip(x, y, openness);
      updateQ1Drag(x, y, fisted);
      handlePointerActivity(x, y, fisted);
      updateTutorial(openness);
      camStatus.textContent = '카메라: 켜짐 · 손 인식됨 · ' + (fisted ? '주먹 ✊' : '편 손 ✋');
    } else {
      cursor.classList.remove('ready');
      cursor.classList.remove('fist');
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
  target.style.borderColor = `rgba(167,0,0,${0.35 + p * 0.65})`;
  target.style.background = `rgba(167,0,0,${p * 0.12})`;
}
function applyCursorGlow(p){
  // 손 아이콘 커서: 주먹을 오므릴수록 살짝 커지고 붉게 빛난다 (background를 건드리면 아이콘이 지워지므로 filter만 사용)
  const scale = 1 + p * 0.25;
  cursor.style.setProperty('--s', scale);
  cursor.style.setProperty('--gr', (p * 8) + 'px');
  cursor.style.setProperty('--gc', `rgba(167,0,0,${0.3 + p * 0.6})`);
}

function resetGripVisual(target){
  if(!target) return;
  target.style.borderColor = '';
  target.style.background = '';
  cursor.style.setProperty('--s', 1);
  cursor.style.removeProperty('--gr');
  cursor.style.removeProperty('--gc');
}

function clearHover(){
  if(hoverTarget){
    hoverTarget.classList.remove('dwell-hover');
    resetGripVisual(hoverTarget);
  }
  hoverTarget = null; gripFired = false;
}
