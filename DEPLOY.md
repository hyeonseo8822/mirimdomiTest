# GitHub Pages 배포 가이드

## 1. package.json 설정

`package.json`의 `homepage` 필드를 GitHub 리포지토리 URL로 수정하세요:

```json
"homepage": "https://YOUR_USERNAME.github.io/mirimdomi"
```

예시:
- 사용자명이 `mirim`이고 리포지토리명이 `mirimdomi`인 경우: `"https://mirim.github.io/mirimdomi"`
- 사용자명이 `student`이고 리포지토리명이 `mirimdomi`인 경우: `"https://student.github.io/mirimdomi"`

## 2. 환경 변수 설정 (GitHub Secrets)

GitHub 리포지토리 → Settings → Secrets and variables → Actions에서 다음 Secrets를 추가하세요:

- `REACT_APP_GOOGLE_CLIENT_ID`
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_NEIS_API_KEY`

## 3. GitHub Pages 활성화

1. GitHub 리포지토리 → Settings → Pages
2. Source를 "GitHub Actions"로 설정
3. 또는 Source를 "Deploy from a branch"로 설정하고 branch를 `gh-pages`로 설정

## 4. 배포 방법

### 방법 1: GitHub Actions 사용 (권장)

1. `.github/workflows/deploy.yml` 파일이 이미 생성되어 있습니다.
2. `main` 브랜치에 push하면 자동으로 배포됩니다.

### 방법 2: gh-pages 패키지 사용

```bash
# gh-pages 패키지 설치
npm install --save-dev gh-pages

# 배포
npm run deploy
```

## 5. 주의사항

- `package.json`의 `homepage` 필드는 반드시 실제 GitHub Pages URL과 일치해야 합니다.
- 환경 변수는 GitHub Secrets에 저장해야 합니다.
- 첫 배포 후 몇 분 정도 기다려야 합니다.







