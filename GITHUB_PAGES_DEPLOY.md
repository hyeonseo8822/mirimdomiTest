# GitHub Pages 배포 가이드 (README 표시 문제 해결)

## 문제: README가 표시되는 경우

GitHub Pages에서 README가 표시되는 것은 빌드된 파일이 `gh-pages` 브랜치에 없거나, GitHub Pages 설정이 잘못되었을 때 발생합니다.

## 해결 방법

### 방법 1: 로컬에서 수동 배포 (권장)

1. **gh-pages 패키지 설치**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **빌드 및 배포**
   ```bash
   npm run deploy
   ```

3. **GitHub Pages 설정 확인**
   - GitHub 리포지토리 → Settings → Pages
   - Source를 "Deploy from a branch"로 설정
   - Branch를 `gh-pages`로 설정
   - Folder를 `/ (root)`로 설정

### 방법 2: GitHub Actions 사용

1. **GitHub Secrets 설정**
   - GitHub 리포지토리 → Settings → Secrets and variables → Actions
   - 다음 Secrets 추가:
     - `REACT_APP_GOOGLE_CLIENT_ID`
     - `REACT_APP_SUPABASE_URL`
     - `REACT_APP_SUPABASE_ANON_KEY`
     - `REACT_APP_NEIS_API_KEY`

2. **GitHub Pages 설정**
   - GitHub 리포지토리 → Settings → Pages
   - Source를 "GitHub Actions"로 설정

3. **자동 배포**
   - `main` 브랜치에 push하면 자동으로 배포됩니다.

## 확인 사항

1. **gh-pages 브랜치 확인**
   - GitHub 리포지토리에서 `gh-pages` 브랜치가 있는지 확인
   - `gh-pages` 브랜치에 `index.html` 파일이 있는지 확인

2. **빌드 확인**
   ```bash
   npm run build
   ```
   - `build` 폴더에 `index.html`이 생성되는지 확인

3. **배포 확인**
   - 배포 후 5-10분 정도 기다리기
   - 브라우저 캐시 삭제 후 다시 접속

## 문제 해결

### README가 계속 표시되는 경우

1. **gh-pages 브랜치 확인**
   ```bash
   git branch -a
   ```
   - `gh-pages` 브랜치가 있는지 확인

2. **수동으로 gh-pages 브랜치 생성**
   ```bash
   npm run build
   git checkout --orphan gh-pages
   git rm -rf .
   cp -r build/* .
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin gh-pages
   ```

3. **GitHub Pages 설정 재확인**
   - Settings → Pages → Source를 `gh-pages` 브랜치로 설정







