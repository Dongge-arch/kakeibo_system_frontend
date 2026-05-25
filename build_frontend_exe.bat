@echo off
setlocal EnableExtensions

REM SPDX-License-Identifier: MIT

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%frontend-react"
if not defined FRONTEND_BUILD_DRIVE set "FRONTEND_BUILD_DRIVE=K:"

cd /d "%ROOT_DIR%"

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] python was not found in PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  if not exist "%FRONTEND_DIR%\dist\index.html" (
    echo [ERROR] npm was not found and frontend-react\dist does not exist.
    echo [INFO] Install Node.js or provide an existing frontend-react\dist build.
    exit /b 1
  )
  echo [WARN] npm was not found. Reusing existing frontend-react\dist.
) else (
  call :build_frontend
  if errorlevel 1 exit /b 1
)

echo [2/3] Installing desktop packaging dependencies...
python -m pip install -r "%ROOT_DIR%requirements-frontend.txt"
if errorlevel 1 exit /b 1

echo [3/3] Packaging Windows exe...
python -m PyInstaller ^
  --clean ^
  --noconfirm ^
  --windowed ^
  --onefile ^
  --name HomeKakeiboFrontend ^
  --hidden-import webview ^
  --add-data "frontend-react\dist;frontend-react\dist" ^
  run_frontend.py
if errorlevel 1 exit /b 1

echo.
echo [OK] Windows frontend app build finished: dist\HomeKakeiboFrontend.exe
echo [OK] Put frontend-config.json next to the exe or keep it in this folder when running from source.
endlocal
exit /b 0

:build_frontend
setlocal EnableExtensions
set "BUILD_ROOT=%ROOT_DIR%"
set "BUILD_FRONTEND=%FRONTEND_DIR%"
set "MAPPED_DRIVE="

if not exist "%FRONTEND_BUILD_DRIVE%\" (
  subst %FRONTEND_BUILD_DRIVE% "%ROOT_DIR:~0,-1%"
  if errorlevel 1 (
    echo [WARN] Could not map %FRONTEND_BUILD_DRIVE%. Building from the original path.
  ) else (
    set "MAPPED_DRIVE=1"
    set "BUILD_ROOT=%FRONTEND_BUILD_DRIVE%\"
    set "BUILD_FRONTEND=%FRONTEND_BUILD_DRIVE%\frontend-react"
  )
)

if not exist "%BUILD_FRONTEND%\node_modules" (
  echo [1/3] Installing frontend dependencies...
  pushd "%BUILD_FRONTEND%"
  call npm ci
  set "NPM_CODE=%ERRORLEVEL%"
  popd
  if not "%NPM_CODE%"=="0" goto :build_frontend_fail
)

echo [1/3] Building React frontend...
pushd "%BUILD_FRONTEND%"
call npm run build
set "NPM_CODE=%ERRORLEVEL%"
popd
if not "%NPM_CODE%"=="0" goto :build_frontend_fail

if defined MAPPED_DRIVE subst %FRONTEND_BUILD_DRIVE% /d
endlocal
exit /b 0

:build_frontend_fail
if defined MAPPED_DRIVE subst %FRONTEND_BUILD_DRIVE% /d
endlocal
exit /b 1
