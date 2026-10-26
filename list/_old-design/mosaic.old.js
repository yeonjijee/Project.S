/*
  mosaic.js — 정사각 타일 모자이크(픽셀레이션) 리빌 이펙트
  ------------------------------------------------
  Project.S 리디자인용 재사용 모듈. 원본 이미지를 정사각형 타일 그리드로 잘라서 각 타일을
  그 자리 색으로 채운다 — 완전 모자이크/픽셀레이션 느낌.

  사용법:
    const mosaic = new MosaicRenderer(canvasEl, imageEl, { minCell: 3, maxCell: 30 });
    mosaic.render(rate);   // rate: 1(완전 추상=타일이 크고 성김) ~ 0.1(원본에 가까움=타일이 작고 촘촘함)
    mosaic.render(0.4);    // 퀴즈 진행에 따라 이 값을 계속 바꿔 호출하면 됨
    mosaic.render(0.4, 0); // 두 번째 인자(colorMix, 기본값 1)를 0으로 주면 완전 흑백(모노톤)으로 렌더링
    mosaic.render(0.1, 0.6); // 0~1 사이 값을 주면 흑백↔원색 사이를 그 비율만큼 섞어서 렌더링 (변신 연출용)

  rate가 클수록 타일 한 칸이 커져서(=maxCell에 가까워짐) 해상도가 낮아지며 원본을 크게 뭉갠 것처럼
  보이고, rate가 작을수록 타일이 작아져서(=minCell에 가까워짐) 해상도가 높아지며 원본 사진에 가깝게
  보인다. rate는 항상 내부에서 최소 0.1로 clamp되므로(완전히 안 보이는 상태를 방지) 0을 넘겨도 안전하다.

  colorMix는 기획서의 "Q1~Q6은 Monotone, 결과 화면에서만 컬러로 변신" 연출을 위한 값이다.
  0이면 완전 흑백, 1이면 원본 색 그대로, 그 사이 값이면 흑백과 원색을 선형으로 섞는다.
*/

class MosaicRenderer {
  constructor(canvas, image, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = image;
    // 구버전 { cell: 12 } 옵션과의 호환: cell만 주어지면 그 값을 maxCell로 쓰고 minCell은 기본값을 쓴다.
    this.minCell = opts.minCell ?? 3;
    this.maxCell = opts.maxCell ?? (opts.cell || 30);
    this.bg = opts.bg || '#0b0b0b';   // 타일 사이 그라우트/여백 색

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

  _pixelAt(x, y) {
    x = Math.max(0, Math.min(this.w - 1, Math.round(x)));
    y = Math.max(0, Math.min(this.h - 1, Math.round(y)));
    const i = (y * this.w + x) * 4;
    const p = this._pixels;
    return { r: p[i], g: p[i + 1], b: p[i + 2] };
  }

  // rate: 1(완전 추상) ~ 0.1(원본에 가까움, 이 아래로는 내려가지 않게 clamp).
  // 타일 크기(cell)를 rate에 비례해서 minCell~maxCell 사이로 움직여, 해상도 자체가 달라지게 한다
  // (예전 버전은 타일 개수는 고정하고 점 크기만 줄여서, rate가 작아질수록 그냥 안 보이는 문제가 있었다).
  // colorMix: 0(흑백)~1(원색). 기본값 1(원색 그대로) — 흑백으로 쓰려면 호출할 때 0을 넘겨줘야 한다.
  render(rate, colorMix = 1) {
    rate = Math.max(0.1, Math.min(1, rate));
    colorMix = Math.max(0, Math.min(1, colorMix));
    const ctx = this.ctx;
    const cell = this.minCell + (this.maxCell - this.minCell) * rate;
    const gap = Math.max(0.5, cell * 0.08); // 타일 사이 살짝 그라우트 틈 — 완전 모자이크 느낌

    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const cols = Math.ceil(this.w / cell) + 1;
    const rows = Math.ceil(this.h / cell) + 1;

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const left = gx * cell;
        const top = gy * cell;
        if (left > this.w || top > this.h) continue;
        const px = this._pixelAt(left + cell / 2, top + cell / 2);
        const size = cell - gap;
        if (size <= 0) continue;
        let r = px.r, g = px.g, b = px.b;
        if (colorMix < 1) {
          const gray = r * 0.299 + g * 0.587 + b * 0.114;
          r = gray + (r - gray) * colorMix;
          g = gray + (g - gray) * colorMix;
          b = gray + (b - gray) * colorMix;
        }
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(left + gap / 2, top + gap / 2, size, size);
      }
    }
  }
}

// 브라우저 전역/모듈 양쪽에서 쓸 수 있게
if (typeof module !== 'undefined' && module.exports) module.exports = MosaicRenderer;
