# MY PT — 개인 PT 트레이너 앱

달력 기반 운동 기록, 오늘의 추천 운동, 체중/칼로리 트래킹을 제공하는 개인용 헬스 앱입니다.

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
- recharts (체중 변화 그래프)
