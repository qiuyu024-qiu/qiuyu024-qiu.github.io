@echo off
REM 一键发布更新：改完文件后双击本脚本即可推送
REM （首次推送需要先在 Git Bash / 命令行里设置 remote，见下方说明）
cd /d "%~dp0"
git add -A
git commit -m "update %date% %time%" || echo 没有需要提交的改动
git push
echo.
echo 推送完成。GitHub Pages 通常 1 分钟内生效，手机上刷新即新版。
pause
