@echo off
setlocal EnableExtensions

REM SPDX-License-Identifier: MIT

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%frontend-react"
if not defined FRONTEND_BUILD_DRIVE set "FRONTEND_BUILD_DRIVE=K:"

cd /d "%ROOT_DIR%"

if not exist "%FRONTEND_DIR%\dist\index.html" (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] npm was not found and frontend-react\dist does not exist.
    exit /b 1
  )
  call :build_frontend_dist
  if errorlevel 1 exit /b 1
)

python run_frontend.py
endlocal
exit /b %ERRORLEVEL%

:build_frontend_dist
setlocal EnableExtensions
set "BUILD_FRONTEND=%FRONTEND_DIR%"
set "MAPPED_DRIVE="

if not exist "%FRONTEND_BUILD_DRIVE%\" (
  subst %FRONTEND_BUILD_DRIVE% "%ROOT_DIR:~0,-1%"
  if not errorlevel 1 (
    set "MAPPED_DRIVE=1"
    set "BUILD_FRONTEND=%FRONTEND_BUILD_DRIVE%\frontend-react"
  )
)

pushd "%BUILD_FRONTEND%"
if not exist node_modules call npm ci
if errorlevel 1 (
  popd
  goto :build_frontend_dist_fail
)
call npm run build
set "NPM_CODE=%ERRORLEVEL%"
popd
if not "%NPM_CODE%"=="0" goto :build_frontend_dist_fail

if defined MAPPED_DRIVE subst %FRONTEND_BUILD_DRIVE% /d
endlocal
exit /b 0

:build_frontend_dist_fail
if defined MAPPED_DRIVE subst %FRONTEND_BUILD_DRIVE% /d
endlocal
exit /b 1
