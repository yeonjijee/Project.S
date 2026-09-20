/*
  mosaic.js — RGB 서클패킹 하프톤 리빌 이펙트
  ------------------------------------------------
  Project.S 리디자인용 재사용 모듈. CMYK 인쇄 분리 없이 단일 컬러 레이어로
  원본 이미지를 그대로(RGB) 점으로 흩뿌려 표현한다.

  사용법:
    const mosaic = new MosaicRenderer(canvasEl, imageEl, { cell: 12 });
    mosaic.render(rate);   // rate: 0(원본 그대로) ~ 1(완전 추상)
    mosaic.render(0.4);    // 퀴즈 진행에 따라 이 값을 계속 바꿔 호출하면 됨

  rate가 1에 가까울수록 점이 커져서(=밝기×rate 로 반지름 결정) 서로 겹치며
  원본을 가리고, rate가 0에 가까워질수록 점이 작아지며 원본 색이 그대로 드러난다.
*/

class MosaicRenderer {
  constructor(canvas, image, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = image;
    this.cell = opts.cell || 12;      // 그리드 간격(px)
    this.jitter = opts.jitter ?? 0.6; // 점 위치 흔들림 정도 (0~1)
    this.bg = opts.bg || '#0b0b0b';   // 점이 없는 영역(빈 셀) 배경색

    this.w = canvas.width;
    this.h = canvas.height;

    // 소스 이미지를 오프스크린 캔버스에 그려서 픽셀 데이터를 미리 읽어둔다.
    this._off = document.createElement('canvas');
    this._off.width = this.w;
    this._off.height = this.h;
    this._octx = this._off.getContext('2d');
    this._octx.drawImage(this.image, 0, 0, this.w, this.h);
    this._pixels = this._octx.getImageData(0, 0, this.w, this.h).data;
  }

  // 결정론적 의사난수 (매 프레임 같은 셀이 같은 흔들림/크기를 갖도록)
  _seed(a, b) {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  _pixelAt(x, y) {
    x = Math.max(0, Math.min(this.w - 1, Math.round(x)));
    y = Math.max(0, Math.min(this.h - 1, Math.round(y)));
    const i = (y * this.w + x) * 4;
    const p = this._pixels;
    return { r: p[i], g: p[i + 1], b: p[i + 2], lum: (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) / 255 };
  }

  // rate: 0(원본 노출) ~ 1(완전 추상). 셀마다 점 하나, 반지름 = (cell/2) * (1-밝기) * rate
  render(rate) {
    const ctx = this.ctx;
    const cell = this.cell;
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const cols = Math.ceil(this.w / cell) + 1;
    const rows = Math.ceil(this.h / cell) + 1;

    for (let gy = -1; gy < rows; gy++) {
      for (let gx = -1; gx < cols; gx++) {
        const jx = (this._seed(gx, gy) - 0.5) * cell * this.jitter;
        const jy = (this._seed(gy, gx) - 0.5) * cell * this.jitter;
        const cx = gx * cell + cell / 2 + jx;
        const cy = gy * cell + cell / 2 + jy;
        if (cx < 0 || cx > this.w || cy < 0 || cy > this.h) continue;

        const px = this._pixelAt(cx, cy);
        const dark = 1 - px.lum;
        const sizeJitter = 0.7 + 0.6 * this._seed(gx * 3, gy * 5);
        const r = (cell / 2) * dark * rate * sizeJitter;
        if (r < 0.6) continue;

        ctx.beginPath();
        ctx.fillStyle = `rgb(${px.r},${px.g},${px.b})`;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// 브라우저 전역/모듈 양쪽에서 쓸 수 있게
if (typeof module !== 'undefined' && module.exports) module.exports = MosaicRenderer;
