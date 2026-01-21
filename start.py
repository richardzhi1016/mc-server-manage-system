#!/usr/bin/env python3
"""
启动脚本：同时运行前端和后端服务
"""
import subprocess
import sys
import os
import time
from pathlib import Path

def run_command(command, cwd=None, shell=False):
    """运行命令"""
    try:
        return subprocess.Popen(
            command if shell else command.split(),
            cwd=cwd,
            shell=shell
        )
    except Exception as e:
        print(f"启动失败: {e}")
        return None

def main():
    print("🚀 启动 Minecraft 服务器管理系统的上传服务...")

    # 获取项目根目录
    root_dir = Path(__file__).parent

    # 检查后端依赖
    requirements_file = root_dir / "requirements.txt"
    if requirements_file.exists():
        print("📦 检查并安装后端依赖...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(requirements_file)], check=True)

    # 检查前端依赖
    web_ui_dir = root_dir / "web-ui"
    if web_ui_dir.exists():
        package_json = web_ui_dir / "package.json"
        if package_json.exists():
            print("📦 检查并安装前端依赖...")
            subprocess.run(["npm", "install"], cwd=str(web_ui_dir), check=True, shell=True)

    # 创建上传目录
    upload_dir = root_dir / "app" / "servers"
    upload_dir.mkdir(parents=True, exist_ok=True)

    print("🔧 启动后端服务 (Flask)...")
    backend_process = run_command("python app/app.py", cwd=str(root_dir))

    print("⏳ 等待后端启动...")
    time.sleep(2)

    print("🎨 启动前端服务 (React)...")
    frontend_process = run_command("npm run dev", cwd=str(web_ui_dir), shell=True)

    print("\n" + "="*50)
    print("✅ 服务启动成功！")
    print("📱 前端地址: http://localhost:5173")
    print("🔧 后端API: http://localhost:5000")
    print("📤 上传API: http://localhost:5000/api/upload-package")
    print("="*50)
    print("按 Ctrl+C 停止服务")

    try:
        # 等待进程结束
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 正在停止服务...")
        if backend_process:
            backend_process.terminate()
        if frontend_process:
            frontend_process.terminate()
        print("✅ 服务已停止")

if __name__ == "__main__":
    main()