@echo off
setlocal EnableExtensions
rem ======================================================================
rem  TapIt Studio: copy THIS version into your test project.
rem  Put this file in the NEW folder (next to the "studio" folder) and
rem  double-click it. It never touches your database, uploads, .env files,
rem  .idea (WebStorm settings), node_modules or your flows and handoffs.
rem  A full backup of your test project is made first.
rem
rem  Add /dry to see what would happen without changing anything:
rem      UPDATE-TEST-PROJECT.bat /dry
rem ======================================================================

rem === EDIT THIS LINE if your test project is somewhere else ===
set "TARGET=D:\Projects\2026\tapit\tapit.info-studio-v0"
rem ===============================================================

set "SOURCE=%~dp0"
if "%SOURCE:~-1%"=="\" set "SOURCE=%SOURCE:~0,-1%"
set "DRY="
if /i "%~1"=="/dry" set "DRY=/L"
set "FAILED=0"

echo.
echo  TapIt Studio update
echo  -------------------
echo  New version (copy FROM): %SOURCE%
echo  Test project (copy TO):  %TARGET%
if defined DRY echo  DRY RUN: nothing will be changed.
echo.

if not exist "%SOURCE%\studio\package.json" goto :nosource
if not exist "%TARGET%\studio\package.json" goto :notarget
if /i "%SOURCE%"=="%TARGET%" goto :same

rem A running dev server would be using the files we are about to replace.
netstat -ano | findstr /R /C:":3100 .*LISTENING" >nul
if not errorlevel 1 goto :running

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
set "BACKUP=%TARGET%-backup-%STAMP%"
set "LOG=%TARGET%-update-log-%STAMP%.txt"

echo  What will happen:
echo    1. Back up your test project to: %BACKUP%
echo       (everything except node_modules and the .next cache)
echo    2. Replace the code in your test project with the new version.
echo    3. Keep as they are: studio\data, .env files, .idea, node_modules,
echo       planning\flows (only NEW flow files are added), planning\handoffs.
echo    4. Run npm install.
echo.
set "OK="
set /p "OK=  Type YES and press Enter to continue (anything else cancels): "
if /i not "%OK%"=="YES" goto :cancelled

echo.
echo  [1/4] Backing up...
call :rc "%TARGET%" "%BACKUP%" /E /XD node_modules .next

echo  [2/4] Copying the new version...
for %%D in (app components lib scripts vendor prototypes public) do if exist "%SOURCE%\studio\%%D" call :rc "%SOURCE%\studio\%%D" "%TARGET%\studio\%%D" /MIR
call :rc "%SOURCE%\studio" "%TARGET%\studio" /LEV:1 /XF .env .env.local .env.production .env.production.local .env.development.local
for %%D in (.github mockups docs) do if exist "%SOURCE%\%%D" call :rc "%SOURCE%\%%D" "%TARGET%\%%D" /MIR
call :rc "%SOURCE%" "%TARGET%" /LEV:1 /XF UPDATE-TEST-PROJECT.bat
call :rc "%SOURCE%\planning" "%TARGET%\planning" /E /XD flows handoffs
if exist "%SOURCE%\planning\flows" call :rc "%SOURCE%\planning\flows" "%TARGET%\planning\flows" /E /XC /XN /XO

echo  [3/4] Clearing the build cache and old leftovers...
if not defined DRY if exist "%TARGET%\studio\public\prototypes" rmdir /s /q "%TARGET%\studio\public\prototypes"
if not defined DRY if exist "%TARGET%\studio\.next" rmdir /s /q "%TARGET%\studio\.next"

echo  [4/4] Installing packages...
if defined DRY goto :skipnpm
pushd "%TARGET%\studio"
call npm install
popd
:skipnpm

echo.
if "%FAILED%"=="1" goto :partial
echo  Done.
echo.
echo  Next:
echo    1. In WebStorm, open the test project's "studio" folder and run "npm run dev".
echo    2. Hard-refresh the browser (Ctrl+Shift+R).
echo    3. Check the top bar shows the new version next to "TapIt Studio".
echo.
echo  Backup: %BACKUP%
echo  Log:    %LOG%
echo  To undo: copy the contents of the backup folder back over your test project.
echo.
pause
exit /b 0

:partial
echo  Finished, but some files could not be copied (see the log).
echo  Your backup is safe: %BACKUP%
echo  Log: %LOG%
echo.
pause
exit /b 1

:rc
robocopy %* %DRY% /R:1 /W:1 /NP /NJH /NJS /LOG+:"%LOG%" >nul
if errorlevel 8 set "FAILED=1"
exit /b 0

:nosource
echo  Stopped: this file must sit in the NEW folder, next to its "studio" folder.
echo  Could not find: %SOURCE%\studio\package.json
echo.
pause
exit /b 1

:notarget
echo  Stopped: your test project was not found.
echo  Could not find: %TARGET%\studio\package.json
echo  Open this .bat in Notepad and fix the line that starts with: set "TARGET="
echo.
pause
exit /b 1

:same
echo  Stopped: the new version and the test project are the same folder.
echo.
pause
exit /b 1

:running
echo  Stopped: something is still running on port 3100 (the dev server).
echo  Stop it first (red square in WebStorm's Run window), then run this again.
echo  If you are not sure what it is:  netstat -ano ^| findstr :3100
echo.
pause
exit /b 1

:cancelled
echo.
echo  Cancelled. Nothing was changed.
echo.
pause
exit /b 0
