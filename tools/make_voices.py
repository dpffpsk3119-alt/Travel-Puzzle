"""원어민 기준 음성 파일 만들기 (억양 비교용)

부모님 컴퓨터에서 한 번만 실행하면 www/refvoice/ 폴더에 문장별 mp3가 생겨요.
  1) 파이썬 설치: https://www.python.org  (설치할 때 "Add to PATH" 체크)
  2) 명령 창에서:   pip install edge-tts
  3) 이 폴더에서:   python tools/make_voices.py
  4) 끝나면:        npx cap sync

※ 마이크로소프트 엣지 '소리 내어 읽기' 목소리를 쓰는 무료 방식이에요.
  가족끼리 쓰거나 시험할 때는 괜찮지만, 스토어 정식 출시용 앱에는
  앱이 휴대폰에서 직접 만드는 목소리(기본 동작)를 쓰는 걸 추천해요.
"""
import asyncio, json, os, sys

try:
    import edge_tts
except ImportError:
    sys.exit("먼저  pip install edge-tts  를 실행해 주세요.")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "www", "refvoice")
SENT = json.load(open(os.path.join(ROOT, "tools", "sentences.json"), encoding="utf-8"))

async def main():
    os.makedirs(OUT, exist_ok=True)
    voices = await edge_tts.list_voices()
    def pick(bcp):
        lang = bcp.split("-")[0].lower()
        same = [v for v in voices if v["Locale"].lower() == bcp.lower()]
        near = [v for v in voices if v["Locale"].lower().split("-")[0] == lang]
        pool = same or near
        if not pool:
            return None
        pool.sort(key=lambda v: (v.get("Gender") != "Female", v["ShortName"]))
        return pool[0]["ShortName"]
    made = skip = miss = 0
    missing = set()
    for i, s in enumerate(SENT, 1):
        path = os.path.join(OUT, s["key"] + ".mp3")
        if os.path.exists(path):
            skip += 1
            continue
        v = pick(s["bcp"])
        if not v:
            miss += 1
            missing.add(s["bcp"])
            continue
        for attempt in range(3):
            try:
                await edge_tts.Communicate(s["text"], v, rate="-10%").save(path)
                made += 1
                break
            except Exception as e:
                if attempt == 2:
                    print("  실패:", s["text"], e)
                await asyncio.sleep(1.5)
        print(f"[{i}/{len(SENT)}] {s['lang']} {s['text']}  ({v})")
    print(f"\n완료! 새로 만듦 {made}개 · 이미 있음 {skip}개 · 목소리 없는 언어 {miss}문장")
    if missing:
        print("목소리가 없는 언어(이 문장들은 휴대폰 목소리로 비교해요):", ", ".join(sorted(missing)))

asyncio.run(main())
