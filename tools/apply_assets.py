#!/usr/bin/env python3
"""
피그마에서 내보낸 PNG를 코드가 읽는 자리(redesign/test/images/ui/q/)에 "이름 규칙대로" 자동으로 넣어준다.

사용법 (ProjectS 폴더에서):
    pip3 install pillow            # 처음 한 번만
    python3 tools/apply_assets.py                      # 기본: redesign/test/images/ui/요소 안의 파일을 읽는다
    python3 tools/apply_assets.py --src "내보낸폴더"    # 다른 폴더에서 읽고 싶을 때 (하위 폴더까지 전부 찾는다)

규칙:
  - 파일 이름(확장자 뺀 부분)이 아래 표의 "피그마 이름"과 같으면 해당 자리에 복사된다. 폴더 구조는 상관없다.
  - Page 1 레인저(책임감A/B ... 무리함A/B)는 A/B 모두 같은 영역으로 자동 크롭해서(둘이 같은 위치를 유지하도록)
    넣는다 — 레인저가 hover로 A->B가 될 때 몸이 흔들리지 않게 하기 위함.
  - 표에 없는 파일은 무시한다. 못 찾은 이름은 마지막에 "없음" 목록으로 알려준다(기존 파일은 그대로 유지).
"""
import argparse, shutil, sys, unicodedata
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("pillow가 필요해: pip3 install pillow")

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = ROOT / "redesign/test/images/ui/요소"
DEST = ROOT / "redesign/test/images/ui/q"

# 피그마 이름 -> 코드에서 쓰는 파일 이름
SIMPLE = {
    "다음": "next.png",            # 모든 "다음/넘어가기" 버튼
    "리셋": "reset.png",           # 모든 화면 우하단 리셋 버튼
    "바구니A": "basket-closed.png",  # Page 1 바구니 닫힘(기본)
    "바구니B": "basket-open.png",    # Page 1 바구니 열림(끌고 있는 동안)
    "바구니C": "basket-front.png",   # Page 1 바구니 앞면(열림일 때 맨 위에 겹침)
    "집게A": "tongs-a.png",          # Page 2 커서: 편 손
    "집게B": "tongs-b.png",          # Page 2 커서: 주먹
    "펜": "pen.png",                 # Page 3 펜 버튼 + 커서
    "지우개": "eraser.png",          # Page 3 지우개 버튼 + 커서
    "야광봉": "glowstick.png",       # Page 4 커서(랜턴)
    "주먹": "fist.png",              # Page 5 커서
    "소원 지니": "genie.png",        # Page 6 장식
}
# Page 1 레인저 (순서 = 화면에 보이는 순서: 위 5명, 아래 4명)
HEROES = ["책임감", "리더십", "정의감", "자기희생", "성실함", "근성", "완벽주의", "신념", "무리함"]


def nfc(s):
    return unicodedata.normalize("NFC", s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(DEFAULT_SRC))
    ap.add_argument("--dest", default=str(DEST))
    a = ap.parse_args()
    src, dest = Path(a.src), Path(a.dest)
    dest.mkdir(parents=True, exist_ok=True)

    found = {}
    for p in src.rglob("*.png"):
        found[nfc(p.stem)] = p

    done, missing = [], []
    for name, out in SIMPLE.items():
        if name in found:
            shutil.copyfile(found[name], dest / out)
            done.append(f"{name} -> {out}")
        else:
            missing.append(name)

    # 레인저: A/B를 하나의 공통 영역으로 크롭
    boxes, imgs = [], {}
    for i, h in enumerate(HEROES, 1):
        for v in "AB":
            key = f"{h}{v}"
            if key in found:
                im = Image.open(found[key]).convert("RGBA")
                imgs[(i, v.lower())] = im
                boxes.append(im.getbbox())
            else:
                missing.append(key)
    if boxes:
        L = min(b[0] for b in boxes) - 4; T = min(b[1] for b in boxes) - 4
        R = max(b[2] for b in boxes) + 4; B = max(b[3] for b in boxes) + 4
        for (i, v), im in imgs.items():
            im.crop((max(0, L), max(0, T), min(im.width, R), min(im.height, B))).save(dest / f"kw-{i}-{v}.png")
            done.append(f"{HEROES[i-1]}{v.upper()} -> kw-{i}-{v}.png (크롭)")

    print(f"읽은 폴더: {src}\n넣은 곳: {dest}\n")
    print(f"적용 {len(done)}개")
    for d in done:
        print("  ✓", d)
    if missing:
        print(f"\n없음 {len(missing)}개 (기존 파일 그대로 유지): {', '.join(missing)}")


if __name__ == "__main__":
    main()
