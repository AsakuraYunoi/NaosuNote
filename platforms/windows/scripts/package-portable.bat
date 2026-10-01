@echo off
chcp 65001 >nul
title NaosuNote Windows x64 打包工具

echo ====================================================
echo     NaosuNote Windows x64 单文件应用一键打包
echo ====================================================
echo 正在启动 PowerShell 打包流水线...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0package-portable.ps1" %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [错误] 打包过程中出现异常，错误代码: %ERRORLEVEL%
) else (
    echo.
    echo [完成] 打包任务已顺利结束！
)

echo 按任意键退出...
pause >nul
