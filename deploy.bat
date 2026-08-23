@echo off
setlocal
cd /d "%~dp0"

echo.
echo  ==========================================
echo   RIDGE SOUND  -  deploy to ridgesound.com
echo  ==========================================
echo.

rem Cowork's file bridge cannot delete files, so git sometimes
rem leaves a stale lock behind. Clear it before doing anything.
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock"  del /f /q ".git\HEAD.lock"

echo  [1/4] Staging changes...
git add -A
if errorlevel 1 goto fail

git diff --cached --quiet
if errorlevel 1 (
    echo  [2/4] Committing...
    git commit -m "Update Ridge Sound website"
    if errorlevel 1 goto fail
) else (
    echo  [2/4] Nothing new to commit.
)

echo  [3/4] Syncing with GitHub...
git pull --rebase
if errorlevel 1 goto fail

echo  [4/4] Pushing...
git push
if errorlevel 1 goto fail

echo.
echo  Done. Live at https://ridgesound.com in about a minute.
echo  Hard-refresh with Ctrl+Shift+R if you still see the old page.
echo.
pause
exit /b 0

:fail
echo.
echo  ---------------------------------------------
echo   Something went wrong - see the message above.
echo  ---------------------------------------------
echo.
pause
exit /b 1
