/* fx.js — 화면 전체 "픽셀 그레인" 필터
   화면 위에 아주 작은 1:1 정사각형 그레인(그림자 없음, 3D 아님)이 촘촘히 깔려 있고, 커서(카메라 손 / 마우스)가
   움직일 때마다 파동이 퍼지며 그레인이 밀려났다 돌아온다. 주먹 쥠/클릭은 더 큰 파동.
   픽셀아트 느낌: 낮은 해상도 캔버스에 정수 좌표로만 그려서 확대(image-rendering:pixelated)한다.
   내용(텍스트·이미지) 위에 multiply로 씌우는 필터라 아래 요소는 그대로 보이고 클릭도 통과한다.
   디자인 값은 CONFIG만 바꾸면 된다. 기능(script.js)과는 독립 — #handCursor 위치를 읽기만 한다. */
(function(){
  const CONFIG = {
    PIXEL: 2,            // 픽셀 한 칸의 실제 크기(px) — 클수록 도트가 굵어짐 (캔버스를 1/PIXEL로 그려서 확대)
    STEP: 5,             // 그레인 간격(캔버스 칸 기준) — 작을수록 촘촘 (5 ≈ 화면에서 10px 간격)
    JITTER: 0,           // 0 = 격자 줄에 정확히 맞춤 (픽셀 느낌의 핵심 — 올리면 점박이처럼 흩어짐)
    SIZES: [1],          // 그레인 한 변(칸) — 전부 같은 크기
    TONES: ['rgba(0,0,0,0.035)', 'rgba(0,0,0,0.055)', 'rgba(0,0,0,0.08)'],  // 평소 그레인 색(투명한 먹색) — 흰색 없음
    LIT:   ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.16)'],   // 파동이 지나갈 때 진해지는 2단계(은은하게)
    RIPPLE_EVERY: 46,    // 커서가 이만큼(px) 움직일 때마다 파동 하나
    RIPPLE_SPEED: 380,   // 퍼지는 속도(px/초)
    RIPPLE_WIDTH: 70,    // 파동 띠 두께(px)
    RIPPLE_LIFE: 1.8,    // 파동 수명(초)
    PUSH: 1.3,           // 밀려나는 최대 거리(격자 칸 수) — 한 칸 단위로만 이동(반올림)
    CLICK_BOOST: 1.4,    // 주먹/클릭 파동 세기
    MAX_RIPPLES: 12
  };

  const cv = document.getElementById('fxCanvas');
  if(!cv) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, CW = 0, CH = 0, N = 0;
  let gx, gy, gs, gt;                 // 그레인 좌표/크기/색 번호 (캔버스 칸 단위)
  const ripples = [];
  const P = CONFIG.PIXEL;

  function build(){
    W = window.innerWidth; H = window.innerHeight;
    CW = Math.ceil(W / P); CH = Math.ceil(H / P);
    cv.width = CW; cv.height = CH;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const cols = Math.ceil(CW / CONFIG.STEP) + 1, rows = Math.ceil(CH / CONFIG.STEP) + 1;
    N = cols * rows;
    gx = new Int16Array(N); gy = new Int16Array(N); gs = new Uint8Array(N); gt = new Uint8Array(N);
    let i = 0;
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++, i++){
      gx[i] = Math.round(c * CONFIG.STEP + (Math.random() * 2 - 1) * CONFIG.JITTER);
      gy[i] = Math.round(r * CONFIG.STEP + (Math.random() * 2 - 1) * CONFIG.JITTER);
      gs[i] = CONFIG.SIZES[Math.floor(Math.random() * CONFIG.SIZES.length)];
      gt[i] = Math.floor(Math.random() * CONFIG.TONES.length);
    }
  }

  function addRipple(x, y, power){
    ripples.push({ x: x / P, y: y / P, t0: performance.now(), p: power });
    if(ripples.length > CONFIG.MAX_RIPPLES) ripples.shift();
  }
  window.fxPulse = (x, y, power) => addRipple(x, y, power || 1);

  // ---- 커서 위치: 손 커서(#handCursor)가 보이면 그 위치, 아니면 마우스 ----
  const handEl = document.getElementById('handCursor');
  let mx = -9999, my = -9999, lastX = null, lastY = null, travel = 0;
  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  function cursorPos(){
    if(handEl && handEl.style.display !== 'none' && handEl.style.left) return [parseFloat(handEl.style.left), parseFloat(handEl.style.top)];
    return [mx, my];
  }
  if(handEl) new MutationObserver(() => {
    if(handEl.classList.contains('fist')){ const [x, y] = cursorPos(); addRipple(x, y, CONFIG.CLICK_BOOST); }
  }).observe(handEl, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('mousedown', e => addRipple(e.clientX, e.clientY, CONFIG.CLICK_BOOST));

  const nTones = CONFIG.TONES.length;
  const buckets = [];                 // 색별로 모아서 그리면 fillStyle 변경이 적다
  for(let t = 0; t < nTones + 2; t++) buckets.push([]);
  const sigma2 = (CONFIG.RIPPLE_WIDTH / P) * (CONFIG.RIPPLE_WIDTH / P);
  const widthC = CONFIG.RIPPLE_WIDTH / P;

  function frame(now){
    requestAnimationFrame(frame);
    const [cx, cy] = cursorPos();
    if(cx > -9000){
      if(lastX !== null){
        travel += Math.hypot(cx - lastX, cy - lastY);
        if(travel >= CONFIG.RIPPLE_EVERY){ addRipple(cx, cy, 1); travel = 0; }
      }
      lastX = cx; lastY = cy;
    }
    while(ripples.length && (now - ripples[0].t0) / 1000 > CONFIG.RIPPLE_LIFE) ripples.shift();

    const rs = ripples.map(r => {
      const age = (now - r.t0) / 1000;
      return { x: r.x, y: r.y, rad: age * CONFIG.RIPPLE_SPEED / P, amp: r.p * Math.pow(1 - age / CONFIG.RIPPLE_LIFE, 2) };
    });
    for(let t = 0; t < nTones + 2; t++) buckets[t].length = 0;
    // buckets[t] = [x, y, size, x, y, size, ...]
    for(let i = 0; i < N; i++){
      let dx = 0, dy = 0, lit = 0;
      for(let k = 0; k < rs.length; k++){
        const r = rs[k];
        const vx = gx[i] - r.x, vy = gy[i] - r.y;
        const dist = Math.sqrt(vx * vx + vy * vy) || 1;
        const d = dist - r.rad;
        if(d > widthC * 2.5 || d < -widthC * 2.5) continue;
        const w = Math.exp(-(d * d) / sigma2) * r.amp;
        const wave = Math.cos((d / widthC) * Math.PI);
        dx += (vx / dist) * CONFIG.PUSH * w * wave;   // 칸 단위 (아래에서 반올림)
        dy += (vy / dist) * CONFIG.PUSH * w * wave;
        lit += w;
      }
      // 이동은 격자 칸 단위로만(0 또는 ±1칸) — 자유롭게 퍼지지 않고 줄 맞춰 한 칸씩 밀린다
      const ox = Math.round(dx) * CONFIG.STEP, oy = Math.round(dy) * CONFIG.STEP;
      const size = gs[i] + (lit > 0.6 ? 1 : 0);
      const b = lit > 0.45 ? nTones + 1 : (lit > 0.18 ? nTones : gt[i]);   // 파동 세기를 2단계로 끊어서 표시
      buckets[b].push(gx[i] + ox, gy[i] + oy, size);
    }
    ctx.clearRect(0, 0, CW, CH);
    for(let t = 0; t < nTones + 2; t++){
      const arr = buckets[t];
      if(!arr.length) continue;
      ctx.fillStyle = t < nTones ? CONFIG.TONES[t] : CONFIG.LIT[t - nTones];
      for(let j = 0; j < arr.length; j += 3) ctx.fillRect(arr[j], arr[j + 1], arr[j + 2], arr[j + 2]);
    }
  }

  build();
  window.addEventListener('resize', build);
  requestAnimationFrame(frame);
})();
