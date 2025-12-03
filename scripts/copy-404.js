// 빌드 후 404.html을 index.html의 복사본으로 만들기
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const indexHtmlPath = path.join(buildDir, 'index.html');
const notFoundHtmlPath = path.join(buildDir, '404.html');

if (fs.existsSync(indexHtmlPath)) {
  fs.copyFileSync(indexHtmlPath, notFoundHtmlPath);
  console.log('✅ 404.html 파일이 생성되었습니다.');
} else {
  console.error('❌ index.html 파일을 찾을 수 없습니다.');
  process.exit(1);
}

