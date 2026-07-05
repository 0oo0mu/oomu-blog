@echo off
chcp 65001 >nul
cd /d D:\AI\Blog
node build.js
git add .
git commit -m "글 업데이트"
git push
pause