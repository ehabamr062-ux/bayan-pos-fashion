@echo off
chcp 65001 > nul
cd /d "%~dp0"
cls
echo ======================================================
echo    🚀 أداة الرفع المباشر لنسخة الـ PWA على GitHub
echo    📦 المشروع: Bayan POS Fashion (v3.2.2)
echo ======================================================
echo.

git branch -M main

echo [1/3] فحص وتجهيز التعديلات للرفع...
git add -u
git commit -m "تحديث شامل وترقية إلى الإصدار v3.2.2 - مزامنة التقارير وSQLite والتحسينات المعتمدة"
git status --short

echo.
echo [2/3] جاري محاولة الرفع المباشر إلى GitHub...
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ======================================================
    echo 🎉 تم رفع نسخة الـ PWA بنجاح تام إلى GitHub!
    echo 🌐 رابط الموقع المحدث (GitHub Pages) سيتحدث تلقائياً.
    echo ======================================================
) else (
    echo.
    echo ⚠️ إذا ظهرت نافذة تسجيل الدخول من GitHub في المتصفح، يرجى إتمامها ثم إعادة المحاولة.
)

echo.
pause
