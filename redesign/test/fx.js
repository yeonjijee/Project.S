/* fx.js — 화면 전체 그레인 이펙트
   화면 전체에 큐브(정육면체) 모양 그레인이 흩어져 있고, 커서(카메라 손 / 마우스)가 움직일 때마다
   그 자리에서 파동이 퍼져 나가며 그레인이 밀려났다 돌아온다. 주먹을 쥐는 순간/클릭은 더 큰 파동.
   디자인 값은 아래 CONFIG만 바꾸면 된다. 기능(script.js)과는 독립 — 커서 요소(#handCursor)의 위치를 읽기만 한다. */
(function(){
  const CONFIG = {
    CELL: 30,            // 그레인 간격(px) — 작을수록 촘촘 (개수↑ = 느려짐)
    JITTER: 0.35,        // 격자에서 흩어지는 정도 (0 = 줄 맞춤, 0.5 = 많이 흩어짐)
    SIZE: [7, 12],       // 큐브 한 변 크기 범위(px)
    TONES: ['#ececec', '#c4c4c4', '#8a8a8a'],  // 큐브 윗면 / 왼쪽면 / 오른쪽면 색 (밝→어둠)
    BASE_ALPHA: [0.35, 0.8],   // 평소 투명도 범위
    RIPPLE_EVERY: 46,    // 커서가 이만큼(px) 움직일 때마다 파동 하나 생성
    RIPPLE_SPEED: 360,   // 파동이 퍼지는 속도(px/초)
    RIPPLE_WIDTH: 70,    // 파동 띠 두께(px)
    RIPPLE_LIFE: 2.2,    // 파동 수명(초)
    PUSH: 16,            // 파동이 그레인을 밀어내는 거리(px)
    LIFT: 0.9,           // 파동 위에서 큐브가 커지는 정도 (0 = 안 커짐)
    CLICK_BOOST: 2.2,    // 주먹 쥠/클릭 파동 세기 배율
    MAX_RIPPLES: 14
  };

  const cv = document.getElementById('fxCanvas');
  if(!cv) return;
  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let W = 0, H = 0, grains = [];
  const ripples = [];

  // 큐브 스프라이트 — 한 번 그려두고 크기만 바꿔 찍는다
  const SPR = 64;
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = SPR;
  (function drawSprite(){
    const c = sprite.getContext('2d'), s = SPR, h = s / 2, q = s / 4;
    const poly = (pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill(); };
    poly([[h, 0], [s, q], [h, h], [0, q]], CONFIG.TONES[0]);        // 윗면
    poly([[0, q], [h, h], [h, s], [0, s - q]], CONFIG.TONES[1]);    // 왼쪽면
    poly([[h, h], [s, q], [s, s - q], [h, s]], CONFIG.TONES[2]);    // 오른쪽면
  })();

  function rand(a, b){ return a + Math.random() * (b - a); }
  function build(){
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    grains = [];
    const cols = Math.ceil(W / CONFIG.CELL) + 1, rows = Math.ceil(H / CONFIG.CELL) + 1;
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
      grains.push({
        x: (c + rand(-CONFIG.JITTER, CONFIG.JITTER)) * CONFIG.CELL,
        y: (r + rand(-CONFIG.JITTER, CONFIG.JITTER)) * CONFIG.CELL,
        s: rand(CONFIG.SIZE[0], CONFIG.SIZE[1]),
        a: rand(CONFIG.BASE_ALPHA[0], CONFIG.BASE_ALPHA[1])
      });
    }
  }

  function addRipple(x, y, power){
    ripples.push({ x, y, t0: performance.now(), p: power });
    if(ripples.length > CONFIG.MAX_RIPPLES) ripples.shift();
  }
  window.fxPulse = (x, y, power) => addRipple(x, y, power || 1);   // 다른 코드에서 부를 수 있게 공개

  // ---- 커서 위치: 손 커서(#handCursor)가 보이면 그 위치, 아니면 마우스 ----
  const handEl = document.getElementById('handCursor');
  let mx = -9999, my = -9999, lastX = null, lastY = null, travel = 0;
  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  function cursorPos(){
    if(handEl && handEl.style.display !== 'none' && handEl.style.left){
      return [parseFloat(handEl.style.left), parseFloat(handEl.style.top)];
    }
    return [mx, my];
  }
  // 주먹을 쥐는 순간(커서에 fist 클래스가 붙는 순간) / 클릭 → 큰 파동
  if(handEl) new MutationObserver(() => {
    if(handEl.classList.contains('fist')){ const [x, y] = cursorPos(); addRipple(x, y, CONFIG.CLICK_BOOST); }
  }).observe(handEl, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('mousedown', e => addRipple(e.clientX, e.clientY, CONFIG.CLICK_BOOST));

  function frame(now){
    requestAnimationFrame(frame);
    // 커서가 움직인 거리만큼 쌓아서 일정 거리마다 파동 생성
    const [cx, cy] = cursorPos();
    if(cx > -9000){
      if(lastX !== null){
        travel += Math.hypot(cx - lastX, cy - lastY);
        if(travel >= CONFIG.RIPPLE_EVERY){ addRipple(cx, cy, 1); travel = 0; }
      }
      lastX = cx; lastY = cy;
    }
    // 수명 지난 파동 제거
    while(ripples.length && (now - ripples[0].t0) / 1000 > CONFIG.RIPPLE_LIFE) ripples.shift();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const rs = ripples.map(r => {
      const age = (now - r.t0) / 1000;
      return { x: r.x, y: r.y, rad: age * CONFIG.RIPPLE_SPEED, amp: r.p * Math.pow(1 - age / CONFIG.RIPPLE_LIFE, 2) };
    });
    const sigma2 = CONFIG.RIPPLE_WIDTH * CONFIG.RIPPLE_WIDTH;
    for(let i = 0; i < grains.length; i++){
      const g = grains[i];
      let dx = 0, dy = 0, lift = 0;
      for(let k = 0; k < rs.length; k++){
        const r = rs[k];
        const vx = g.x - r.x, vy = g.y - r.y;
        const dist = Math.sqrt(vx * vx + vy * vy) || 1;
        const d = dist - r.rad;
        if(d > CONFIG.RIPPLE_WIDTH * 2.5 || d < -CONFIG.RIPPLE_WIDTH * 2.5) continue;
        const w = Math.exp(-(d * d) / sigma2) * r.amp;           // 파동 띠 위에서 가장 큼
        const wave = Math.cos((d / CONFIG.RIPPLE_WIDTH) * Math.PI) ; // 물결처럼 밀고 당김
        dx += (vx / dist) * CONFIG.PUSH * w * wave;
        dy += (vy / dist) * CONFIG.PUSH * w * wave;
        lift += w;
      }
      const size = g.s * (1 + CONFIG.LIFT * Math.min(lift, 1.2));
      ctx.globalAlpha = Math.min(1, g.a + lift * 0.25);
      ctx.drawImage(sprite, g.x + dx - size / 2, g.y + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  build();
  window.addEventListener('resize', build);
  requestAnimationFrame(frame);
})();
