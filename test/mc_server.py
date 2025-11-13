# mc_server_manager.py
"""
Minecraft 原版服务器管理器（支持启动检测与命令输入）
"""

import os
import subprocess
import threading
import customtkinter as ctk
from tkinter import filedialog, messagebox
import shutil

# ------------------ 配置 ------------------
SERVER_JAR_NAME = "server.jar"
server_process = None
current_server_path = None
server_running = False

# ------------------ 函数 ------------------
def select_server_folder():
    """选择 Minecraft 服务器文件夹"""
    global current_server_path
    folder = filedialog.askdirectory(title="选择Minecraft服务器文件夹")
    if folder:
        current_server_path = folder
        folder_label.configure(text=f"当前文件夹: {folder}")
        log_text.configure(state="normal")
        log_text.delete("0.0", "end")
        log_text.insert("end", f"📁 已选择服务器目录: {folder}\n")
        log_text.configure(state="disabled")

def start_server():
    """启动服务器"""
    global server_process, current_server_path, server_running

    if server_running:
        messagebox.showinfo("提示", "服务器已经在运行！")
        return

    if not current_server_path:
        messagebox.showwarning("警告", "请先选择服务器文件夹！")
        return

    server_jar_path = os.path.join(current_server_path, SERVER_JAR_NAME)
    if not os.path.isfile(server_jar_path):
        messagebox.showerror("错误", f"找不到 {SERVER_JAR_NAME} 文件！")
        return

    if not shutil.which("java"):
        messagebox.showerror("错误", "未检测到 Java，请检查是否安装并加入 PATH。")
        return

    def run_server():
        global server_process, server_running
        cmd = ['java', '-Xmx2G', '-Xms1G', '-jar', server_jar_path, 'nogui']
        try:
            server_process = subprocess.Popen(
                cmd,
                cwd=current_server_path,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
        except Exception as e:
            messagebox.showerror("启动失败", f"服务器启动失败:\n{e}")
            status_label.configure(text="服务器状态: 未运行", text_color="white")
            return

        status_label.configure(text="服务器状态: 正在启动...", text_color="yellow")

        log_text.configure(state="normal")
        log_text.delete("0.0", "end")
        log_text.insert("end", "▶ 服务器正在启动...\n")
        log_text.configure(state="disabled")

        # 检测 "Done" 行，确认启动成功
        for line in server_process.stdout:
            log_text.configure(state="normal")
            log_text.insert("end", line)
            log_text.see("end")
            log_text.configure(state="disabled")

            if "Done (" in line and "For help" in line:
                server_running = True
                status_label.configure(text="服务器状态: 运行中 ✅", text_color="lightgreen")
                messagebox.showinfo("成功", "服务器启动成功！")

        # 循环结束 → 服务器已关闭
        server_running = False
        status_label.configure(text="服务器状态: 已停止 ⏹", text_color="white")
        messagebox.showinfo("提示", "服务器已停止。")

    threading.Thread(target=run_server, daemon=True).start()

def stop_server():
    """发送 stop 指令"""
    global server_process, server_running
    if server_process and server_process.poll() is None:
        try:
            server_process.stdin.write("stop\n")
            server_process.stdin.flush()
            log_text.configure(state="normal")
            log_text.insert("end", "🛑 已发送 stop 指令，正在关闭服务器...\n")
            log_text.configure(state="disabled")
        except Exception as e:
            messagebox.showerror("错误", f"发送 stop 指令失败: {e}")
    else:
        messagebox.showinfo("提示", "服务器没有运行。")

def send_command(event=None):
    """发送命令输入"""
    global server_process, server_running
    cmd_text = input_entry.get().strip()
    if not cmd_text:
        return
    input_entry.delete(0, "end")
    if server_running and server_process and server_process.poll() is None:
        try:
            server_process.stdin.write(cmd_text + "\n")
            server_process.stdin.flush()
            log_text.configure(state="normal")
            log_text.insert("end", f"> {cmd_text}\n")
            log_text.configure(state="disabled")
        except Exception as e:
            messagebox.showerror("错误", f"无法发送指令: {e}")
    else:
        log_text.configure(state="normal")
        log_text.insert("end", "⚠️ 服务器未运行，无法执行命令。\n")
        log_text.configure(state="disabled")

# ------------------ GUI ------------------
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

root = ctk.CTk()
root.title("Minecraft Server Manager")
root.geometry("900x650")

select_button = ctk.CTkButton(root, text="选择服务器文件夹", command=select_server_folder)
select_button.pack(pady=10)

folder_label = ctk.CTkLabel(root, text="当前文件夹: 无")
folder_label.pack(pady=5)

start_button = ctk.CTkButton(root, text="启动服务器", command=start_server, width=200)
start_button.pack(pady=10)

stop_button = ctk.CTkButton(root, text="停止服务器", command=stop_server, width=200)
stop_button.pack(pady=10)

status_label = ctk.CTkLabel(root, text="服务器状态: 未运行", text_color="white")
status_label.pack(pady=10)

log_text = ctk.CTkTextbox(root, width=850, height=400)
log_text.pack(padx=10, pady=10)

log_text.insert("0.0", "💡 欢迎使用 Minecraft Server Manager！\n")
log_text.configure(state="disabled")

# 输入框 + 回车发送
input_frame = ctk.CTkFrame(root)
input_frame.pack(fill="x", padx=10, pady=5)
input_entry = ctk.CTkEntry(input_frame, placeholder_text="在此输入指令 (按回车发送)")
input_entry.pack(side="left", fill="x", expand=True, padx=5, pady=5)
input_entry.bind("<Return>", send_command)

root.mainloop()
