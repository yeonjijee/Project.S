"""
Project.S 로컬 서버 — 정적 파일 서빙 + Q6 AI 해석 API

전시(또는 개발) 중에는 이 파일 하나만 실행하면 된다:
    python3 server.py

기존에 쓰던 `python -m http.server`를 대체한다. 정적 파일(archive/, redesign/test/, data/, images/ 등)은
그대로 서빙하고, 추가로 POST /api/interpret 엔드포인트에서 Q6 주관식 답변을 Claude API로 보내
한 줄 해석을 받아온다. API 키는 이 서버 프로세스 안에서만 쓰이고 브라우저로 절대 전달되지 않는다
(사이트/JS 코드 어디에도 키가 노출되지 않음).

사전 준비:
    pip3 install flask anthropic python-dotenv --break-system-packages
    .env 파일을 이 파일과 같은 폴더(ProjectS 루트)에 만들고 아래처럼 한 줄 채워넣기:
        ANTHROPIC_API_KEY=sk-ant-...여기에 실제 키...
    (.env.example을 복사해서 .env로 이름 바꾸고 값만 채우면 됨)
"""

import os
import re
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()

app = Flask(__name__, static_folder=None)

# ---------- 정적 파일 서빙 (기존 python -m http.server와 동일하게 ProjectS 루트를 그대로 서빙) ----------
@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def serve_static(path):
    full = BASE_DIR / path
    if full.is_dir():
        full = full / "index.html"
        path = str(Path(path) / "index.html")
    if not full.exists():
        return f"Not found: {path}", 404
    return send_from_directory(BASE_DIR, path)


# ---------- Q6 AI 해석 ----------
MAX_INPUT_LEN = 400  # 사용자가 아주 긴 글을 붙여넣어도 과금/오남용 방지용으로 자름

SYSTEM_PROMPT = """너는 "Project.S"라는 졸업 전시의 일부인, 특촬물(슈퍼전대/파워레인저) 50년 역사를 소재로 한
"당신 안의 영웅성을 찾는" 인터랙티브 퀴즈의 마지막 해설을 두 부분으로 나눠서 써주는 역할이야.

관람객은 Q1~Q5에서 자신의 약점/성격에 해당하는 키워드를 골랐고, Q6에서 자기 삶의 한 장면이나
생각을 짧은 글로 적었어. 그 결과 특정 전대 히어로와 매칭됐는데, 이 매칭은 관람객이 고른 키워드가
그 히어로의 약점/성격 키워드와 실제로 겹쳤기 때문이야(아래 "겹친 키워드" 참고).

다음 두 부분을 반드시 이 형식 그대로, 순서대로 써줘 (대괄호 라벨까지 그대로 포함):

[설명]
(3~5문장, 250자 안팎. 왜 하필 이 사람이 이 히어로와 닮았는지 설명할 것. "겹친 키워드" 중
최소 하나는 구체적으로 언급해서 근거로 삼을 것. 관람객이 적은 글의 단어나 표현도 자연스럽게
한 번 녹여낼 것. 과장되거나 뻔한 "당신은 최고예요" 식 응원 문구, 일반적인 "강점 찾기" 성격
테스트 말투는 피할 것. 진솔하고 담담하되 따뜻한 톤, 노스탤지어를 살짝 담아도 좋음.)

[해석]
(한 문장, 45자 이내. 히어로의 특징 하나와 관람객의 약점 하나를 짝지어 대입하는 은유적
치환 문장. 예시 구조: "당신의 (약점)은 사실 (히어로)가 가진 (특징)과 같은 모습이었는지도
모릅니다." 이 예시 문장을 그대로 베끼지 말고 내용에 맞게 새로 쓸 것. "영웅"이라는 단어를
직접 쓰지 않아도 되지만, 평범한 사람 안에 있던 무언가가 이미 그 히어로와 닮아 있었다는
뉘앙스로 끝맺을 것.)

마크다운이나 따옴표로 감싸기, [설명]/[해석] 라벨 외의 다른 설명·서두 없이 이 형식 그대로만
출력할 것."""


def build_user_prompt(
    subjective_text: str,
    hero_name: str,
    hero_summary: str,
    weakness_keywords: list,
    personality_keywords: list,
) -> str:
    overlap = weakness_keywords + personality_keywords
    overlap_str = ", ".join(overlap) if overlap else "(겹친 키워드 없음 — 글의 내용만으로 자연스럽게 연결할 것)"
    return (
        f"매칭된 히어로: {hero_name}\n"
        f"히어로 한 줄 설명: {hero_summary}\n"
        f"겹친 키워드(관람객이 고른 것 중 이 히어로의 약점/성격과 실제로 겹친 것): {overlap_str}\n"
        f"관람객이 적은 글: \"{subjective_text}\"\n\n"
        "위 내용을 바탕으로 규칙에 맞게 [설명]과 [해석] 두 부분을 한국어로 써줘."
    )


def _split_sections(raw_text: str):
    """모델 출력에서 [설명]/[해석] 두 부분을 갈라낸다. 형식이 어긋나면(모델이 라벨을 빼먹는 등)
    전체를 설명으로, 해석은 빈 문자열로 돌려줘서 화면이 깨지지 않게 한다."""
    m = re.search(r"\[설명\]\s*(.*?)\s*\[해석\]\s*(.*)", raw_text, re.S)
    if m:
        explanation = m.group(1).strip()
        one_liner = m.group(2).strip()
    else:
        explanation = raw_text.strip()
        one_liner = ""
    # 혹시 모델이 따옴표로 감싸서 답하면 벗겨준다
    explanation = re.sub(r'^["“](.*)["”]$', r"\1", explanation).strip()
    one_liner = re.sub(r'^["“](.*)["”]$', r"\1", one_liner).strip()
    return explanation, one_liner


@app.route("/api/interpret", methods=["POST"])
def interpret():
    if not API_KEY:
        return jsonify({"error": "서버에 ANTHROPIC_API_KEY가 설정되어 있지 않습니다 (.env 확인 필요)"}), 500

    data = request.get_json(silent=True) or {}
    subjective_text = str(data.get("subjectiveText", "")).strip()[:MAX_INPUT_LEN]
    hero_name = str(data.get("heroName", "")).strip()[:60]
    hero_summary = str(data.get("heroSummary", "")).strip()[:200]

    def _clean_keywords(raw):
        if not isinstance(raw, list):
            return []
        return [str(k).strip()[:30] for k in raw if str(k).strip()][:10]

    weakness_keywords = _clean_keywords(data.get("weaknessKeywords"))
    personality_keywords = _clean_keywords(data.get("personalityKeywords"))

    if not subjective_text or not hero_name:
        return jsonify({"error": "subjectiveText, heroName은 필수입니다"}), 400

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=API_KEY)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=420,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": build_user_prompt(
                        subjective_text, hero_name, hero_summary, weakness_keywords, personality_keywords
                    ),
                }
            ],
        )
        raw_text = "".join(block.text for block in resp.content if getattr(block, "type", "") == "text").strip()
        explanation, one_liner = _split_sections(raw_text)
        return jsonify({"explanation": explanation, "oneLiner": one_liner})
    except Exception as e:
        print("interpret error:", repr(e))
        return jsonify({"error": "AI 해석 생성 중 오류가 발생했습니다"}), 502


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    if not API_KEY:
        print("[경고] .env에 ANTHROPIC_API_KEY가 없습니다 — Q6 AI 해석은 항상 실패하고, 나머지 사이트는 정상 동작합니다.")
    print(f"Project.S 서버 실행 중: http://localhost:{port}/")
    app.run(host="0.0.0.0", port=port, debug=False)
