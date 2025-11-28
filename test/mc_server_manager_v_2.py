# mc_server_manager_v2_ui_fixed.py
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

# 奶白色按钮配色（你要求的）
MILKY_FG = "#F5F5DC"       # 主色（奶白）
MILKY_HOVER = "#F0EBD8"    # 悬停稍深
MILKY_TEXT = "#111111"     # 文字颜色（深色，便于阅读）

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
        self.geometry("1300x760")  # 增加窗口宽度以适应更宽的左侧面板
        self.minsize(1100, 640)   # 增加最小宽度

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

        # 便捷同步选项
        self.startup_backup_var = ctk.BooleanVar(value=True)
        self.periodic_backup_var = ctk.BooleanVar(value=False)

        # 顶部标题条（贴合截图，深色，左上显示应用名）
        top_bar = ctk.CTkFrame(self, height=36, corner_radius=0)
        top_bar.pack(side="top", fill="x")
        lbl_title = ctk.CTkLabel(top_bar, text="Minecraft Server Manager V2", anchor="w")
        lbl_title.pack(side="left", padx=8)

        # 主区域：左右两栏
        container = ctk.CTkFrame(self)
        container.pack(fill="both", expand=True, padx=8, pady=8)

        # 左侧窄面板（像截图）- 宽度增加一倍
        self.sidebar = ctk.CTkFrame(container, width=640, corner_radius=6)  # 从320改为640
        self.sidebar.pack(side="left", fill="y", padx=(0,8), pady=0)
        self.sidebar.pack_propagate(False)

        # 右侧主区（日志 + 命令行）
        self.right_area = ctk.CTkFrame(container, corner_radius=6)
        self.right_area.pack(side="right", fill="both", expand=True)
        self.right_area.grid_rowconfigure(0, weight=1)  # 日志区域可扩展
        self.right_area.grid_rowconfigure(1, weight=0)  # 命令行区域固定高度
        self.right_area.grid_columnconfigure(0, weight=1)

        # 在左侧放置菜单图标（竖向三横）和按钮
        self._build_sidebar()

        # 在右侧放置日志框和命令行
        self._build_right_area()

        # 页面容器（备份 / 扩展）隐藏在 sidebar 的底部菜单中
        self.pages = {}
        self.current_page = None
        self.create_pages()

        # 定时拉取 stdout 队列并更新 GUI
        self.after(READ_QUEUE_POLL_MS, self.poll_stdout_queue)
        # 关闭时清理
        self.protocol("WM_DELETE_WINDOW", self.on_closing)

    # ---------------- 左侧面板 UI ----------------
    def _build_sidebar(self):
        # 左上角菜单图标（类似截图的三条线）
        menu_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        menu_frame.pack(fill="x", pady=(6, 8))
        self.menu_button = ctk.CTkButton(menu_frame, text="≡", width=34, height=34,
                                         fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT,
                                         command=self.toggle_nav_menu)
        self.menu_button.pack(side="left", padx=6)

        # 动态菜单容器（隐藏）
        self.nav_menu_frame = None

    def toggle_nav_menu(self):
        if self.nav_menu_frame and self.nav_menu_frame.winfo_ismapped():
            self.nav_menu_frame.destroy()
            self.nav_menu_frame = None
            return
        self.nav_menu_frame = ctk.CTkFrame(self.sidebar, corner_radius=6)
        self.nav_menu_frame.place(x=8, y=48)  # 在菜单按钮下方浮动
        
        # 确保菜单在最顶层
        self.nav_menu_frame.lift()
        
        btn_main = ctk.CTkButton(self.nav_menu_frame, text="启动页面", width=220,
                                 fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT,
                                 command=lambda: self._close_menu_and_show('main'))
        btn_backup = ctk.CTkButton(self.nav_menu_frame, text="备份设置", width=220,
                                   fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT,
                                   command=lambda: self._close_menu_and_show('backup'))
        btn_extra = ctk.CTkButton(self.nav_menu_frame, text="扩展功能", width=220,
                                  fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT,
                                  command=lambda: self._close_menu_and_show('extra'))
        btn_main.pack(padx=8, pady=(6,4))
        btn_backup.pack(padx=8, pady=4)
        btn_extra.pack(padx=8, pady=(4,8))

    def _close_menu_and_show(self, page):
        if self.nav_menu_frame:
            self.nav_menu_frame.destroy()
            self.nav_menu_frame = None
        self.show_page(page)

    # ---------------- 右侧主区（日志 + 命令行） ----------------
    def _build_right_area(self):
        # 带蓝色边框的大日志卡片（贴合截图）
        self.log_container = ctk.CTkFrame(self.right_area, corner_radius=6, fg_color="transparent",
                                     border_width=2, border_color="#3A86FF")
        self.log_container.grid(row=0, column=0, sticky="nsew", padx=6, pady=6)
        self.log_container.grid_columnconfigure(0, weight=1)
        self.log_container.grid_rowconfigure(0, weight=1)

        # 日志文本框
        self.log_text = ctk.CTkTextbox(self.log_container, wrap="word")
        self.log_text.grid(row=0, column=0, sticky="nsew", padx=6, pady=6)
        self.log_text.insert('0.0', '💡 欢迎使用 Minecraft Server Manager（增强版）！\n')
        self.log_text.configure(state='disabled')

        # 命令行区域 - 与日志区域共享相同的容器和边距
        self.command_container = ctk.CTkFrame(self.right_area, corner_radius=6, fg_color="transparent",
                                         border_width=2, border_color="#3A86FF")
        self.command_container.grid(row=1, column=0, sticky="ew", padx=6, pady=(0,6))
        self.command_container.grid_columnconfigure(0, weight=1)
        
        # 输入指令标签
        cmd_label = ctk.CTkLabel(self.command_container, text="在此输入指令 (按回车发送)", anchor="w")
        cmd_label.grid(row=0, column=0, sticky="ew", padx=10, pady=(8,2))
        
        # 输入框和发送按钮
        input_row = ctk.CTkFrame(self.command_container, fg_color="transparent")
        input_row.grid(row=1, column=0, sticky="ew", padx=10, pady=(2,8))
        input_row.grid_columnconfigure(0, weight=1)
        
        self.input_entry = ctk.CTkEntry(input_row, placeholder_text="输入服务器指令...")
        self.input_entry.grid(row=0, column=0, sticky="ew", padx=(0,6), pady=0)
        self.input_entry.bind('<Return>', self.send_command)
        
        send_btn = ctk.CTkButton(input_row, text="发送", command=self.send_command,
                                 fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, width=70)
        send_btn.grid(row=0, column=1, padx=0, pady=0)

    # ---------------- 页面创建（备份/扩展） ----------------
    def create_pages(self):
        # 创建页面容器 - 放在菜单按钮下方
        self.page_container = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        self.page_container.pack(fill="both", expand=True, padx=0, pady=0)
        
        # 主页面（启动页面）
        main_page = ctk.CTkFrame(self.page_container, corner_radius=6, fg_color="transparent")
        self.pages['main'] = main_page
        
        # 主页面内容
        # 两个顶部按钮 - 左右排列
        btns_frame = ctk.CTkFrame(main_page)
        btns_frame.pack(fill="x", padx=20, pady=(0, 12))
        btns_frame.grid_columnconfigure(0, weight=1)
        btns_frame.grid_columnconfigure(1, weight=1)
        
        self.select_folder_btn = ctk.CTkButton(btns_frame, text="选择服务器文件夹", command=self.select_server_folder,
                                               fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT)
        self.select_folder_btn.grid(row=0, column=0, padx=(0, 4), pady=0, sticky="ew")
        
        self.choose_jar_btn = ctk.CTkButton(btns_frame, text="选择 server.jar", command=self.choose_jar_file,
                                            fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT)
        self.choose_jar_btn.grid(row=0, column=1, padx=(4, 0), pady=0, sticky="ew")

        # 当前路径与使用jar标签
        self.folder_label = ctk.CTkLabel(main_page, text="当前文件夹: 未选择", anchor="w")
        self.folder_label.pack(fill="x", padx=20, pady=(8,2))
        self.jar_label = ctk.CTkLabel(main_page, text="使用Jar: 未选择", anchor="w")
        self.jar_label.pack(fill="x", padx=20, pady=(0,8))

        # Jar 路径输入框
        self.jar_entry = ctk.CTkEntry(main_page, placeholder_text="server.jar 路径（可选）")
        self.jar_entry.pack(fill="x", padx=20, pady=(0,12))

        # 内存设置 Xms/Xmx - 使用两列布局以利用更宽的空间
        mem_card = ctk.CTkFrame(main_page, corner_radius=6)
        mem_card.pack(fill="x", padx=20, pady=(0,12))
        mem_card.grid_columnconfigure(0, weight=1)
        mem_card.grid_columnconfigure(1, weight=1)
        
        # 第一行：Xms 和 Xmx
        xms_frame = ctk.CTkFrame(mem_card, fg_color="transparent")
        xms_frame.grid(row=0, column=0, padx=8, pady=8, sticky="ew")
        lbl_xms = ctk.CTkLabel(xms_frame, text="Xms:")
        lbl_xms.pack(side="left", padx=(0,8))
        self.xms_entry = ctk.CTkEntry(xms_frame, placeholder_text=DEFAULT_XMS, width=120)
        self.xms_entry.pack(side="left", fill="x", expand=True)
        
        xmx_frame = ctk.CTkFrame(mem_card, fg_color="transparent")
        xmx_frame.grid(row=0, column=1, padx=8, pady=8, sticky="ew")
        lbl_xmx = ctk.CTkLabel(xmx_frame, text="Xmx:")
        lbl_xmx.pack(side="left", padx=(0,8))
        self.xmx_entry = ctk.CTkEntry(xmx_frame, placeholder_text=DEFAULT_XMX, width=120)
        self.xmx_entry.pack(side="left", fill="x", expand=True)
        
        # 第二行：示例文本和应用按钮在同一行
        hint_btn_frame = ctk.CTkFrame(mem_card, fg_color="transparent")
        hint_btn_frame.grid(row=1, column=0, columnspan=2, padx=8, pady=(0,8), sticky="ew")
        hint_btn_frame.grid_columnconfigure(0, weight=1)
        hint_btn_frame.grid_columnconfigure(1, weight=0)
        
        # 提示文本
        lbl_hint = ctk.CTkLabel(hint_btn_frame, text="（示例：2G 或 1024M）")
        lbl_hint.grid(row=0, column=0, padx=(0,8), pady=0, sticky="w")
        
        # 应用内存设置按钮
        self.apply_mem_btn = ctk.CTkButton(hint_btn_frame, text="应用内存设置", command=self.apply_memory_settings,
                                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, width=120)
        self.apply_mem_btn.grid(row=0, column=1, padx=0, pady=0)

        # 启动/停止 按钮 - 左右排列
        control_card = ctk.CTkFrame(main_page, corner_radius=6)
        control_card.pack(fill="x", padx=20, pady=(0,12))
        control_card.grid_columnconfigure(0, weight=1)
        control_card.grid_columnconfigure(1, weight=1)
        
        self.start_button = ctk.CTkButton(control_card, text="启动服务器", command=self.start_server,
                                          fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT)
        self.start_button.grid(row=0, column=0, padx=(10, 5), pady=10, sticky="ew")
        
        stop_btn = ctk.CTkButton(control_card, text="停止服务器", command=self.stop_server,
                                 fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT)
        stop_btn.grid(row=0, column=1, padx=(5, 10), pady=10, sticky="ew")

        # 状态条
        self.status_label = ctk.CTkLabel(main_page, text="服务器状态: 未运行", anchor="w")
        self.status_label.pack(fill="x", padx=20, pady=(0,8))

        # 简要备份设置 - 使用两列布局
        brief_frame = ctk.CTkFrame(main_page, corner_radius=6)
        brief_frame.pack(fill="x", padx=20, pady=(0,8))
        brief_frame.grid_columnconfigure(0, weight=1)
        brief_frame.grid_columnconfigure(1, weight=1)
        
        self.startup_backup_cb = ctk.CTkCheckBox(brief_frame, text="启动前自动备份", variable=self.startup_backup_var)
        self.startup_backup_cb.grid(row=0, column=0, padx=8, pady=8, sticky="w")
        self.periodic_backup_cb = ctk.CTkCheckBox(brief_frame, text="运行中周期备份", variable=self.periodic_backup_var)
        self.periodic_backup_cb.grid(row=0, column=1, padx=8, pady=8, sticky="w")
        
        # 备份页面
        backup_page = ctk.CTkFrame(self.page_container, corner_radius=6, fg_color="transparent")
        self.pages['backup'] = backup_page
        
        # 备份页面内容 - 使用更宽的布局
        ctk.CTkLabel(backup_page, text="备份设置", font=ctk.CTkFont(size=18, weight="bold")).pack(pady=16)
        
        # 备份目录信息
        dir_frame = ctk.CTkFrame(backup_page, corner_radius=6)
        dir_frame.pack(fill="x", padx=20, pady=(0,12))
        ctk.CTkLabel(dir_frame, text="备份目录（只读）:", font=ctk.CTkFont(weight="bold")).pack(anchor="w", padx=12, pady=(8,0))
        self.backup_dir_var = ctk.StringVar(value=os.path.abspath(BACKUP_DIR))
        ctk.CTkLabel(dir_frame, textvariable=self.backup_dir_var, wraplength=500).pack(anchor="w", padx=12, pady=(0,8))
        
        ctk.CTkLabel(backup_page, text="只备份世界文件夹，使用安全备份流程", font=ctk.CTkFont(weight="bold")).pack(anchor="w", padx=20, pady=(8,4))
        
        # 自动备份设置 - 放在同一个背景格子内
        auto_frame = ctk.CTkFrame(backup_page, corner_radius=6)
        auto_frame.pack(fill="x", padx=20, pady=(0,12))
        auto_frame.grid_columnconfigure(0, weight=1)
        auto_frame.grid_columnconfigure(1, weight=1)
        
        # 启用自动备份开关
        # [修改点] 直接绑定 self.periodic_backup_var，实现与主页面复选框的同步
        self.auto_backup_switch = ctk.CTkSwitch(auto_frame, text="启用自动备份（运行中周期备份）", 
                                               variable=self.periodic_backup_var)
        self.auto_backup_switch.grid(row=0, column=0, columnspan=2, padx=12, pady=(12,8), sticky="w")
        
        # 周期设置使用两列布局
        ctk.CTkLabel(auto_frame, text="周期(分钟):").grid(row=1, column=0, padx=12, pady=(8,4), sticky="w")
        ctk.CTkLabel(auto_frame, text="保留最近 N 个备份:").grid(row=1, column=1, padx=12, pady=(8,4), sticky="w")
        
        self.periodic_interval_entry = ctk.CTkEntry(auto_frame, placeholder_text="10", width=120)
        self.periodic_interval_entry.grid(row=2, column=0, padx=12, pady=(0,8), sticky="w")
        
        self.backup_keep_entry = ctk.CTkEntry(auto_frame, placeholder_text="10", width=120)
        self.backup_keep_entry.grid(row=2, column=1, padx=12, pady=(0,8), sticky="w")
        
        # 应用周期备份设置按钮 - 放在同一行右侧
        btn_hint_frame = ctk.CTkFrame(auto_frame, fg_color="transparent")
        btn_hint_frame.grid(row=3, column=0, columnspan=2, padx=12, pady=(0,12), sticky="ew")
        btn_hint_frame.grid_columnconfigure(0, weight=1)
        
        self.apply_periodic_btn = ctk.CTkButton(btn_hint_frame, text="应用周期备份设置", command=self.apply_periodic_backup_settings,
                                          fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, width=140)
        self.apply_periodic_btn.grid(row=0, column=1, padx=0, pady=0)
        
        # 操作按钮
        btn_frame = ctk.CTkFrame(backup_page, fg_color="transparent")
        btn_frame.pack(fill="x", padx=20, pady=(0,12))
        self.manual_backup_btn = ctk.CTkButton(btn_frame, text="立即备份世界", command=self._manual_backup,
                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT)
        self.manual_backup_btn.pack(fill="x", pady=6)
        self.open_backup_btn = ctk.CTkButton(btn_frame, text="打开备份文件夹", command=self._open_backup_folder,
                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT)
        self.open_backup_btn.pack(fill="x", pady=6)

        # 扩展功能页面
        extra_page = ctk.CTkFrame(self.page_container, corner_radius=6, fg_color="transparent")
        self.pages['extra'] = extra_page
        ctk.CTkLabel(extra_page, text="扩展功能页面（占位）", font=ctk.CTkFont(size=18, weight="bold")).pack(pady=20)
        ctk.CTkLabel(extra_page, text="这里以后可以添加自动重启、崩溃检测等功能", font=ctk.CTkFont(size=14)).pack(pady=8)

        # 将所有页面堆叠在一起，默认显示主页面
        for page_name, page_frame in self.pages.items():
            page_frame.place(in_=self.page_container, x=0, y=0, relwidth=1, relheight=1)
        
        # 默认显示主页面
        self.show_page('main')
        
        # 初始时更新控件状态
        self.update_controls_state()

    def show_page(self, name):
        # 将所有页面降低层级
        for page_name, page_frame in self.pages.items():
            page_frame.lower()
        
        # 将目标页面提升到顶部
        if name in self.pages:
            self.pages[name].lift()
            self.current_page = name

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
                # 启动成功检测（与原逻辑相同）
                if not self.server_running and re.search(r"\bDone\s*\(", line):
                    self.server_running = True
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
                    # 更新控件状态
                    self.update_controls_state()
                # 进程退出情况
                if self.server_process and self.server_process.poll() is not None:
                    if self.start_in_progress:
                        self.start_in_progress = False
                        try:
                            self.start_button.configure(state="normal")
                        except Exception:
                            pass
                    self.server_running = False
                    self.status_label.configure(text="服务器状态: 已停止 ⏹", text_color="white")
                    try:
                        self.start_button.configure(state="normal")
                    except Exception:
                        pass
                    # 更新控件状态
                    self.update_controls_state()
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
        if self.server_process and self.server_process.poll() is None and not self.server_running:
            confirm = messagebox.askyesno("确认", "检测到已有未完全启动的服务器实例。是否先强制关闭该实例再启动新的服务器？")
            if confirm:
                try:
                    self.log_insert("⚠️ 正在强制终止旧的未完成启动的服务器进程...")
                    try:
                        self.safe_write_stdin(self.server_process, "stop\n")
                        try:
                            self.server_process.wait(timeout=5)
                        except Exception:
                            pass
                    except Exception:
                        pass
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
                return

        try:
            self.start_button.configure(state="disabled")
        except Exception:
            pass
        self.start_in_progress = True
        self.after(START_BUTTON_BLOCK_MS, self._start_timeout_handler)

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
        backup_keep = int(self.backup_keep_entry.get()) if hasattr(self, "backup_keep_entry") and self.backup_keep_entry.get().isdigit() else 10
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

        ensure_dirs()
        log_fname = os.path.join(LOG_DIR, f"console-{_timestamp_str()}.log")
        try:
            self.log_file_handle = open(log_fname, 'a', encoding='utf-8')
            self.log_insert(f"📝 日志文件: {log_fname}")
        except Exception as e:
            self.log_file_handle = None
            self.log_insert(f"[日志文件打开失败] {e}")

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
        # [修改点] 简化判断逻辑，只检查 periodic_backup_var
        if self.periodic_backup_var.get():
            try:
                self.periodic_backup_stop_event.set()
            except Exception:
                pass
            self.periodic_backup_stop_event = threading.Event()
            self.periodic_backup_thread = threading.Thread(target=self._periodic_backup_worker, args=(proc, self.periodic_backup_stop_event), daemon=True)
            self.periodic_backup_thread.start()
            self.log_insert("⏱️ 周期备份已启用。")

    def _start_timeout_handler(self):
        if getattr(self, 'start_in_progress', False):
            self.start_in_progress = False
            try:
                self.start_button.configure(state="normal")
            except Exception:
                pass
            self.stdout_queue.put(f"⏱️ 启动等待已超过 {START_BUTTON_BLOCK_MS//1000} 秒，已解除按钮锁定。")

    def _monitor_process_thread(self, proc):
        try:
            returncode = proc.wait()
            self.stdout_queue.put(f"⚪ 服务器进程已退出，返回码: {returncode}")
        except Exception as e:
            self.stdout_queue.put(f"[进程监控异常] {e}")
        finally:
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
            # 更新控件状态
            self.update_controls_state()

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

    # ---------------- 备份相关（只备份世界，使用新的备份流程） ----------------
    def _startup_backup_thread(self, jar_path, keep):
        try:
            if not self.current_server_path:
                self.stdout_queue.put("[启动备份] 未检测到服务器目录，跳过备份。")
                return
            world_folder = self.current_server_path
            note = "startup"
            self.stdout_queue.put(f"[启动备份] 开始备份世界: {world_folder}")
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
        try:
            # 获取服务器文件夹名称
            server_name = os.path.basename(src_dir)
            
            # 创建服务器特定的备份目录
            server_backup_dir = os.path.join(dest_root, server_name)
            if not os.path.exists(server_backup_dir):
                os.makedirs(server_backup_dir)
                self.stdout_queue.put(f"[备份] 为服务器 '{server_name}' 创建新的备份目录")
            
            ts = _timestamp_str()
            folder_name = f"backup-{ts}"
            if note:
                safe_note = re.sub(r'[^0-9A-Za-z._-]', '_', note)
                folder_name += f"_{safe_note}"
            dest = os.path.join(server_backup_dir, folder_name)
            os.makedirs(dest, exist_ok=True)

            # 新的备份流程
            if self.server_process and self.server_process.poll() is None:
                # 1. 发送 save-all 确保所有数据已保存
                self.stdout_queue.put("[备份] 发送 save-all 命令...")
                self.safe_write_stdin(self.server_process, "save-all\n")
                time.sleep(3)  # 等待保存完成
                
                # 2. 发送 save-off 禁用自动保存
                self.stdout_queue.put("[备份] 发送 save-off 命令...")
                self.safe_write_stdin(self.server_process, "save-off\n")
                time.sleep(1)  # 短暂等待确保命令生效

            try:
                # 3. 复制世界文件夹
                world_path = os.path.join(src_dir, "world")
                if os.path.isdir(world_path):
                    self.stdout_queue.put("[备份] 正在复制世界文件夹...")
                    try:
                        shutil.copytree(world_path, os.path.join(dest, "world"))
                        self.stdout_queue.put("[备份] 世界文件夹复制完成")
                    except shutil.Error as e:
                        self.stdout_queue.put(f"[备份警告] 部分文件复制失败: {e}")
                        # 继续，不中断备份
                else:
                    # 如果找不到标准的 world 文件夹，尝试查找包含 region 的文件夹
                    found = False
                    for name in os.listdir(src_dir):
                        p = os.path.join(src_dir, name)
                        if os.path.isdir(p) and os.path.exists(os.path.join(p, "region")):
                            self.stdout_queue.put(f"[备份] 检测到世界文件夹: {name}")
                            try:
                                shutil.copytree(p, os.path.join(dest, name))
                                found = True
                                self.stdout_queue.put(f"[备份] 世界文件夹 {name} 复制完成")
                                break
                            except shutil.Error as e:
                                self.stdout_queue.put(f"[备份警告] 部分文件复制失败: {e}")
                    if not found:
                        self.stdout_queue.put("[备份警告] 未检测到世界文件夹，跳过备份")
                        return None

            finally:
                # 4. 重新启用自动保存（无论复制是否成功）
                if self.server_process and self.server_process.poll() is None:
                    self.stdout_queue.put("[备份] 发送 save-on 命令...")
                    self.safe_write_stdin(self.server_process, "save-on\n")
                    time.sleep(1)  # 短暂等待确保命令生效

            return dest
        except Exception as e:
            self.stdout_queue.put(f"[备份失败] {e}")
            try:
                if os.path.isdir(dest):
                    shutil.rmtree(dest)
            except Exception:
                pass
            return None

    def prune_backups(self, dest_root, keep=10):
        try:
            # 获取服务器文件夹名称
            if not self.current_server_path:
                return
            server_name = os.path.basename(self.current_server_path)
            server_backup_dir = os.path.join(dest_root, server_name)
            
            if not os.path.exists(server_backup_dir):
                return
                
            items = [os.path.join(server_backup_dir, d) for d in os.listdir(server_backup_dir)]
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

    # ---------------- 新功能：服务器运行时锁定设置 ----------------
    def update_controls_state(self):
        """根据服务器运行状态更新控件状态"""
        server_running = self.server_running or (self.server_process and self.server_process.poll() is None)
        
        # 内存设置相关控件
        memory_disabled = server_running
        self.xms_entry.configure(state="disabled" if memory_disabled else "normal")
        self.xmx_entry.configure(state="disabled" if memory_disabled else "normal")
        self.apply_mem_btn.configure(state="disabled" if memory_disabled else "normal")
        
        # 周期备份设置相关控件
        backup_disabled = server_running
        self.periodic_interval_entry.configure(state="disabled" if backup_disabled else "normal")
        self.backup_keep_entry.configure(state="disabled" if backup_disabled else "normal")
        self.apply_periodic_btn.configure(state="disabled" if backup_disabled else "normal")
        
        # 手动备份按钮 - 允许在运行时备份
        self.manual_backup_btn.configure(state="normal")
        
        # 启动前备份复选框 - 只在服务器停止时允许修改
        self.startup_backup_cb.configure(state="disabled" if server_running else "normal")
        
        # 周期备份复选框/开关 - 允许在运行时开关
        self.periodic_backup_cb.configure(state="normal")
        self.auto_backup_switch.configure(state="normal")

    # ---------------- 新功能：应用设置按钮 ----------------
    def apply_memory_settings(self):
        """应用内存设置"""
        xms_raw = self.xms_entry.get().strip() or DEFAULT_XMS
        xmx_raw = self.xmx_entry.get().strip() or DEFAULT_XMX
        xms = parse_memory_value(xms_raw)
        xmx = parse_memory_value(xmx_raw)
        
        if not xms or not xmx:
            messagebox.showerror("错误", "内存设置无效，请使用数字并可带后缀 G/M（例如 2G 或 1024M）。")
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
                return
        except Exception:
            messagebox.showerror("错误", "内存参数解析失败。")
            return
        
        messagebox.showinfo("成功", f"内存设置已更新：\nXms: {xms}\nXmx: {xmx}")
        self.log_insert(f"⚙️ 内存设置已更新：Xms={xms}, Xmx={xmx}")

    def apply_periodic_backup_settings(self):
        """应用周期备份设置"""
        try:
            interval = int(self.periodic_interval_entry.get()) if self.periodic_interval_entry.get().isdigit() else 10
            keep = int(self.backup_keep_entry.get()) if self.backup_keep_entry.get().isdigit() else 10
            
            if interval <= 0:
                messagebox.showerror("错误", "备份周期必须大于0分钟。")
                return
                
            if keep <= 0:
                messagebox.showerror("错误", "保留备份数量必须大于0。")
                return
                
            messagebox.showinfo("成功", f"周期备份设置已更新：\n备份周期: {interval} 分钟\n保留备份: {keep} 个")
            self.log_insert(f"⚙️ 周期备份设置已更新：间隔={interval}分钟, 保留={keep}个")
            
        except ValueError:
            messagebox.showerror("错误", "请输入有效的数字。")

    # ---------------- 清理 / 退出 ----------------
    def on_closing(self):
        if self.server_process and self.server_process.poll() is not None:
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