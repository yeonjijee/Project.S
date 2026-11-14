/* HERO LIST — 손(카메라) + 마우스 공통 조작
   · 손을 펴고 움직이면 커서만 이동, 카드 위에 올리면 선명해짐(마우스 hover와 같음)
   · 주먹 쥐었다 제자리에서 펴면 = 클릭 (카드 열기 / 링크 / 닫기)
   · 주먹 쥔 채로 끌면 = 화면을 잡고 끄는 스크롤 (위아래 = 페이지, 좌우 = 손이 있던 전대 줄)
   · 마우스도 빈 곳(카드 위도 OK)을 눌러 끌면 똑같이 스크롤 — 끈 다음엔 클릭으로 치지 않는다 */
(function(){
  const cursor = document.getElementById('handCursor');
  const DRAG_START_PX = 14;     // 마우스: 이만큼 넘게 움직여야 "끌기"로 본다 (그 전에 놓으면 클릭)
  const HAND_DRAG_START = 0.07; // 손: 화면 폭의 7% — 주먹을 쥐고 펼 때 손바닥 자체가 꽤 움직여서 넉넉하게
  const HAND_SETTLE_MS = 180;   // 손: 주먹 쥐고 이 시간 동안은 움직임을 무시(쥐는 동작의 흔들림), 그 뒤 위치를 기준점으로
  const HAND_SCROLL_GAIN = 1.6; // 손은 움직일 수 있는 폭이 좁아서 조금 더 크게 스크롤
  const FRICTION = 0.92;        // 놓은 뒤 미끄러지는 정도

  let down = null;              // {x, y, target, row, box, dragging, src}
  let velX = 0, velY = 0, lastX = 0, lastY = 0, lastT = 0, suppressClick = false;

  function scrollBox(){
    const ov = document.getElementById('modalOverlay');
    return (ov && ov.classList.contains('active')) ? ov.querySelector('.modal-box') : null;
  }
  function pointerDown(x, y, src, target){
    target = target || document.elementFromPoint(x, y);
    if(!target || target.closest('input, label.hl-search')) return;
    down = { x, y, target, row: scrollBox() ? null : target.closest('.series-scroll'), box: scrollBox(), dragging: false, src, t0: performance.now() };
    velX = velY = 0; lastX = x; lastY = y; lastT = performance.now();
  }
  function pointerMove(x, y){
    if(!down) return;
    if(down.src === 'hand' && performance.now() - down.t0 < HAND_SETTLE_MS){   // 쥐는 동안 흔들림 → 기준점만 갱신
      down.x = x; down.y = y; lastX = x; lastY = y; return;
    }
    const limit = down.src === 'hand' ? innerWidth * HAND_DRAG_START : DRAG_START_PX;
    if(!down.dragging && Math.hypot(x - down.x, y - down.y) > limit){
      down.dragging = true; document.body.classList.add('grabbing');
    }
    const now = performance.now();
    if(down.dragging){
      const k = down.src === 'hand' ? HAND_SCROLL_GAIN : 1;
      const dx = (x - lastX) * k, dy = (y - lastY) * k;
      applyScroll(-dx, -dy, down);
      const dt = Math.max(16, now - lastT);   // 한 프레임(16ms)당 이동량으로 환산
      const cl = v => Math.max(-60, Math.min(60, v));
      velX = cl(velX * 0.6 + (-dx / dt * 16) * 0.4);
      velY = cl(velY * 0.6 + (-dy / dt * 16) * 0.4);
    }
    lastX = x; lastY = y; lastT = now;
  }
  function applyScroll(dx, dy, d){
    if(d.box){ d.box.scrollTop += dy; return; }
    if(d.row) d.row.scrollLeft += dx;
    window.scrollBy(0, dy);
  }
  function pointerUp(){
    if(!down) return;
    const d = down; down = null;
    document.body.classList.remove('grabbing');
    if(d.dragging){
      if(d.src === 'mouse'){   // 마우스로 끈 직후 브라우저가 보내는 click 한 번만 무시 (안 오면 바로 풀기)
        suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      }
      glide(d);
    } else if(d.src === 'hand'){
      const el = d.target.closest('a, button, .hero-card') || d.target;
      el.click();
    }
  }
  function glide(d){
    if(Math.abs(velX) < 0.3 && Math.abs(velY) < 0.3) return;
    if(down) return;   // 다시 잡으면 멈춤
    applyScroll(velX, velY, d);
    velX *= FRICTION; velY *= FRICTION;
    requestAnimationFrame(() => glide(d));
  }

  // ---- 마우스 ----
  document.addEventListener('mousedown', e => { if(e.button === 0) pointerDown(e.clientX, e.clientY, 'mouse', e.target); });
  window.addEventListener('mousemove', e => pointerMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', pointerUp);
  document.addEventListener('click', e => { if(suppressClick){ e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
  document.addEventListener('dragstart', e => e.preventDefault());

  // ---- 손 hover: 손 아래 카드에 mouseenter/mouseleave를 보내서 마우스와 똑같이 선명해지게 ----
  let hoverCard = null, hoverLink = null;
  function handHover(x, y){
    const el = x < 0 ? null : document.elementFromPoint(x, y);
    const card = el ? el.closest('.hero-card') : null;
    if(card !== hoverCard){
      if(hoverCard){ hoverCard.dispatchEvent(new MouseEvent('mouseleave')); hoverCard.classList.remove('hand-hover'); }
      if(card){ card.dispatchEvent(new MouseEvent('mouseenter')); card.classList.add('hand-hover'); }
      hoverCard = card;
    }
    const link = el ? el.closest('a, button') : null;
    if(link !== hoverLink){
      if(hoverLink) hoverLink.classList.remove('hand-hover');
      if(link) link.classList.add('hand-hover');
      hoverLink = link;
    }
  }

  // ---- 카메라 (archive와 같은 방식: 손바닥 중앙 = 커서, 손가락을 접으면 주먹) ----
  let FIST_CLOSE = 0.6;
  document.addEventListener('keydown', e => {
    if(e.key === '[') FIST_CLOSE = Math.max(0.1, +(FIST_CLOSE - 0.05).toFixed(2));
    if(e.key === ']') FIST_CLOSE = Math.min(1.5, +(FIST_CLOSE + 0.05).toFixed(2));
  });
  let camOn = false, video = null, landmarker = null, lastVideoTime = -1;
  let fistFrames = 0, openFrames = 0, fisted = false, sx = null, sy = null;

  async function startCam(){
    const LOCAL = '../../files/vendor/mediapipe/', CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/';
    const has = async u => { try{ return (await fetch(u, { method:'HEAD', cache:'no-store' })).ok; }catch(e){ return false; } };
    const localLib = await has(LOCAL + 'vision_bundle.js');
    const localModel = await has(LOCAL + 'hand_landmarker.task');
    const { HandLandmarker, FilesetResolver } = await import(localLib ? LOCAL + 'vision_bundle.js' : CDN + 'vision_bundle.mjs');
    const fs = await FilesetResolver.forVisionTasks(localLib ? LOCAL + 'wasm' : CDN + 'wasm');
    landmarker = await HandLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: localModel ? LOCAL + 'hand_landmarker.task' : 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
      runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5
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
    if(video.readyState >= 2 && video.currentTime !== lastVideoTime){
      lastVideoTime = video.currentTime;
      const r = landmarker.detectForVideo(video, performance.now());
      if(r.landmarks && r.landmarks.length){
        const lm = r.landmarks[0], c = lm[9], w = lm[0];
        const palm = { x:(lm[5].x+lm[9].x+lm[13].x+lm[17].x)/4, y:(lm[5].y+lm[9].y+lm[13].y+lm[17].y)/4 };
        const tx = (1 - c.x) * innerWidth, ty = c.y * innerHeight;
        sx = sx === null ? tx : sx + (tx - sx) * 0.5;   // 떨림 줄이기
        sy = sy === null ? ty : sy + (ty - sy) * 0.5;
        const scale = Math.hypot(w.x-c.x, w.y-c.y) || 0.1;
        const open = [lm[8],lm[12],lm[16],lm[20]].reduce((s,t)=>s+Math.hypot(t.x-palm.x, t.y-palm.y),0) / 4 / scale;
        // 주먹/펴기는 2프레임 연속일 때만 바꾼다 — 한 프레임 튐으로 클릭되지 않게
        if(open <= FIST_CLOSE){ fistFrames++; openFrames = 0; } else { openFrames++; fistFrames = 0; }
        cursor.style.display = 'block';
        cursor.style.left = sx + 'px'; cursor.style.top = sy + 'px';
        if(!fisted && fistFrames >= 2){ fisted = true; pointerDown(sx, sy, 'hand'); }
        else if(fisted && openFrames >= 2){ fisted = false; pointerUp(); }
        cursor.classList.toggle('fist', fisted);
        if(fisted && fistFrames > 0) pointerMove(sx, sy);   // 펴기 시작한 프레임의 흔들림은 무시
        handHover(down && down.dragging ? -1 : sx, sy);
      } else {
        if(fisted){ fisted = false; if(down) down.dragging = true; pointerUp(); }   // 손을 놓치면 클릭하지 않고 놓기만
        sx = sy = null; fistFrames = openFrames = 0;
        cursor.style.display = 'none'; cursor.classList.remove('fist');
        handHover(-1, -1);
      }
    }
    requestAnimationFrame(track);
  }

  let started = false;
  function tryStart(){
    if(started) return; started = true;
    startCam().catch(err => { console.warn('camera unavailable:', err); started = false; });
  }
  tryStart();
  ['click','keydown','touchstart'].forEach(ev => document.addEventListener(ev, tryStart));
})();
