# MY PT — 개인 PT 트레이너 앱

달력 기반 운동 기록, 오늘의 추천 운동, 체중/칼로리 트래킹, 건강검진 추세 관리를 제공하는 개인용 헬스 앱입니다.

## 건강검진 탭

매년 받은 건강검진 결과지(PDF 또는 사진)를 올리면 수치를 자동으로 읽어서 연도별 추세와 신경 써야 할 항목을 보여줍니다.

- **결과지 읽기**: Claude API로 PDF/사진에서 수치를 뽑아 표준 항목(공복혈당, ALT, 중성지방 등 약 30개)에 맞춥니다. 병원마다 다른 항목명(AST/SGOT/GOT 등)도 같은 항목으로 묶입니다. 저장 전에 확인 화면에서 값을 고칠 수 있습니다.
- **신경 쓸 항목**: 국가건강검진 기준으로 정상/주의/이상을 판정하고, 정상 범위 안이라도 해마다 나빠지는 항목, 대사증후군 기준(5개 중 몇 개 해당)까지 함께 짚어 줍니다. 이 판정은 앱 안에서 계산하며 API를 쓰지 않습니다.
- **AI 리포트**: 전체 기록을 바탕으로 요약, 생활에서 해볼 것, 다음 진료 때 물어볼 것을 정리합니다.
- 처음 쓸 때 지난 몇 년 치 결과지를 한 번에 올려 두면 바로 추세를 볼 수 있습니다.

### 설정

1. [console.anthropic.com](https://console.anthropic.com)에서 API 키를 만듭니다.
2. 검진 탭 오른쪽 위 톱니바퀴에서 성별과 API 키를 입력합니다. 성별은 허리둘레, 감마GTP, 혈색소처럼 남녀 기준이 다른 항목의 판정에 쓰입니다.

API 키는 이 기기의 브라우저(localStorage)에만 저장되고, 결과지는 Anthropic API로만 전송됩니다. 혼자 쓰는 앱을 전제로 한 방식이니, 배포한 주소를 다른 사람과 공유하더라도 키는 각자 입력하게 됩니다.

암호가 걸린 PDF는 읽을 수 없습니다. PDF 뷰어에서 암호를 풀고 다시 저장한 뒤 올려 주세요.

### 백업

검진 기록도 브라우저에만 저장됩니다. 검진 설정 화면의 **내보내기/불러오기**로 JSON 백업 파일을 주기적으로 만들어 두세요.

## 휴대폰 홈 화면에 추가

GitHub Pages로 배포한 주소를 휴대폰 브라우저로 열고 "홈 화면에 추가"(iOS Safari: 공유 → 홈 화면에 추가)를 누르면 앱처럼 전체 화면으로 열립니다.

## 로컬 실행

```bash
npm install
npm run dev
```

`http://localhost:5173` 에서 확인할 수 있습니다.

## 데이터 저장 방식

원래 Claude 아티팩트 안에서는 `window.storage` API로 데이터를 저장했지만,
이 프로젝트에서는 브라우저의 `localStorage`를 쓰도록 바꿨습니다 (`src/storage.js`).
즉 데이터는 **이 앱을 연 브라우저/기기에만** 저장되고, 기기 간에 자동으로
동기화되지는 않습니다.

## GitHub에 올리기

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<사용자명>/<저장소명>.git
git push -u origin main
```

## GitHub Pages로 배포하기

1. 위 "GitHub에 올리기" 과정을 먼저 진행합니다.
2. 배포에 필요한 패키지를 설치합니다 (이미 `package.json`에 포함돼 있음):
   ```bash
   npm install
   ```
3. 빌드 후 `gh-pages` 브랜치로 배포합니다:
   ```bash
   npm run deploy
   ```
4. GitHub 저장소 → **Settings → Pages**에서 Source를 `gh-pages` 브랜치로 설정합니다.
5. 잠시 후 `https://<사용자명>.github.io/<저장소명>/` 에서 접속할 수 있습니다.

## 사용 기술

- React + Vite
- Tailwind CSS (CDN)
- lucide-react (아이콘)
- Recharts (그래프)
- Anthropic SDK (검진 결과지 읽기, AI 리포트)
- recharts (체중 변화 그래프)
