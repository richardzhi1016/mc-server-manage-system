# mc_server_manager_v2.py
import os
import subprocess
import threading
import queue
import time
import shutil
import re
import datetime
import customtkinter as ctk
from tkinter import filedialog, messagebox

# ------------------ 全局常量 ------------------
DEFAULT_SERVER_JAR = "server.jar"
READ_QUEUE_POLL_MS = 200
STOP_WAIT_SECONDS = 12
LOG_DIR = "logs"
BACKUP_DIR = "backups"
DEFAULT_XMS = "1G"
DEFAULT_XMX = "2G"
START_BUTTON_BLOCK_MS = 15000  # 启动按钮最长锁定时间（毫秒）

# ------------------ 工具函数 ------------------
def ensure_dirs():
    if not os.path.isdir(LOG_DIR):
        os.makedirs(LOG_DIR, exist_ok=True)
    if not os.path.isdir(BACKUP_DIR):
        os.makedirs(BACKUP_DIR, exist_ok=True)

def _timestamp_str():
    return datetime.datetime.now().strftime("%Y%m%d-%H%M%S")

def parse_memory_value(s):
    if not s:
        return None
    s = s.strip()
    m = re.match(r'^(\d+)([gGmM])?$', s)
    if not m:
        return None
    num = m.group(1)
    suf = m.group(2)
    if not suf:
        return f"{num}M"
    if suf.lower() == 'g':
        return f"{num}G"
    return f"{num}M"

# ------------------ 主应用类 ------------------
class PageManager(ctk.CTk):
    def __init__(self):
        super().__init__()
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        self.title("Minecraft Server Manager V2")
        self.geometry("1000x760")

        # 状态变量（替代全局）
        self.server_process = None
        self.server_running = False  # 表示已完整启动并对外提供服务
        self.stdout_queue = queue.Queue()
        self.reader_thread = None
        self.reader_thread_stop_event = threading.Event()
        self.log_file_handle = None
        self.periodic_backup_thread = None
        self.periodic_backup_stop_event = threading.Event()
        self.startup_backup_done_event = threading.Event()
        self.current_server_path = None
        # 启动过程控制
        self.start_in_progress = False

        # 备份包含项（默认 world 必备）
        self.include_mods = ctk.BooleanVar(value=False)
        self.include_plugins = ctk.BooleanVar(value=False)
        self.include_config = ctk.BooleanVar(value=False)
        self.include_serverprops = ctk.BooleanVar(value=False)
        self.include_whitelist = ctk.BooleanVar(value=False)

        # 左侧导航（用一个小菜单按钮实现弹出式样式）
        self.sidebar = ctk.CTkFrame(self, width=200)
        self.sidebar.pack(side="left", fill="y")
        # 菜单按钮（像你给的三点）
        self.menu_button = ctk.CTkButton(self.sidebar, text="⋯", width=36, command=self.toggle_nav_menu)
        self.menu_button.pack(pady=8)
        # 动态菜单框（默认隐藏）
        self.nav_menu_frame = None

        # 主区域
        self.main_frame = ctk.CTkFrame(self)
        self.main_frame.pack(side="right", fill="both", expand=True)

        # 页面容器
        self.pages = {}
        self.create_pages()
        self.show_main_page()

        # 定时拉取 stdout 队列并更新 GUI
        self.after(READ_QUEUE_POLL_MS, self.poll_stdout_queue)
        # 关闭时清理
        self.protocol("WM_DELETE_WINDOW", self.on_closing)

    # ---------------- 导航菜单 ----------------
    def toggle_nav_menu(self):
        """显示或隐藏左侧弹出菜单，宽高会自适应内容"""
        if self.nav_menu_frame and self.nav_menu_frame.winfo_ismapped():
            self.nav_menu_frame.pack_forget()
            return
        if not self.nav_menu_frame:
            self.nav_menu_frame = ctk.CTkFrame(self.sidebar, corner_radius=8)
            # 菜单项（文字长度不同，Frame 会自动调整）
            btn_main = ctk.CTkButton(self.nav_menu_frame, text="启动页面", anchor="w", command=lambda: (self.show_main_page(), self.nav_menu_frame.pack_forget()))
            btn_backup = ctk.CTkButton(self.nav_menu_frame, text="备份设置", anchor="w", command=lambda: (self.show_backup_page(), self.nav_menu_frame.pack_forget()))
            btn_extra = ctk.CTkButton(self.nav_menu_frame, text="功能待开发", anchor="w", command=lambda: (self.show_extra_page(), self.nav_menu_frame.pack_forget()))
            # 可按需添加更多项，例如归档、报告、删除（这里仅导航）
            btn_main.pack(fill="x", padx=8, pady=4)
            btn_backup.pack(fill="x", padx=8, pady=4)
            btn_extra.pack(fill="x", padx=8, pady=4)
        # 放在 menu_button 下方
        self.nav_menu_frame.pack(pady=(0,6))

    # ---------------- 页面创建 ----------------
    def create_pages(self):
        self.create_main_page()
        self.create_backup_page()
        self.create_extra_page()

    # ---------------- 主页面（原有 UI） ----------------
    def create_main_page(self):
        main_page = ctk.CTkFrame(self.main_frame)
        self.pages['main'] = main_page

        # Top controls: 选择目录 / 选择 jar
        top_frame = ctk.CTkFrame(main_page)
        top_frame.pack(fill='x', padx=12, pady=8)

        select_button = ctk.CTkButton(top_frame, text="选择服务器文件夹", command=self.select_server_folder)
        select_button.grid(row=0, column=0, padx=6, pady=6)
        choose_jar_btn = ctk.CTkButton(top_frame, text="直接选择 server.jar", command=self.choose_jar_file)
        choose_jar_btn.grid(row=0, column=1, padx=6, pady=6)

        self.folder_label = ctk.CTkLabel(top_frame, text="当前文件夹: 无")
        self.folder_label.grid(row=1, column=0, columnspan=2, sticky='w', padx=6)

        self.jar_label = ctk.CTkLabel(top_frame, text="使用Jar: 未选择")
        self.jar_label.grid(row=2, column=0, columnspan=2, sticky='w', padx=6, pady=(2,8))

        self.jar_entry = ctk.CTkEntry(top_frame, placeholder_text="server.jar 路径（可选，留空则自动检测）", width=620)
        self.jar_entry.grid(row=0, column=2, rowspan=3, padx=8, pady=6)

        # 内存设置（Xms / Xmx）
        mem_frame = ctk.CTkFrame(main_page)
        mem_frame.pack(fill='x', padx=12, pady=(4,8))
        ctk.CTkLabel(mem_frame, text="Xms:").grid(row=0, column=0, padx=6, sticky='w')
        self.xms_entry = ctk.CTkEntry(mem_frame, placeholder_text=DEFAULT_XMS, width=80)
        self.xms_entry.grid(row=0, column=1, padx=6)
        ctk.CTkLabel(mem_frame, text="Xmx:").grid(row=0, column=2, padx=6, sticky='w')
        self.xmx_entry = ctk.CTkEntry(mem_frame, placeholder_text=DEFAULT_XMX, width=80)
        self.xmx_entry.grid(row=0, column=3, padx=6)
        ctk.CTkLabel(mem_frame, text="（示例：2G 或 1024M）").grid(row=0, column=4, padx=6, sticky='w')

        # 备份简要配置（与备份页面保持同步）
        brief_frame = ctk.CTkFrame(main_page)
        brief_frame.pack(fill='x', padx=12, pady=(4,8))
        self.startup_backup_var = ctk.BooleanVar(value=True)
        self.periodic_backup_var = ctk.BooleanVar(value=False)
        ctk.CTkCheckBox(brief_frame, text="启动前自动备份", variable=self.startup_backup_var).grid(row=0, column=0, padx=6, pady=6, sticky='w')
        ctk.CTkCheckBox(brief_frame, text="运行中周期备份", variable=self.periodic_backup_var).grid(row=0, column=1, padx=6, pady=6, sticky='w')

        # 启动 / 停止 按钮 （注意：保存为 self.start_button 以便控制状态）
        self.start_button = ctk.CTkButton(main_page, text="启动服务器", command=self.start_server, width=200)
        self.start_button.pack(pady=(6,4))
        stop_button = ctk.CTkButton(main_page, text="停止服务器", command=self.stop_server, width=200)
        stop_button.pack(pady=(0,10))

        self.status_label = ctk.CTkLabel(main_page, text="服务器状态: 未运行", text_color="white")
        self.status_label.pack(pady=6)

        # 日志文本框
        self.log_text = ctk.CTkTextbox(main_page, width=940, height=360)
        self.log_text.pack(padx=12, pady=8)
        self.log_text.insert('0.0', '💡 欢迎使用 Minecraft Server Manager（增强版）！\n')
        self.log_text.configure(state='disabled')

        # 命令输入
        input_frame = ctk.CTkFrame(main_page)
        input_frame.pack(fill='x', padx=12, pady=(4,12))
        self.input_entry = ctk.CTkEntry(input_frame, placeholder_text="在此输入指令 (按回车发送)")
        self.input_entry.pack(side='left', fill='x', expand=True, padx=6, pady=6)
        self.input_entry.bind('<Return>', self.send_command)
        send_btn = ctk.CTkButton(input_frame, text="发送", command=self.send_command, width=80)
        send_btn.pack(side='right', padx=6, pady=6)

    # ---------------- 备份页面 ----------------
    def create_backup_page(self):
        backup_page = ctk.CTkFrame(self.main_frame)
        self.pages['backup'] = backup_page

        ctk.CTkLabel(backup_page, text="备份设置页面").pack(pady=12)

        # 备份目录：取消用户选择（只读）
        self.backup_dir_var = ctk.StringVar(value=os.path.abspath(BACKUP_DIR))
        ctk.CTkLabel(backup_page, text="备份目录（只读）:").pack(pady=(4,0))
        ctk.CTkLabel(backup_page, textvariable=self.backup_dir_var).pack(pady=4)

        # 备份包含项：默认仅备份 world（没有复选项），用户可勾选额外项
        ctk.CTkLabel(backup_page, text="默认会备份 world 文件夹，可额外选择以下项：").pack(pady=(8,4))
        ctk.CTkCheckBox(backup_page, text="备份 mods/（如存在）", variable=self.include_mods).pack(anchor='w', padx=12, pady=2)
        ctk.CTkCheckBox(backup_page, text="备份 plugins/（如存在）", variable=self.include_plugins).pack(anchor='w', padx=12, pady=2)
        ctk.CTkCheckBox(backup_page, text="备份 config/（如存在）", variable=self.include_config).pack(anchor='w', padx=12, pady=2)
        ctk.CTkCheckBox(backup_page, text="备份 server.properties（如存在）", variable=self.include_serverprops).pack(anchor='w', padx=12, pady=2)
        ctk.CTkCheckBox(backup_page, text="备份 whitelist.json（如存在）", variable=self.include_whitelist).pack(anchor='w', padx=12, pady=2)

        # 自动备份开关与参数（周期备份）
        self.auto_backup_enabled = ctk.BooleanVar(value=False)
        ctk.CTkSwitch(backup_page, text="启用自动备份（运行中周期备份）", variable=self.auto_backup_enabled, command=self._toggle_periodic_backup).pack(pady=10)
        ctk.CTkLabel(backup_page, text="周期(分钟):").pack(pady=(6,0))
        self.periodic_interval_entry = ctk.CTkEntry(backup_page, placeholder_text="10", width=100)
        self.periodic_interval_entry.pack(pady=4)
        ctk.CTkLabel(backup_page, text="保留最近 N 个备份:").pack(pady=(6,0))
        self.backup_keep_entry = ctk.CTkEntry(backup_page, placeholder_text="10", width=100)
        self.backup_keep_entry.pack(pady=4)

        # 立即备份 / 打开备份文件夹
        ctk.CTkButton(backup_page, text="立即备份（仅 world + 选中项）", command=self._manual_backup).pack(pady=8)
        ctk.CTkButton(backup_page, text="打开备份文件夹", command=self._open_backup_folder).pack(pady=4)

    # ---------------- 扩展页面（占位） ----------------
    def create_extra_page(self):
        extra_page = ctk.CTkFrame(self.main_frame)
        self.pages['extra'] = extra_page
        ctk.CTkLabel(extra_page, text="扩展功能页面（占位）").pack(pady=20)
        ctk.CTkLabel(extra_page, text="这里以后可以添加自动重启、崩溃检测等功能").pack(pady=8)

    # ---------------- 页面切换 ----------------
    def show_page(self, name):
        for p in self.pages.values():
            p.pack_forget()
        self.pages[name].pack(fill='both', expand=True)

    def show_main_page(self):
        self.show_page('main')

    def show_backup_page(self):
        # 页面同步：将备份选项从 main 页面反向同步
        self.auto_backup_enabled.set(self.periodic_backup_var.get())
        self.show_page('backup')

    def show_extra_page(self):
        self.show_page('extra')

    # ---------------- 文件/目录选择 ----------------
    def select_server_folder(self):
        folder = filedialog.askdirectory(title="选择 Minecraft 服务器文件夹")
        if folder:
            self.current_server_path = folder
            self.folder_label.configure(text=f"当前文件夹: {folder}")
            self.log_insert(f"📁 已选择服务器目录: {folder}")
            jar_path = self.find_server_jar(folder)
            if jar_path:
                self.jar_label.configure(text=f"使用Jar: {os.path.basename(jar_path)}")
                self.jar_entry.delete(0, 'end')
                self.jar_entry.insert(0, jar_path)
                self.log_insert(f"🔎 自动检测到 jar: {jar_path}")
            else:
                self.jar_label.configure(text="使用Jar: 未检测到")
                self.log_insert("⚠️ 未在该目录检测到 .jar 文件，请手动选择 server.jar 或放入目录中。")

    def choose_jar_file(self):
        jar_path = filedialog.askopenfilename(title="选择 server.jar", filetypes=[("Java JAR","*.jar")])
        if jar_path:
            self.jar_entry.delete(0, 'end')
            self.jar_entry.insert(0, jar_path)
            folder = os.path.dirname(jar_path)
            if folder:
                self.current_server_path = folder
                self.folder_label.configure(text=f"当前文件夹: {folder}")
            self.jar_label.configure(text=f"使用Jar: {os.path.basename(jar_path)}")
            self.log_insert(f"📥 选择 jar: {jar_path}")

    def find_server_jar(self, folder):
        if not folder:
            return None
        try:
            candidates = [f for f in os.listdir(folder) if f.lower().endswith('.jar')]
        except Exception:
            return None
        if not candidates:
            return None
        for c in candidates:
            if c.lower() == DEFAULT_SERVER_JAR:
                return os.path.join(folder, c)
        for c in candidates:
            if 'server' in c.lower() or 'minecraft' in c.lower():
                return os.path.join(folder, c)
        return os.path.join(folder, candidates[0])

    # ---------------- 日志与线程 ----------------
    def enqueue_stdout_lines(self, pipe, stop_event):
        try:
            for raw_line in iter(pipe.readline, ''):
                if stop_event.is_set():
                    break
                if raw_line is None:
                    break
                line = raw_line.rstrip('\n')
                self.stdout_queue.put(line)
        except Exception as e:
            self.stdout_queue.put(f"[读取线程错误] {e}")
        finally:
            try:
                pipe.close()
            except Exception:
                pass

    def safe_write_stdin(self, proc, data):
        try:
            if proc and proc.stdin and proc.poll() is None:
                proc.stdin.write(data)
                proc.stdin.flush()
                return True
        except Exception as e:
            self.stdout_queue.put(f"[写入 stdin 失败] {e}")
        return False

    def log_insert(self, text):
        self.stdout_queue.put(text)

    def poll_stdout_queue(self):
        try:
            updated = False
            while not self.stdout_queue.empty():
                line = self.stdout_queue.get_nowait()
                # 启动成功检测
                if not self.server_running and re.search(r"\bDone\s*\(", line):
                    self.server_running = True
                    # 启动成功 — 解除 start_in_progress 并恢复按钮
                    if self.start_in_progress:
                        self.start_in_progress = False
                        try:
                            self.start_button.configure(state="normal")
                        except Exception:
                            pass
                    self.status_label.configure(text="服务器状态: 运行中 ✅", text_color="lightgreen")
                    try:
                        messagebox.showinfo("成功", "服务器启动成功！")
                    except Exception:
                        pass
                # 进程退出情况
                if self.server_process and self.server_process.poll() is not None:
                    # 如果正在启动且进程退出，视为启动失败，解除锁定
                    if self.start_in_progress:
                        self.start_in_progress = False
                        try:
                            self.start_button.configure(state="normal")
                        except Exception:
                            pass
                    self.server_running = False
                    self.status_label.configure(text="服务器状态: 已停止 ⏹", text_color="white")
                    # 进程退出时恢复 start 按钮（以便重启）
                    try:
                        self.start_button.configure(state="normal")
                    except Exception:
                        pass
                # 插入 GUI
                try:
                    self.log_text.configure(state='normal')
                    self.log_text.insert('end', line + '\n')
                    self.log_text.see('end')
                    self.log_text.configure(state='disabled')
                except Exception:
                    pass
                # 写入日志文件
                if self.log_file_handle:
                    try:
                        self.log_file_handle.write(line + '\n')
                        self.log_file_handle.flush()
                    except Exception as e:
                        try:
                            self.log_text.configure(state='normal')
                            self.log_text.insert('end', f"[写日志失败] {e}\n")
                            self.log_text.configure(state='disabled')
                        except Exception:
                            pass
                updated = True
            if not updated and not self.server_running and self.server_process and self.server_process.poll() is None:
                self.status_label.configure(text="服务器状态: 启动中...", text_color="yellow")
        except queue.Empty:
            pass
        except Exception as e:
            try:
                self.log_text.configure(state='normal')
                self.log_text.insert('end', f"[GUI 更新异常] {e}\n")
                self.log_text.configure(state='disabled')
            except Exception:
                pass
        finally:
            self.after(READ_QUEUE_POLL_MS, self.poll_stdout_queue)

    # ---------------- 启动 / 停止 / 监控 ----------------
    def start_server(self):
        # 如果已有进程但尚未完成启动（server_running == False），先要求确认并强制关闭
        if self.server_process and self.server_process.poll() is None and not self.server_running:
            confirm = messagebox.askyesno("确认", "检测到已有未完全启动的服务器实例。是否先强制关闭该实例再启动新的服务器？")
            if confirm:
                try:
                    self.log_insert("⚠️ 正在强制终止旧的未完成启动的服务器进程...")
                    # 先尝试优雅关闭
                    try:
                        self.safe_write_stdin(self.server_process, "stop\n")
                        # 等待短时
                        try:
                            self.server_process.wait(timeout=5)
                        except Exception:
                            pass
                    except Exception:
                        pass
                    # 若仍未退出，强制 kill
                    if self.server_process.poll() is None:
                        try:
                            self.server_process.kill()
                        except Exception:
                            pass
                    try:
                        self.server_process.wait(timeout=5)
                    except Exception:
                        pass
                    self.stdout_queue.put("🔪 旧进程已被强制终止。")
                except Exception as e:
                    self.stdout_queue.put(f"[强制终止失败] {e}")
                finally:
                    # 清理旧进程状态
                    try:
                        self.reader_thread_stop_event.set()
                    except Exception:
                        pass
                    try:
                        self.periodic_backup_stop_event.set()
                    except Exception:
                        pass
                    self.server_process = None
                    self.server_running = False
            else:
                # 用户拒绝关闭旧进程，取消启动
                return

        # 防止重复点击与启动锁定：立即禁用按钮，并设置 start_in_progress
        try:
            self.start_button.configure(state="disabled")
        except Exception:
            pass
        self.start_in_progress = True
        # 15 秒后若仍在锁定中则自动解除（以避免永久不可用）
        self.after(START_BUTTON_BLOCK_MS, self._start_timeout_handler)

        # 如果服务器已经运行（已完全启动），不重复启动
        if self.server_running:
            messagebox.showinfo("提示", "服务器已经在运行！")
            try:
                self.start_button.configure(state="normal")
            except Exception:
                pass
            self.start_in_progress = False
            return

        jar_path = self.jar_entry.get().strip()
        if not jar_path and self.current_server_path:
            jar_path = self.find_server_jar(self.current_server_path)
        if not jar_path:
            messagebox.showwarning("警告", "请先选择服务器文件夹或指定 server.jar！")
            try:
                self.start_button.configure(state="normal")
            except Exception:
                pass
            self.start_in_progress = False
            return
        if not os.path.isfile(jar_path):
            messagebox.showerror("错误", f"找不到指定的 jar 文件：{jar_path}")
            try:
                self.start_button.configure(state="normal")
            except Exception:
                pass
            self.start_in_progress = False
            return
        if not shutil.which('java'):
            messagebox.showerror("错误", "未检测到 Java，可执行程序，请检查是否已安装并加入 PATH。")
            try:
                self.start_button.configure(state="normal")
            except Exception:
                pass
            self.start_in_progress = False
            return

        # 内存参数
        xms_raw = self.xms_entry.get().strip() or DEFAULT_XMS
        xmx_raw = self.xmx_entry.get().strip() or DEFAULT_XMX
        xms = parse_memory_value(xms_raw)
        xmx = parse_memory_value(xmx_raw)
        if not xms or not xmx:
            messagebox.showerror("错误", "内存设置无效，请使用数字并可带后缀 G/M（例如 2G 或 1024M）。")
            try:
                self.start_button.configure(state="normal")
            except Exception:
                pass
            self.start_in_progress = False
            return
        def to_mb(s):
            if s.lower().endswith('g'):
                return int(s[:-1]) * 1024
            if s.lower().endswith('m'):
                return int(s[:-1])
            return int(s)
        try:
            if to_mb(xmx) < to_mb(xms):
                messagebox.showerror("错误", "Xmx 必须大于或等于 Xms。")
                try:
                    self.start_button.configure(state="normal")
                except Exception:
                    pass
                self.start_in_progress = False
                return
        except Exception:
            messagebox.showerror("错误", "内存参数解析失败。")
            try:
                self.start_button.configure(state="normal")
            except Exception:
                pass
            self.start_in_progress = False
            return

        # 启动前备份（可选）
        do_startup_backup = self.startup_backup_var.get()
        backup_keep = int(self.backup_keep_entry.get()) if self.backup_keep_entry.get().isdigit() else 10
        if do_startup_backup:
            self.startup_backup_done_event.clear()
            threading.Thread(target=self._startup_backup_thread, args=(jar_path, backup_keep), daemon=True).start()
            self.log_insert("🔄 正在进行启动前备份（后台），请稍候...")
            waited = 0
            while not self.startup_backup_done_event.is_set() and waited < 120:
                time.sleep(0.2)
                try:
                    self.update()
                except Exception:
                    pass
                waited += 0.2
            if not self.startup_backup_done_event.is_set():
                self.log_insert("⚠️ 启动前备份超时，继续启动（若想确保完整备份请手动备份）。")

        # 打开日志文件
        ensure_dirs()
        log_fname = os.path.join(LOG_DIR, f"console-{_timestamp_str()}.log")
        try:
            self.log_file_handle = open(log_fname, 'a', encoding='utf-8')
            self.log_insert(f"📝 日志文件: {log_fname}")
        except Exception as e:
            self.log_file_handle = None
            self.log_insert(f"[日志文件打开失败] {e}")

        # 启动 Java 进程
        try:
            cmd = ['java', f'-Xmx{ xmx }', f'-Xms{ xms }', '-jar', jar_path, 'nogui']
            proc = subprocess.Popen(cmd, cwd=os.path.dirname(jar_path) or self.current_server_path,
                                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    text=True, bufsize=1)
        except Exception as e:
            messagebox.showerror("启动失败", f"服务器启动失败:\n{e}")
            self.status_label.configure(text="服务器状态: 未运行", text_color='white')
            try:
                self.start_button.configure(state="normal")
            except Exception:
                pass
            self.start_in_progress = False
            return

        # 启动读取线程
        self.reader_thread_stop_event.clear()
        self.reader_thread = threading.Thread(target=self.enqueue_stdout_lines, args=(proc.stdout, self.reader_thread_stop_event), daemon=True)
        self.reader_thread.start()

        self.server_process = proc
        self.server_running = False
        self.status_label.configure(text="服务器状态: 启动中...", text_color='yellow')
        try:
            self.log_text.configure(state='normal')
            self.log_text.delete('0.0', 'end')
            self.log_text.configure(state='disabled')
        except Exception:
            pass
        self.log_insert("▶ 服务器正在启动...")

        monitor_thread = threading.Thread(target=self._monitor_process_thread, args=(proc,), daemon=True)
        monitor_thread.start()

        # 周期备份（若选）
        if self.periodic_backup_var.get() or self.auto_backup_enabled.get():
            try:
                self.periodic_backup_stop_event.set()
            except Exception:
                pass
            self.periodic_backup_stop_event = threading.Event()
            self.periodic_backup_thread = threading.Thread(target=self._periodic_backup_worker, args=(proc, self.periodic_backup_stop_event), daemon=True)
            self.periodic_backup_thread.start()
            self.log_insert("⏱️ 周期备份已启用。")

    def _start_timeout_handler(self):
        # 超时解除启动锁定（若仍在启动中）
        if getattr(self, 'start_in_progress', False):
            self.start_in_progress = False
            try:
                self.start_button.configure(state="normal")
            except Exception:
                pass
            self.stdout_queue.put(f"⏱️ 启动等待已超过 {START_BUTTON_BLOCK_MS//1000} 秒，已解除按钮锁定。")

    def _enable_start_if_still_disabled(self):
        """保持向后兼容：短时恢复（一般不再使用，因为我们使用 start_in_progress 与 _start_timeout_handler）"""
        try:
            if hasattr(self, 'start_button'):
                state = self.start_button.cget("state")
                if state == "disabled" and not self.server_running:
                    try:
                        self.start_button.configure(state="normal")
                    except Exception:
                        pass
        except Exception:
            pass

    def _monitor_process_thread(self, proc):
        try:
            returncode = proc.wait()
            self.stdout_queue.put(f"⚪ 服务器进程已退出，返回码: {returncode}")
        except Exception as e:
            self.stdout_queue.put(f"[进程监控异常] {e}")
        finally:
            # 如果进程在启动过程中退出，确保解除 start_in_progress 并恢复按钮
            if self.start_in_progress:
                self.start_in_progress = False
                try:
                    self.start_button.configure(state="normal")
                except Exception:
                    pass
            self.server_running = False
            self.reader_thread_stop_event.set()
            try:
                self.periodic_backup_stop_event.set()
            except Exception:
                pass
            # 在 GUI 刷新周期里会更新状态

    def stop_server(self):
        if not self.server_process or self.server_process.poll() is not None:
            messagebox.showinfo("提示", "服务器没有运行。")
            return
        sent = self.safe_write_stdin(self.server_process, "stop\n")
        if sent:
            self.log_insert("🛑 已发送 stop 指令，正在等待服务器优雅关闭...")
        else:
            self.log_insert("⚠️ 发送 stop 指令失败，尝试强制关闭...")
        threading.Thread(target=self._stop_wait_thread, args=(self.server_process,), daemon=True).start()

    def _stop_wait_thread(self, proc):
        try:
            waited = 0
            while waited < STOP_WAIT_SECONDS:
                if proc.poll() is not None:
                    self.stdout_queue.put("✅ 服务器已优雅关闭。")
                    return
                time.sleep(1)
                waited += 1
            self.stdout_queue.put(f"⏱️ 等待 {STOP_WAIT_SECONDS} 秒后仍未退出，强制终止中...")
            try:
                proc.kill()
                self.stdout_queue.put("🔪 已强制终止服务器进程。")
            except Exception as e:
                self.stdout_queue.put(f"[强制终止失败] {e}")
        finally:
            try:
                self.reader_thread_stop_event.set()
            except Exception:
                pass
            try:
                self.periodic_backup_stop_event.set()
            except Exception:
                pass

    def send_command(self, event=None):
        cmd_text = self.input_entry.get().strip()
        if not cmd_text:
            return
        self.input_entry.delete(0, 'end')
        if self.server_process and self.server_process.poll() is None:
            ok = self.safe_write_stdin(self.server_process, cmd_text + "\n")
            if ok:
                self.log_insert(f"> {cmd_text}")
            else:
                messagebox.showerror("错误", "无法发送指令（写入 stdin 失败）。")
        else:
            messagebox.showwarning("警告", "服务器未运行，无法发送指令。")
            self.log_insert("⚠️ 服务器未运行，无法执行命令。")

    # ---------------- 备份相关（仅备份 world + 选中项） ----------------
    def _startup_backup_thread(self, jar_path, keep):
        try:
            if not self.current_server_path:
                self.stdout_queue.put("[启动备份] 未检测到服务器目录，跳过备份。")
                return
            world_folder = self.current_server_path
            note = "startup"
            self.stdout_queue.put(f"[启动备份] 开始备份（仅 world + 选中项）: {world_folder}")
            dest = self.backup_world(world_folder, self.backup_dir_var.get(), note=note)
            if dest:
                self.stdout_queue.put(f"[启动备份] 完成: {dest}")
                self.prune_backups(self.backup_dir_var.get(), keep=keep)
            else:
                self.stdout_queue.put("[启动备份] 备份失败。")
        except Exception as e:
            self.stdout_queue.put(f"[启动备份异常] {e}")
        finally:
            self.startup_backup_done_event.set()

    def _periodic_backup_worker(self, proc, stop_event):
        try:
            interval_min = int(self.periodic_interval_entry.get()) if self.periodic_interval_entry.get().isdigit() else 10
        except Exception:
            interval_min = 10
        keep = int(self.backup_keep_entry.get()) if self.backup_keep_entry.get().isdigit() else 10
        while not stop_event.is_set() and proc and proc.poll() is None:
            waited = 0
            total = interval_min * 60
            while waited < total and not stop_event.is_set() and proc.poll() is None:
                time.sleep(1)
                waited += 1
            if stop_event.is_set() or proc.poll() is not None:
                break
            self.stdout_queue.put("[周期备份] 发送 save-all...")
            self.safe_write_stdin(proc, "save-all\n")
            time.sleep(1)
            try:
                if self.current_server_path:
                    src = self.current_server_path
                    dest = self.backup_world(src, self.backup_dir_var.get(), note="periodic")
                    if dest:
                        self.stdout_queue.put(f"[周期备份] 完成: {dest}")
                        self.prune_backups(self.backup_dir_var.get(), keep=keep)
                    else:
                        self.stdout_queue.put("[周期备份] 备份失败。")
                else:
                    self.stdout_queue.put("[周期备份] 未检测到服务器目录，跳过。")
            except Exception as e:
                self.stdout_queue.put(f"[周期备份异常] {e}")
        self.stdout_queue.put("[周期备份] 已停止。")

    def backup_world(self, src_dir, dest_root, note=None):
        """
        备份逻辑：优先备份 src_dir/world（或找不到时退回整目录）
        另外根据用户选择复制额外路径/文件（mods/, plugins/, config/, server.properties, whitelist.json）
        """
        try:
            ts = _timestamp_str()
            folder_name = f"backup-{ts}"
            if note:
                safe_note = re.sub(r'[^0-9A-Za-z._-]', '_', note)
                folder_name += f"_{safe_note}"
            dest = os.path.join(dest_root, folder_name)
            os.makedirs(dest, exist_ok=True)

            # 先备份 world 目录
            world_path = os.path.join(src_dir, "world")
            if os.path.isdir(world_path):
                shutil.copytree(world_path, os.path.join(dest, "world"))
            else:
                # world 不存在：尝试检测常见 world 名称（如 world_nether 等），或作为回退复制整个目录
                found = False
                for name in os.listdir(src_dir):
                    p = os.path.join(src_dir, name)
                    if os.path.isdir(p) and os.path.exists(os.path.join(p, "region")):
                        # 认为这是一个世界目录
                        shutil.copytree(p, os.path.join(dest, name))
                        found = True
                        break
                if not found:
                    # 回退：复制整个 server 目录（保守行为并记录日志）
                    shutil.copytree(src_dir, os.path.join(dest, "server_full_backup"))
                    self.stdout_queue.put("[备份警告] 未检测到 world 目录，已回退复制整个服务器目录。")

            # 额外项：仅当存在且用户勾选时复制
            def copy_if_exists(rel_path, dest_name=None):
                src_p = os.path.join(src_dir, rel_path)
                if os.path.exists(src_p):
                    target = dest_name or os.path.basename(rel_path.rstrip("/"))
                    dst_p = os.path.join(dest, target)
                    if os.path.isdir(src_p):
                        shutil.copytree(src_p, dst_p)
                    else:
                        shutil.copy2(src_p, dst_p)

            if self.include_mods.get():
                copy_if_exists("mods", "mods")
            if self.include_plugins.get():
                copy_if_exists("plugins", "plugins")
            if self.include_config.get():
                copy_if_exists("config", "config")
            if self.include_serverprops.get():
                copy_if_exists("server.properties", "server.properties")
            if self.include_whitelist.get():
                copy_if_exists("whitelist.json", "whitelist.json")

            return dest
        except Exception as e:
            self.stdout_queue.put(f"[备份失败] {e}")
            # 清理已创建的部分备份以避免半完成目录（谨慎）
            try:
                if os.path.isdir(dest):
                    shutil.rmtree(dest)
            except Exception:
                pass
            return None

    def prune_backups(self, dest_root, keep=10):
        try:
            items = [os.path.join(dest_root, d) for d in os.listdir(dest_root)]
            items = [p for p in items if os.path.isdir(p)]
            items.sort(key=lambda p: os.path.getmtime(p), reverse=True)
            for p in items[keep:]:
                try:
                    shutil.rmtree(p)
                    self.stdout_queue.put(f"[备份清理] 删除旧备份: {p}")
                except Exception as e:
                    self.stdout_queue.put(f"[备份清理失败] {e}")
        except Exception as e:
            self.stdout_queue.put(f"[备份清理异常] {e}")

    def _manual_backup(self):
        if not self.current_server_path:
            messagebox.showwarning("警告", "未选择服务器目录，无法备份。")
            return
        keep = int(self.backup_keep_entry.get()) if self.backup_keep_entry.get().isdigit() else 10
        threading.Thread(target=lambda: self._manual_backup_worker(keep), daemon=True).start()

    def _manual_backup_worker(self, keep):
        self.stdout_queue.put("[手动备份] 开始...")
        dest = self.backup_world(self.current_server_path, self.backup_dir_var.get(), note='manual')
        if dest:
            self.stdout_queue.put(f"[手动备份] 完成: {dest}")
            self.prune_backups(self.backup_dir_var.get(), keep=keep)
        else:
            self.stdout_queue.put("[手动备份] 失败。")

    def _open_backup_folder(self):
        path = self.backup_dir_var.get()
        if not os.path.isdir(path):
            messagebox.showwarning("警告", "备份目录不存在。")
            return
        try:
            if os.name == 'nt':
                os.startfile(path)
            elif os.name == 'posix':
                subprocess.Popen(['xdg-open', path])
            else:
                messagebox.showinfo("信息", f"备份目录: {path}")
        except Exception as e:
            messagebox.showerror("错误", f"无法打开目录: {e}")

    def _toggle_periodic_backup(self):
        val = self.auto_backup_enabled.get()
        self.periodic_backup_var.set(val)

    # ---------------- 清理 / 退出 ----------------
    def on_closing(self):
        if self.server_process and self.server_process.poll() is None:
            if messagebox.askyesno("退出确认", "服务器似乎仍在运行，确定要退出并尝试关闭程序吗？"):
                try:
                    self.safe_write_stdin(self.server_process, "stop\n")
                except Exception:
                    pass
                self.reader_thread_stop_event.set()
                try:
                    self.periodic_backup_stop_event.set()
                except Exception:
                    pass
                time.sleep(0.5)
                try:
                    if self.server_process.poll() is None:
                        self.server_process.kill()
                except Exception:
                    pass
            else:
                return
        try:
            if self.log_file_handle:
                self.log_file_handle.close()    
        except Exception:
            pass
        self.destroy()

# ------------------ 运行程序 ------------------
if __name__ == '__main__':
    ensure_dirs()
    app = PageManager()
    app.mainloop()

