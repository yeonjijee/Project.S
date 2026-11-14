/* 효과음 — 테스트 화면(script.js)의 typeSound를 그대로 가져와 HERO LIST / ARCHIVE에서도 쓴다.
   (숫자를 바꾸려면 script.js 쪽과 같이 바꿔야 한다) */
(function(){
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
window.typeSound = typeSound; window.CLACK_PAN = CLACK_PAN;
})();

/* 손을 움직이면 테스트 화면처럼 메카 바람·엔진 소리가 살살 (손 커서가 보일 때만) */
(function(){
  const MIN = 0.06, FULL = 0.8;
  let lx = null, ly = null, lt = 0, speed = 0, pt = 0, smooth = 0;
  setInterval(() => {
    const now = performance.now();
    const dt = pt ? Math.min(0.1, (now - pt) / 1000) : 0.02; pt = now;
    const cur = document.getElementById('handCursor');
    const vis = cur && cur.style.display === 'block';
    if(vis){
      const x = parseFloat(cur.style.left), y = parseFloat(cur.style.top);
      if(!isNaN(x)){
        if(lx === null){ lx = x; ly = y; lt = now; }
        else if(x !== lx || y !== ly){ speed = Math.hypot(x - lx, y - ly) / Math.max(0.016, (now - lt) / 1000) / innerWidth; lx = x; ly = y; lt = now; }
        else if(now - lt > 100) speed = 0;
      }
    } else { lx = ly = null; speed = 0; }
    const a = Math.min(1, Math.max(0, (speed - MIN) / (FULL - MIN)));
    smooth += (a - smooth) * (a > smooth ? 0.5 : 0.08);
    if(!isFinite(smooth)) smooth = 0;
    const v = smooth < 0.01 ? 0 : smooth;
    window.typeSound.rustle(v, dt);
    window.typeSound.handUpdate(v, lx === null ? 0.5 : lx / innerWidth);
  }, 20);
  ['keydown', 'pointerdown'].forEach(ev => document.addEventListener(ev, () => window.typeSound.unlock(), true));
  window.addEventListener('load', () => { try{ window.typeSound.unlock(); }catch(e){} });   // 같은 사이트에서 넘어왔으면 바로 켜지기도 함
})();
