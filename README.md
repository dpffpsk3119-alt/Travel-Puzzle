# 우리아이 퀴즈놀이 — 안드로이드·아이폰 앱 프로젝트

지금 쓰고 계신 웹 버전을 그대로 휴대폰 앱으로 감싼 프로젝트예요. (Capacitor 8)

```
www/                  ← 앱 화면 (index.html 하나 + 글꼴 + 연결 코드)
  index.html          ← 퀴즈놀이 본체 (휴대폰용 글자 크기·버튼 최적화)
  app-shim.js         ← 랭킹(Firebase)·음성 읽기·기기 번호 연결 코드
  firebase-config.js  ← ★ Firebase 설정을 넣는 곳
  fonts/              ← 주아체·고운돋움 (인터넷 없어도 글꼴 그대로)
android/              ← 안드로이드 스튜디오로 여는 프로젝트
ios/                  ← Xcode로 여는 프로젝트
assets/               ← 앱 아이콘·시작 화면 원본 (바꾸려면 이 그림만 교체)
firestore.rules       ← 랭킹 서버 보안 규칙
```

---

## 0. 미리 준비할 것

| | 안드로이드 | 아이폰 |
|---|---|---|
| 컴퓨터 | 윈도우·맥 모두 가능 | **맥 컴퓨터 필수** |
| 프로그램 | [Node.js 22 이상](https://nodejs.org), [Android Studio](https://developer.android.com/studio) | Node.js 22 이상, Xcode(앱스토어에서 설치) |
| 개발자 등록 | Google Play Console — 1회 25달러 | Apple Developer Program — 1년 99달러 |

---

## 1. 랭킹 서버 연결 (Firebase, 무료 요금제로 충분)

1. https://console.firebase.google.com 에서 **프로젝트 추가** (이름 예: `uriai-kidquiz`).
2. 왼쪽 메뉴 **빌드 → Authentication → 시작하기 → 로그인 방법 → 익명** 을 **사용 설정**.
3. **빌드 → Firestore Database → 데이터베이스 만들기** → 위치 `asia-northeast3 (서울)` → **프로덕션 모드**.
4. Firestore의 **규칙** 탭에 이 폴더의 `firestore.rules` 내용을 그대로 붙여 넣고 **게시**.
5. 프로젝트 설정(톱니바퀴) → **내 앱 → 웹 앱(</>) 추가** → 나오는 설정에서 `apiKey`, `projectId` 두 개를 복사해
   `www/firebase-config.js` 에 넣어요.

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIza....",
  projectId: "uriai-kidquiz"
};
```

> 비워 두면 랭킹만 꺼지고 나머지 놀이는 모두 그대로 동작해요.
> 랭킹은 이 앱을 깐 사람 모두가 같은 명예의 전당을 보게 돼요.

---

## 2. 안드로이드 앱 만들기

```bash
cd 이_폴더
npm install          # 처음 한 번
npx cap sync         # www 를 고쳤을 때마다
npx cap open android # 안드로이드 스튜디오가 열려요
```

1. 안드로이드 스튜디오가 열리면 Gradle 동기화가 끝날 때까지 기다려요(처음엔 몇 분 걸려요).
2. 휴대폰을 USB로 연결(개발자 옵션 → USB 디버깅 켜기)하고 ▶ 실행 → 휴대폰에서 바로 확인.
3. 스토어용 파일: **Build → Generate Signed App Bundle / APK → Android App Bundle(.aab)**
   - 처음이면 **Create new…** 로 서명 키(.jks)를 만들어요. **이 파일과 비밀번호는 꼭 따로 보관**하세요. 잃어버리면 앱 업데이트를 못 해요.
4. Google Play Console → 앱 만들기 → **프로덕션(또는 내부 테스트) → 새 버전 만들기** 에 .aab 를 올려요.

## 3. 아이폰 앱 만들기 (맥에서)

```bash
npm install
npx cap sync
npx cap open ios     # Xcode가 열려요
```

1. 왼쪽 **App** 프로젝트 → **Signing & Capabilities** → Team 에 Apple 개발자 계정 선택.
2. 아이폰을 연결하고 ▶ 실행해서 확인.
3. **Product → Archive → Distribute App → App Store Connect** 로 올려요.
4. App Store Connect에서 스크린샷·설명을 넣고 심사 제출.

---

## 4. 앱 정보 바꾸기

- **앱 ID** (`capacitor.config.json` 의 `appId`): 지금은 `com.uriai.kidquiz` 예요.
  스토어에 처음 올리기 **전에** 원하는 이름으로 바꾸세요(예: `kr.가족이름.kidquiz` 처럼 영문). 올린 뒤에는 못 바꿔요.
  바꾼 뒤에는 `android`, `ios` 폴더를 지우고 `npx cap add android`, `npx cap add ios --packagemanager SPM` 을 다시 해요.
- **아이콘·시작 화면**: `assets/icon-only.png`(1024×1024), `assets/splash.png`(2732×2732)를 바꾼 뒤
  `npx @capacitor/assets generate --iconBackgroundColor '#F5B82E' --splashBackgroundColor '#EDF3EA'`
- **버전**: 안드로이드 `android/app/build.gradle` 의 `versionCode`(올릴 때마다 +1), `versionName`. 아이폰은 Xcode의 Version / Build.

## 5. 앱 내용 고치기

Claude에서 웹 버전을 고친 다음, 새 `index.html` 을 받아 `www/index.html` 로 바꾸고 `npx cap sync` 만 하면 돼요.
(Claude에게 "앱용 index.html 다시 만들어 줘"라고 하면 앱 연결 코드까지 넣어 드려요.)

---

## 6. 앱에서 달라지는 점

| 기능 | 앱에서 |
|---|---|
| 퀴즈·국기·세계 여행·명소·대한민국 지도·보물찾기·여권 | ✅ 그대로 (인터넷 없어도 됨) |
| 소리 내어 읽기·세계 말로 듣기 | ✅ 휴대폰 음성 엔진 사용 (설정에서 해당 언어 음성을 받아 두면 더 자연스러워요) |
| 따라 말하기 녹음·자동 별점 | ✅ 앱 안에서 바로 녹음, 단어·억양 비교 (아래 8번) |
| 명예의 전당 랭킹 | ✅ Firebase 연결 시 |
| 생각 말하기(논리력 채점)·사진 설명·번역 | ⛔ Claude 기능이라 앱에서는 꺼져요 |

## 7. 아이 앱 등록 전 꼭 챙길 것

- **개인정보처리방침 주소(URL)** 가 두 스토어 모두 필수예요. 랭킹에 올라가는 정보(별명·학교/유치원·학년·점수)와
  익명 기기 번호만 모은다는 내용, 삭제 방법(앱의 "랭킹에서 빠지기")을 적어 주세요.
- 만 14세 미만 아동 정보라 **보호자 동의**가 필요해요. 랭킹 참여 화면은 부모님이 함께 정하도록 안내하는 문구가 이미 들어 있어요.
- Google Play: **타깃 연령층**을 아동으로 고르면 "가족 정책" 심사를 받아요. 광고·외부 링크가 없어서 유리해요.
- App Store: **키즈 카테고리**로 내면 더 엄격해요. 처음엔 "교육" 카테고리, 연령 4+ 로 내는 걸 추천해요.
- 실명 대신 **별명**을 쓰도록 안내하면 심사와 개인정보 모두 편해요.

---

## 8. 따라 말하기 코치 (녹음 · 단어 맞히기 · 억양 비교)

아이가 🎤를 누르고 따라 말하면 앱이 바로 녹음하고, 원어민 소리와 비교해서 **별을 자동으로** 줘요.

| 별 | 기준 |
|---|---|
| ★ | 말했어요 |
| ★★ | 낱말을 반 이상 맞게 말했어요 |
| ★★★ | 낱말이 맞고, 목소리 높낮이(억양)도 원어민과 닮았어요 |

- **억양 비교**: 원어민 소리와 아이 목소리의 높낮이 선을 겹쳐 보여 줘요(초록 점선 = 원어민, 주황 = 아이).
  아이 목소리가 원래 높아도 공평하도록 "오르내리는 모양"만 비교해요.
- **원어민 기준 소리**: 앱이 휴대폰 음성 엔진으로 직접 만들어요. 아이 이름이 들어간 문장도 그대로 만들어요.
  휴대폰에 그 언어 음성이 없으면 `www/refvoice/` 의 파일을 써요(아래 선택 사항).
- **단어 맞히기**: 아이폰은 모든 버전, 안드로이드는 **13 이상**에서 휴대폰 음성 인식으로 해요.
  안드로이드 12 이하에서는 억양만으로 별을 줘요.
- 부모님이 별을 직접 눌러 바꿀 수도 있어요(가장 높은 별이 기록돼요).

### 처음 실행할 때 휴대폰에서 확인할 것
1. 마이크 권한, (아이폰) 음성 인식 권한 → **허용**
2. 설정 → 텍스트 음성 변환(안드로이드) / 손쉬운 사용 → 읽기 및 말하기 → 음성(아이폰)에서
   자주 쓰는 언어(영어·일본어·중국어 등) 음성을 내려받아 두면 원어민 소리가 더 자연스러워요.
3. 안드로이드는 Google 앱의 **오프라인 음성 인식** 언어도 받아 두면 인식이 빨라요.

### (선택) 원어민 음성 파일 미리 만들기 — 웹 버전·시험용
```bash
pip install edge-tts
python tools/make_voices.py   # www/refvoice/ 에 401개 문장 mp3 생성
npx cap sync
```
마이크로소프트 엣지 '소리 내어 읽기' 목소리를 쓰는 무료 방식이라, 스토어 정식 출시용에는 기본 동작(휴대폰 음성)을 추천해요.

### 직접 만든 앱 코드 위치
- 안드로이드: `android/app/src/main/java/com/uriai/kidquiz/VoiceCoachPlugin.java` (MainActivity에서 등록)
- 아이폰: `ios/App/App/VoiceCoachPlugin.swift`, `MainViewController.swift` (SceneDelegate에서 사용)
- 앱 ID를 바꾸면 안드로이드 자바 파일의 `package` 줄과 폴더 이름도 같이 바꿔야 해요.
