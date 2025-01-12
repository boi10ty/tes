@echo off
:menu
cls
echo =========================
echo 1. Sua cau hinh
echo 2. Lien he ho tro
echo 3. Thoat
echo =========================
set /p choice="Nhap lua chon cua ban (1-3): "

if "%choice%"=="1" (
    cd /d "%~dp0\app\config"
    start /wait notepad.exe "data.ts"
    git pull origin main
    git add -A
    git commit -m "Update data.ts"
    git push origin main --force
    echo Cap nhat thanh cong!
    goto menu
)

if "%choice%"=="2" (
    start https://t.me/ovftank
    goto menu
)

if "%choice%"=="3" (
    exit
)

goto menu
