@echo off
title MC Server Manager - 启动脚本
color 0A

echo ========================================
echo    MC Server Manager 一键启动脚本
echo ========================================
echo.

echo [1/2] 正在启动后端服务 (Python)...
start "MC-Server-Backend" cmd /k "cd /d I:\code\antigravity\mc-server-manager\mc-server-manage-system\app && python app.py"

echo [2/2] 正在启动前端服务 (Node.js)...
start "MC-Server-Frontend" cmd /k "cd /d I:\code\antigravity\mc-server-manager\mc-server-manage-system\web-ui && npm run dev"

echo.
echo ========================================
echo    服务已启动!
echo    - 后端: http://localhost:5000 (或配置端口)
echo    - 前端: http://localhost:5173 (或配置端口)
echo ========================================
echo.
echo 关闭此窗口不会影响运行中的服务
pause
