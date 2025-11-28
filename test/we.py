# mc_server_manager_v3_combined.py
import os
import subprocess
import threading
import queue
import time
import shutil
import re
import datetime
import zipfile
import sys
import webbrowser
import customtkinter as ctk
from tkinter import filedialog, messagebox

# 尝试导入 requests，如果没有安装则提示
try:
    import requests
except ImportError:
    messagebox.showerror("缺少依赖", "请先安装 requests 库: pip install requests")
    sys.exit(1)

# ------------------ 全局常量 ------------------
DEFAULT_SERVER_JAR = "server.jar"
READ_QUEUE_POLL_MS = 200
STOP_WAIT_SECONDS = 12
LOG_DIR = "logs"
BACKUP_DIR = "backups"
DEFAULT_XMS = "1G"
DEFAULT_XMX = "2G"
START_BUTTON_BLOCK_MS = 15000

# 奶白色按钮配色
MILKY_FG = "#F5F5DC"
MILKY_HOVER = "#F0EBD8"
MILKY_TEXT = "#111111"

# ------------------ 工具函数 (来自 main.py 移植与适配) ------------------
def ensure_dirs():
    if not os.path.isdir(LOG_DIR):
        os.makedirs(LOG_DIR, exist_ok=True)
    if not os.path.isdir(BACKUP_DIR):
        os.makedirs(BACKUP_DIR, exist_ok=True)

def _timestamp_str():
    return datetime.datetime.now().strftime("%Y%m%d-%H%M%S")

def parse_memory_value(s):
    if not s: return None
    s = s.strip()
    m = re.match(r'^(\d+)([gGmM])?$', s)
    if not m: return None
    num = m.group(1)
    suf = m.group(2)
    if not suf: return f"{num}M"
    if suf.lower() == 'g': return f"{num}G"
    return f"{num}M"

def get_required_java_version(mc_version):
    try:
        parts = mc_version.split(".")
        if mc_version.startswith("1.") and len(parts) > 1 and parts[1].isdigit():
            major = int(parts[1])
            minor = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0
        elif parts[0].isdigit():
            major = int(parts[0])
            minor = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
        else:
            return 8
        return 21 if major >= 21 or (major == 20 and minor >= 5) else 17 if major >= 17 else 8
    except Exception:
        return 8

def get_paper_versions():
    try:
        response = requests.get("https://api.papermc.io/v2/projects/paper", timeout=5)
        response.raise_for_status()
        data = response.json()
        versions = data["versions"]
        versions.reverse() # 新版本在前
        return versions
    except Exception as e:
        return []

def get_adoptium_download_url(version):
    base = f"https://api.adoptium.net/v3/assets/latest/{version}/hotspot"
    params = {"architecture": "x64", "heap_size": "normal", "image_type": "jdk", "jvm_impl": "hotspot", "os": "windows", "vendor": "eclipse"}
    try:
        response = requests.get(base, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data[0]["binary"]["package"]["link"]
    except Exception:
        return None

# ------------------ 主应用类 ------------------
class PageManager(ctk.CTk):
    def __init__(self):
        super().__init__()
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        self.title("Minecraft Server Manager V3 (Integrated)")
        self.geometry("1300x800")
        self.minsize(1100, 700)

        # 核心状态
        self.server_process = None
        self.server_running = False
        self.stdout_queue = queue.Queue()
        self.reader_thread = None
        self.reader_thread_stop_event = threading.Event()
        self.log_file_handle = None
        
        # 备份相关
        self.periodic_backup_thread = None
        self.periodic_backup_stop_event = threading.Event()
        self.startup_backup_done_event = threading.Event()
        self.periodic_backup_var = ctk.BooleanVar(value=False)
        self.startup_backup_var = ctk.BooleanVar(value=True)

        # 路径与配置
        self.current_server_path = None
        self.start_in_progress = False

        # --- 新增：主页配置变量 ---
        self.online_mode_var = ctk.BooleanVar(value=True) # True=启用(true), False=停用(false)
        self.pvp_var = ctk.BooleanVar(value=True)
        self.max_players_var = ctk.StringVar(value="20")

        # --- 新增：安装页变量 ---
        self.install_version_var = ctk.StringVar(value="请选择版本")
        self.install_path_var = ctk.StringVar(value="")
        self.install_eula_var = ctk.BooleanVar(value=False)
        self.install_online_mode_var = ctk.StringVar(value="启用") # 配合 main.py 逻辑
        self.install_java_dl_var = ctk.BooleanVar(value=False)
        self.paper_versions = []

        # UI 构建
        self._build_top_bar()
        self._build_layout()
        self._build_sidebar()
        self._build_right_area()
        self.create_pages()

        # 启动队列轮询
        self.after(READ_QUEUE_POLL_MS, self.poll_stdout_queue)
        self.protocol("WM_DELETE_WINDOW", self.on_closing)

    def _build_top_bar(self):
        top_bar = ctk.CTkFrame(self, height=36, corner_radius=0)
        top_bar.pack(side="top", fill="x")
        lbl_title = ctk.CTkLabel(top_bar, text="Minecraft Server Manager V3", anchor="w")
        lbl_title.pack(side="left", padx=8)

    def _build_layout(self):
        container = ctk.CTkFrame(self)
        container.pack(fill="both", expand=True, padx=8, pady=8)
        self.sidebar = ctk.CTkFrame(container, width=640, corner_radius=6)
        self.sidebar.pack(side="left", fill="y", padx=(0,8), pady=0)
        self.sidebar.pack_propagate(False)
        self.right_area = ctk.CTkFrame(container, corner_radius=6)
        self.right_area.pack(side="right", fill="both", expand=True)
        self.right_area.grid_rowconfigure(0, weight=1)
        self.right_area.grid_rowconfigure(1, weight=0)
        self.right_area.grid_columnconfigure(0, weight=1)

    def _build_sidebar(self):
        menu_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        menu_frame.pack(fill="x", pady=(6, 8))
        self.menu_button = ctk.CTkButton(menu_frame, text="≡", width=34, height=34,
                                         fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT,
                                         command=self.toggle_nav_menu)
        self.menu_button.pack(side="left", padx=6)
        self.nav_menu_frame = None

    def toggle_nav_menu(self):
        if self.nav_menu_frame and self.nav_menu_frame.winfo_ismapped():
            self.nav_menu_frame.destroy()
            self.nav_menu_frame = None
            return
        self.nav_menu_frame = ctk.CTkFrame(self.sidebar, corner_radius=6)
        self.nav_menu_frame.place(x=8, y=48)
        self.nav_menu_frame.lift()
        
        # 菜单项
        menus = [
            ("启动页面", 'main'),
            ("安装部署", 'install'), # 新增
            ("备份设置", 'backup'),
            ("扩展功能", 'extra')
        ]
        
        for text, page_id in menus:
            btn = ctk.CTkButton(self.nav_menu_frame, text=text, width=220,
                                fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT,
                                command=lambda p=page_id: self._close_menu_and_show(p))
            btn.pack(padx=8, pady=4)

    def _close_menu_and_show(self, page):
        if self.nav_menu_frame:
            self.nav_menu_frame.destroy()
            self.nav_menu_frame = None
        self.show_page(page)

    def _build_right_area(self):
        self.log_container = ctk.CTkFrame(self.right_area, corner_radius=6, fg_color="transparent",
                                     border_width=2, border_color="#3A86FF")
        self.log_container.grid(row=0, column=0, sticky="nsew", padx=6, pady=6)
        self.log_container.grid_columnconfigure(0, weight=1)
        self.log_container.grid_rowconfigure(0, weight=1)

        self.log_text = ctk.CTkTextbox(self.log_container, wrap="word")
        self.log_text.grid(row=0, column=0, sticky="nsew", padx=6, pady=6)
        self.log_text.insert('0.0', '💡 欢迎使用 Minecraft Server Manager V3\n')
        self.log_text.configure(state='disabled')

        self.command_container = ctk.CTkFrame(self.right_area, corner_radius=6, fg_color="transparent",
                                         border_width=2, border_color="#3A86FF")
        self.command_container.grid(row=1, column=0, sticky="ew", padx=6, pady=(0,6))
        self.command_container.grid_columnconfigure(0, weight=1)
        
        cmd_label = ctk.CTkLabel(self.command_container, text="在此输入指令 (按回车发送)", anchor="w")
        cmd_label.grid(row=0, column=0, sticky="ew", padx=10, pady=(8,2))
        
        input_row = ctk.CTkFrame(self.command_container, fg_color="transparent")
        input_row.grid(row=1, column=0, sticky="ew", padx=10, pady=(2,8))
        input_row.grid_columnconfigure(0, weight=1)
        
        self.input_entry = ctk.CTkEntry(input_row, placeholder_text="输入服务器指令...")
        self.input_entry.grid(row=0, column=0, sticky="ew", padx=(0,6), pady=0)
        self.input_entry.bind('<Return>', self.send_command)
        
        send_btn = ctk.CTkButton(input_row, text="发送", command=self.send_command,
                                 fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, width=70)
        send_btn.grid(row=0, column=1, padx=0, pady=0)

    # ---------------- 页面管理 ----------------
    def create_pages(self):
        self.page_container = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        self.page_container.pack(fill="both", expand=True)
        self.pages = {}
        
        self._create_main_page()
        self._create_install_page() # 新增
        self._create_backup_page()
        self._create_extra_page()
        
        for p in self.pages.values():
            p.place(in_=self.page_container, x=0, y=0, relwidth=1, relheight=1)
        self.show_page('main')

    def show_page(self, name):
        for p in self.pages.values(): p.lower()
        if name in self.pages:
            self.pages[name].lift()
            self.current_page = name

    # ---------------- 页面 1: 启动页面 (Main) ----------------
    def _create_main_page(self):
        page = ctk.CTkFrame(self.page_container, corner_radius=6, fg_color="transparent")
        self.pages['main'] = page
        
        # 1. 顶部选择
        btns_frame = ctk.CTkFrame(page)
        btns_frame.pack(fill="x", padx=20, pady=(0, 12))
        btns_frame.grid_columnconfigure(0, weight=1)
        btns_frame.grid_columnconfigure(1, weight=1)
        
        self.select_folder_btn = ctk.CTkButton(btns_frame, text="选择服务器文件夹", command=self.select_server_folder,
                                               fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT)
        self.select_folder_btn.grid(row=0, column=0, padx=(0, 4), sticky="ew")
        
        self.choose_jar_btn = ctk.CTkButton(btns_frame, text="选择 server.jar", command=self.choose_jar_file,
                                            fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT)
        self.choose_jar_btn.grid(row=0, column=1, padx=(4, 0), sticky="ew")

        self.folder_label = ctk.CTkLabel(page, text="当前文件夹: 未选择", anchor="w")
        self.folder_label.pack(fill="x", padx=20, pady=(8,2))
        self.jar_label = ctk.CTkLabel(page, text="使用Jar: 未选择", anchor="w")
        self.jar_label.pack(fill="x", padx=20, pady=(0,8))

        self.jar_entry = ctk.CTkEntry(page, placeholder_text="server.jar 路径")
        self.jar_entry.pack(fill="x", padx=20, pady=(0,12))

        # 2. 内存设置
        mem_card = ctk.CTkFrame(page)
        mem_card.pack(fill="x", padx=20, pady=(0,12))
        mem_card.grid_columnconfigure(0, weight=1)
        mem_card.grid_columnconfigure(1, weight=1)
        
        # Xms/Xmx Row
        xms_f = ctk.CTkFrame(mem_card, fg_color="transparent")
        xms_f.grid(row=0, column=0, padx=8, pady=8, sticky="ew")
        ctk.CTkLabel(xms_f, text="Xms:").pack(side="left", padx=(0,5))
        self.xms_entry = ctk.CTkEntry(xms_f, placeholder_text=DEFAULT_XMS, width=100)
        self.xms_entry.pack(side="left", fill="x", expand=True)
        
        xmx_f = ctk.CTkFrame(mem_card, fg_color="transparent")
        xmx_f.grid(row=0, column=1, padx=8, pady=8, sticky="ew")
        ctk.CTkLabel(xmx_f, text="Xmx:").pack(side="left", padx=(0,5))
        self.xmx_entry = ctk.CTkEntry(xmx_f, placeholder_text=DEFAULT_XMX, width=100)
        self.xmx_entry.pack(side="left", fill="x", expand=True)

        self.apply_mem_btn = ctk.CTkButton(mem_card, text="应用内存设置", command=self.apply_memory_settings,
                                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, height=28)
        self.apply_mem_btn.grid(row=1, column=0, columnspan=2, pady=(0,8))

        # 3. [新增] 简易配置 (server.properties)
        config_card = ctk.CTkFrame(page)
        config_card.pack(fill="x", padx=20, pady=(0,12))
        config_card.grid_columnconfigure(0, weight=1)
        config_card.grid_columnconfigure(1, weight=1)
        config_card.grid_columnconfigure(2, weight=1)
        
        ctk.CTkLabel(config_card, text="服务器配置 (自动读取)", font=("", 12, "bold")).grid(row=0, column=0, columnspan=3, pady=(5,5))
        
        # 正版验证
        self.online_switch = ctk.CTkSwitch(config_card, text="正版验证", variable=self.online_mode_var)
        self.online_switch.grid(row=1, column=0, padx=5, pady=5)
        
        # PVP
        self.pvp_switch = ctk.CTkSwitch(config_card, text="PVP伤害", variable=self.pvp_var)
        self.pvp_switch.grid(row=1, column=1, padx=5, pady=5)
        
        # 玩家上限
        players_f = ctk.CTkFrame(config_card, fg_color="transparent")
        players_f.grid(row=1, column=2, padx=5, pady=5)
        ctk.CTkLabel(players_f, text="人数:").pack(side="left")
        self.max_players_entry = ctk.CTkEntry(players_f, textvariable=self.max_players_var, width=50)
        self.max_players_entry.pack(side="left", padx=5)

        self.save_prop_btn = ctk.CTkButton(config_card, text="保存配置到文件", command=self.save_server_properties_gui,
                                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, height=28)
        self.save_prop_btn.grid(row=2, column=0, columnspan=3, pady=(5,8))

        # 4. 控制区
        control_card = ctk.CTkFrame(page)
        control_card.pack(fill="x", padx=20, pady=(0,12))
        control_card.grid_columnconfigure(0, weight=1)
        control_card.grid_columnconfigure(1, weight=1)
        
        self.start_button = ctk.CTkButton(control_card, text="启动服务器", command=self.start_server,
                                          fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT)
        self.start_button.grid(row=0, column=0, padx=10, pady=10, sticky="ew")
        
        stop_btn = ctk.CTkButton(control_card, text="停止服务器", command=self.stop_server,
                                 fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT)
        stop_btn.grid(row=0, column=1, padx=10, pady=10, sticky="ew")

        self.status_label = ctk.CTkLabel(page, text="服务器状态: 未运行", anchor="w")
        self.status_label.pack(fill="x", padx=20, pady=(0,8))

        # 5. 备份简略
        brief_frame = ctk.CTkFrame(page)
        brief_frame.pack(fill="x", padx=20, pady=(0,8))
        self.startup_backup_cb = ctk.CTkCheckBox(brief_frame, text="启动前自动备份", variable=self.startup_backup_var)
        self.startup_backup_cb.pack(side="left", padx=10, pady=8)
        self.periodic_backup_cb = ctk.CTkCheckBox(brief_frame, text="运行中周期备份", variable=self.periodic_backup_var)
        self.periodic_backup_cb.pack(side="left", padx=10, pady=8)

    # ---------------- 页面 2: 安装部署 (Install) ----------------
    def _create_install_page(self):
        page = ctk.CTkFrame(self.page_container, corner_radius=6, fg_color="transparent")
        self.pages['install'] = page
        
        ctk.CTkLabel(page, text="快速架設 Paper 伺服器", font=("", 18, "bold")).pack(pady=15)
        
        form_frame = ctk.CTkFrame(page)
        form_frame.pack(fill="x", padx=20, pady=10)
        
        # 游戏版本 (异步获取)
        row = 0
        ctk.CTkLabel(form_frame, text="游戏版本 (Paper):").grid(row=row, column=0, sticky="w", padx=15, pady=10)
        self.version_combo = ctk.CTkComboBox(form_frame, values=["加载中..."], variable=self.install_version_var, width=250)
        self.version_combo.grid(row=row, column=1, sticky="w", padx=10, pady=10)
        # 启动后台线程获取版本
        threading.Thread(target=self._fetch_paper_versions, daemon=True).start()
        
        # 安装位置
        row += 1
        ctk.CTkLabel(form_frame, text="安装位置:").grid(row=row, column=0, sticky="w", padx=15, pady=10)
        path_frame = ctk.CTkFrame(form_frame, fg_color="transparent")
        path_frame.grid(row=row, column=1, sticky="ew", padx=10, pady=10)
        ctk.CTkEntry(path_frame, textvariable=self.install_path_var, width=200).pack(side="left", fill="x", expand=True)
        ctk.CTkButton(path_frame, text="📂", width=40, command=self._select_install_folder,
                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT).pack(side="left", padx=5)
        
        # 正版验证 (main.py 的进阶功能)
        row += 1
        ctk.CTkLabel(form_frame, text="正版验证:").grid(row=row, column=0, sticky="w", padx=15, pady=10)
        ctk.CTkOptionMenu(form_frame, values=["启用", "停用"], variable=self.install_online_mode_var, width=250).grid(row=row, column=1, sticky="w", padx=10, pady=10)
        
        # Java 选项
        row += 1
        ctk.CTkCheckBox(form_frame, text="自动下载所需 Java 环境", variable=self.install_java_dl_var).grid(row=row, column=1, sticky="w", padx=10, pady=10)

        # EULA
        row += 1
        eula_frame = ctk.CTkFrame(form_frame, fg_color="transparent")
        eula_frame.grid(row=row, column=1, sticky="w", padx=10, pady=10)
        ctk.CTkCheckBox(eula_frame, text="我同意 EULA 条款", variable=self.install_eula_var).pack(side="left")
        ctk.CTkLabel(eula_frame, text="(点击查看)", text_color="skyblue", cursor="hand2").pack(side="left", padx=5)
        eula_frame.bind("<Button-1>", lambda e: webbrowser.open("https://account.mojang.com/documents/minecraft_eula"))

        # 部署按钮
        self.deploy_btn = ctk.CTkButton(page, text="开始部署 / 安装", height=40, font=("", 15, "bold"),
                                        fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT,
                                        command=self._start_deployment)
        self.deploy_btn.pack(pady=20, fill="x", padx=40)

    def _create_backup_page(self):
        page = ctk.CTkFrame(self.page_container, corner_radius=6, fg_color="transparent")
        self.pages['backup'] = page
        ctk.CTkLabel(page, text="备份设置", font=("", 18, "bold")).pack(pady=16)
        
        dir_frame = ctk.CTkFrame(page)
        dir_frame.pack(fill="x", padx=20, pady=(0,12))
        ctk.CTkLabel(dir_frame, text="备份目录:", font=("",12,"bold")).pack(anchor="w", padx=12, pady=(8,0))
        self.backup_dir_var = ctk.StringVar(value=os.path.abspath(BACKUP_DIR))
        ctk.CTkLabel(dir_frame, textvariable=self.backup_dir_var).pack(anchor="w", padx=12, pady=(0,8))
        
        auto_frame = ctk.CTkFrame(page)
        auto_frame.pack(fill="x", padx=20, pady=(0,12))
        auto_frame.grid_columnconfigure(0, weight=1)
        auto_frame.grid_columnconfigure(1, weight=1)
        
        # 这里的 switch 直接绑定 self.periodic_backup_var，实现同步
        self.auto_backup_switch = ctk.CTkSwitch(auto_frame, text="启用运行中周期备份", variable=self.periodic_backup_var)
        self.auto_backup_switch.grid(row=0, column=0, columnspan=2, padx=12, pady=(12,8), sticky="w")
        
        ctk.CTkLabel(auto_frame, text="周期(分钟):").grid(row=1, column=0, padx=12, sticky="w")
        self.periodic_interval_entry = ctk.CTkEntry(auto_frame, placeholder_text="10", width=100)
        self.periodic_interval_entry.grid(row=2, column=0, padx=12, pady=(0,8), sticky="w")
        
        ctk.CTkLabel(auto_frame, text="保留数量:").grid(row=1, column=1, padx=12, sticky="w")
        self.backup_keep_entry = ctk.CTkEntry(auto_frame, placeholder_text="10", width=100)
        self.backup_keep_entry.grid(row=2, column=1, padx=12, pady=(0,8), sticky="w")
        
        btn = ctk.CTkButton(auto_frame, text="应用设置", command=self.apply_periodic_backup_settings,
                            fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, width=120)
        btn.grid(row=3, column=1, pady=(0,12), padx=12, sticky="e")

        btn_frame = ctk.CTkFrame(page, fg_color="transparent")
        btn_frame.pack(fill="x", padx=20)
        ctk.CTkButton(btn_frame, text="立即备份世界", command=self._manual_backup,
                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT).pack(fill="x", pady=6)
        ctk.CTkButton(btn_frame, text="打开备份文件夹", command=self._open_backup_folder,
                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT).pack(fill="x", pady=6)

    def _create_extra_page(self):
        page = ctk.CTkFrame(self.page_container, corner_radius=6, fg_color="transparent")
        self.pages['extra'] = page
        ctk.CTkLabel(page, text="扩展功能 (占位)", font=("", 18, "bold")).pack(pady=20)

    # ---------------- 逻辑: 安装部署 (Install Logic) ----------------
    def _fetch_paper_versions(self):
        self.log_insert("🌐 正在获取 Paper 版本列表...")
        vers = get_paper_versions()
        if vers:
            self.paper_versions = vers
            self.version_combo.configure(values=vers)
            self.install_version_var.set(vers[0])
            self.log_insert(f"✅ 获取到 {len(vers)} 个版本。")
        else:
            self.log_insert("⚠️ 版本列表获取失败。")
            self.version_combo.configure(values=["获取失败"])
            self.install_version_var.set("获取失败")

    def _select_install_folder(self):
        d = filedialog.askdirectory()
        if d: self.install_path_var.set(d)

    def _start_deployment(self):
        # 1. 验证
        folder = self.install_path_var.get().strip()
        version = self.install_version_var.get()
        if not folder:
            messagebox.showwarning("提示", "请选择安装位置")
            return
        if version in ["请选择版本", "加载中...", "获取失败"]:
            messagebox.showwarning("提示", "请选择有效的游戏版本")
            return
        if not self.install_eula_var.get():
            messagebox.showwarning("提示", "必须同意 EULA 协议才能继续")
            return

        # 2. 锁定按钮，开始线程
        self.deploy_btn.configure(state="disabled", text="正在部署...")
        threading.Thread(target=self._deploy_worker, args=(folder, version), daemon=True).start()

    def _deploy_worker(self, folder, version):
        self.log_insert(f"🚀 开始在 {folder} 部署 Paper {version}...")
        
        try:
            if not os.path.exists(folder):
                os.makedirs(folder)

            # A. 下载 Java (如果勾选)
            java_path = None
            if self.install_java_dl_var.get():
                req_ver = get_required_java_version(version)
                self.log_insert(f"⬇️ 正在查找 Java {req_ver} 下载链接...")
                url = get_adoptium_download_url(req_ver)
                if url:
                    self.log_insert(f"⬇️ 开始下载 Java: {url}")
                    # 下载 zip
                    zip_path = os.path.join(folder, "java_temp.zip")
                    try:
                        with requests.get(url, stream=True) as r:
                            r.raise_for_status()
                            total_len = int(r.headers.get('content-length', 0))
                            dl = 0
                            with open(zip_path, 'wb') as f:
                                for chunk in r.iter_content(chunk_size=8192):
                                    f.write(chunk)
                                    dl += len(chunk)
                                    # 简单进度显示，每 5MB 打印一次，避免刷屏
                                    if dl % (5 * 1024 * 1024) < 8192: 
                                        self.log_insert(f"   已下载: {dl/1024/1024:.1f} MB ...")
                        self.log_insert("📦 解压 Java 中...")
                        with zipfile.ZipFile(zip_path, 'r') as z:
                            z.extractall(os.path.join(folder, f"java{req_ver}"))
                        os.remove(zip_path)
                        
                        # 寻找 java.exe
                        extract_path = os.path.join(folder, f"java{req_ver}")
                        for root, dirs, files in os.walk(extract_path):
                            if "java.exe" in files:
                                java_path = os.path.join(root, "java.exe")
                                break
                        if java_path:
                            self.log_insert(f"✅ Java 安装成功: {java_path}")
                        else:
                            self.log_insert("⚠️ 解压后未找到 java.exe")
                    except Exception as e:
                        self.log_insert(f"❌ Java 下载/安装失败: {e}")
                else:
                    self.log_insert("❌ 无法获取 Java 下载地址。")

            # B. 下载 Server Jar
            self.log_insert(f"⬇️ 正在获取 Paper {version} 最新构建...")
            try:
                builds_url = f"https://api.papermc.io/v2/projects/paper/versions/{version}"
                bd = requests.get(builds_url).json()
                latest = bd["builds"][-1]
                jar_url = f"https://api.papermc.io/v2/projects/paper/versions/{version}/builds/{latest}/downloads/paper-{version}-{latest}.jar"
                
                jar_dest = os.path.join(folder, "server.jar")
                self.log_insert(f"⬇️ 下载 Server JAR ({latest})...")
                with requests.get(jar_url, stream=True) as r:
                    r.raise_for_status()
                    with open(jar_dest, 'wb') as f:
                        for chunk in r.iter_content(8192):
                            f.write(chunk)
                self.log_insert("✅ Server JAR 下载完成。")
            except Exception as e:
                self.log_insert(f"❌ Server JAR 下载失败: {e}")
                raise e

            # C. 写入文件
            self.log_insert("📝 生成配置文件...")
            # eula.txt
            with open(os.path.join(folder, "eula.txt"), "w") as f:
                f.write("eula=true\n")
            
            # server.properties
            props_path = os.path.join(folder, "server.properties")
            om = "true" if self.install_online_mode_var.get() == "启用" else "false"
            with open(props_path, "w") as f:
                f.write(f"online-mode={om}\n")
                f.write("max-players=20\n")
                f.write("pvp=true\n")
                f.write("server-port=25565\n")
                f.write("motd=A Minecraft Server\n")
            
            # start.bat
            bat_path = os.path.join(folder, "start.bat")
            cmd_java = java_path if java_path else "java"
            with open(bat_path, "w") as f:
                f.write("@echo off\n")
                f.write(f'"{cmd_java}" -Xms2G -Xmx2G -jar server.jar nogui\n')
                f.write("pause\n")

            self.log_insert("🎉 部署完成！请切换到[启动页面]选择该文件夹启动。")
            messagebox.showinfo("成功", "部署完成！\n请前往[启动页面]选择文件夹并启动。")

        except Exception as e:
            self.log_insert(f"❌ 部署过程中止: {e}")
            messagebox.showerror("失败", str(e))
        finally:
            self.deploy_btn.configure(state="normal", text="开始部署 / 安装")


    # ---------------- 逻辑: 主页文件选择与配置读取 ----------------
    def select_server_folder(self):
        folder = filedialog.askdirectory(title="选择 Minecraft 服务器文件夹")
        if folder:
            self.current_server_path = folder
            self.folder_label.configure(text=f"当前文件夹: {folder}")
            self.log_insert(f"📁 已选择: {folder}")
            
            # 自动找 jar
            jar_path = self.find_server_jar(folder)
            if jar_path:
                self.jar_label.configure(text=f"使用Jar: {os.path.basename(jar_path)}")
                self.jar_entry.delete(0, 'end')
                self.jar_entry.insert(0, jar_path)
            
            # [新增] 读取 server.properties
            self.load_server_properties_gui(folder)

    def choose_jar_file(self):
        jar_path = filedialog.askopenfilename(title="选择 server.jar", filetypes=[("Java JAR","*.jar")])
        if jar_path:
            self.jar_entry.delete(0, 'end')
            self.jar_entry.insert(0, jar_path)
            folder = os.path.dirname(jar_path)
            if folder:
                self.current_server_path = folder
                self.folder_label.configure(text=f"当前文件夹: {folder}")
                self.load_server_properties_gui(folder)
            self.jar_label.configure(text=f"使用Jar: {os.path.basename(jar_path)}")

    def find_server_jar(self, folder):
        if not folder: return None
        try:
            cands = [f for f in os.listdir(folder) if f.lower().endswith('.jar')]
        except: return None
        if not cands: return None
        for c in cands:
            if c.lower() == DEFAULT_SERVER_JAR: return os.path.join(folder, c)
        for c in cands:
            if 'server' in c.lower() or 'minecraft' in c.lower(): return os.path.join(folder, c)
        return os.path.join(folder, cands[0])

    # [新增] 读取 server.properties 逻辑
    def load_server_properties_gui(self, folder):
        p_path = os.path.join(folder, "server.properties")
        if not os.path.exists(p_path):
            self.log_insert("⚠️ 未找到 server.properties，使用默认值。")
            return
        
        try:
            props = {}
            with open(p_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    if '=' in line and not line.strip().startswith('#'):
                        k, v = line.strip().split('=', 1)
                        props[k.strip()] = v.strip()
            
            # 应用到 GUI
            if 'online-mode' in props:
                self.online_mode_var.set(props['online-mode'].lower() == 'true')
            if 'pvp' in props:
                self.pvp_var.set(props['pvp'].lower() == 'true')
            if 'max-players' in props:
                self.max_players_var.set(props['max-players'])
            
            self.log_insert("✅ 已读取 server.properties 配置。")
        except Exception as e:
            self.log_insert(f"❌ 读取配置失败: {e}")

    # [新增] 保存 server.properties 逻辑
    def save_server_properties_gui(self):
        if not self.current_server_path:
            messagebox.showwarning("提示", "未选择服务器文件夹")
            return
        
        p_path = os.path.join(self.current_server_path, "server.properties")
        
        # 读取现有内容以保留其他设置
        lines = []
        if os.path.exists(p_path):
            with open(p_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
        else:
            lines = [] # 新文件

        new_props = {
            'online-mode': 'true' if self.online_mode_var.get() else 'false',
            'pvp': 'true' if self.pvp_var.get() else 'false',
            'max-players': self.max_players_var.get()
        }

        # 更新逻辑
        updated_keys = set()
        final_lines = []
        for line in lines:
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.split('=', 1)
                k = k.strip()
                if k in new_props:
                    final_lines.append(f"{k}={new_props[k]}\n")
                    updated_keys.add(k)
                else:
                    final_lines.append(line)
            else:
                final_lines.append(line)
        
        # 追加没找到的配置
        for k, v in new_props.items():
            if k not in updated_keys:
                if final_lines and not final_lines[-1].endswith('\n'):
                    final_lines.append('\n')
                final_lines.append(f"{k}={v}\n")

        try:
            with open(p_path, 'w', encoding='utf-8') as f:
                f.writelines(final_lines)
            self.log_insert("💾 server.properties 保存成功！")
            messagebox.showinfo("成功", "配置已保存。")
        except Exception as e:
            self.log_insert(f"❌ 保存失败: {e}")
            messagebox.showerror("错误", str(e))

    # ---------------- 逻辑: 启动 / 停止 / 线程 (保留原逻辑) ----------------
    def start_server(self):
        # 简单防重入
        if self.start_in_progress or self.server_running:
            messagebox.showinfo("提示", "服务器正在运行或启动中")
            return

        jar_path = self.jar_entry.get().strip()
        if not jar_path and self.current_server_path:
            jar_path = self.find_server_jar(self.current_server_path)
        
        if not jar_path or not os.path.isfile(jar_path):
            messagebox.showerror("错误", "无效的 jar 文件路径")
            return

        self.start_in_progress = True
        self.start_button.configure(state="disabled")
        
        # 内存
        xms = parse_memory_value(self.xms_entry.get()) or DEFAULT_XMS
        xmx = parse_memory_value(self.xmx_entry.get()) or DEFAULT_XMX

        # 启动备份
        if self.startup_backup_var.get():
            self.startup_backup_done_event.clear()
            threading.Thread(target=self._startup_backup_thread, args=(jar_path,), daemon=True).start()
            # 等待备份但不阻塞主UI (简单处理：这里为了响应性不做死循环等待，由线程自行处理)
            # 为了简化，我们直接在线程里等一下

        ensure_dirs()
        log_f = os.path.join(LOG_DIR, f"console-{_timestamp_str()}.log")
        try:
            self.log_file_handle = open(log_f, 'a', encoding='utf-8')
        except: pass

        cmd = ['java', f'-Xmx{xmx}', f'-Xms{xms}', '-jar', jar_path, 'nogui']
        cwd = os.path.dirname(jar_path)
        
        try:
            self.server_process = subprocess.Popen(cmd, cwd=cwd, stdin=subprocess.PIPE, 
                                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, 
                                                   text=True, bufsize=1)
            self.log_insert(f"🚀 启动命令: {' '.join(cmd)}")
            
            # 读取线程
            self.reader_thread_stop_event.clear()
            self.reader_thread = threading.Thread(target=self.enqueue_stdout, args=(self.server_process.stdout,), daemon=True)
            self.reader_thread.start()
            
            # 监控线程
            threading.Thread(target=self._monitor_process, daemon=True).start()
            
            # 周期备份
            if self.periodic_backup_var.get():
                self.periodic_backup_stop_event.clear()
                self.periodic_backup_thread = threading.Thread(target=self._periodic_backup_loop, daemon=True)
                self.periodic_backup_thread.start()

        except Exception as e:
            self.log_insert(f"❌ 启动异常: {e}")
            self.start_in_progress = False
            self.start_button.configure(state="normal")

    def enqueue_stdout(self, pipe):
        for line in iter(pipe.readline, ''):
            if self.reader_thread_stop_event.is_set(): break
            self.stdout_queue.put(line.rstrip())
        pipe.close()

    def poll_stdout_queue(self):
        while not self.stdout_queue.empty():
            line = self.stdout_queue.get_nowait()
            # 判定启动完成
            if not self.server_running and re.search(r"\bDone\s*\(", line):
                self.server_running = True
                self.start_in_progress = False
                self.start_button.configure(state="normal")
                self.status_label.configure(text="服务器状态: 运行中 ✅", text_color="lightgreen")
                self.update_controls_state()
            
            self.log_text.configure(state='normal')
            self.log_text.insert('end', line + '\n')
            self.log_text.see('end')
            self.log_text.configure(state='disabled')
            
            if self.log_file_handle: self.log_file_handle.write(line+'\n')
        
        self.after(READ_QUEUE_POLL_MS, self.poll_stdout_queue)

    def _monitor_process(self):
        self.server_process.wait()
        self.server_running = False
        self.start_in_progress = False
        self.stdout_queue.put("🔴 服务器进程已退出。")
        self.reader_thread_stop_event.set()
        self.periodic_backup_stop_event.set()
        # 回到主线程更新UI
        self.update_controls_state()

    def stop_server(self):
        if self.server_process and self.server_process.poll() is None:
            self.safe_write_stdin("stop\n")
            self.log_insert("🛑 发送 stop 指令...")
        else:
            messagebox.showinfo("提示", "服务器未运行")

    def safe_write_stdin(self, data):
        try:
            if self.server_process and self.server_process.stdin:
                self.server_process.stdin.write(data)
                self.server_process.stdin.flush()
        except Exception as e:
            self.log_insert(f"❌ 写入失败: {e}")

    def send_command(self, event=None):
        cmd = self.input_entry.get().strip()
        if cmd:
            self.safe_write_stdin(cmd + "\n")
            self.log_insert(f"> {cmd}")
            self.input_entry.delete(0, 'end')

    def update_controls_state(self):
        running = self.server_running
        try:
            state = "disabled" if running else "normal"
            self.xms_entry.configure(state=state)
            self.xmx_entry.configure(state=state)
            self.apply_mem_btn.configure(state=state)
            self.start_button.configure(state=state)
            self.status_label.configure(text="服务器状态: 运行中" if running else "服务器状态: 已停止", 
                                        text_color="lightgreen" if running else "white")
        except: pass

    # ---------------- 备份逻辑 (简化移植) ----------------
    def _startup_backup_thread(self, jar_path):
        folder = os.path.dirname(jar_path)
        self.stdout_queue.put(f"🔄 [启动备份] 正在备份 {folder}...")
        self.backup_world(folder, "startup")
        self.startup_backup_done_event.set()

    def _periodic_backup_loop(self):
        try:
            iv = int(self.periodic_interval_entry.get())
        except: iv = 10
        keep = 10
        self.stdout_queue.put(f"⏱️ 周期备份启动，间隔 {iv} 分钟")
        
        while not self.periodic_backup_stop_event.is_set():
            for _ in range(iv * 60):
                if self.periodic_backup_stop_event.is_set(): return
                time.sleep(1)
            
            if self.server_running:
                self.safe_write_stdin("save-all\n")
                time.sleep(2)
                self.safe_write_stdin("save-off\n")
                time.sleep(1)
                self.backup_world(self.current_server_path, "periodic")
                self.safe_write_stdin("save-on\n")

    def backup_world(self, src_dir, note):
        if not src_dir: return
        try:
            s_name = os.path.basename(src_dir)
            dest_dir = os.path.join(self.backup_dir_var.get(), s_name)
            os.makedirs(dest_dir, exist_ok=True)
            
            name = f"backup-{_timestamp_str()}_{note}"
            final_dest = os.path.join(dest_dir, name)
            
            world_path = os.path.join(src_dir, "world")
            if os.path.exists(world_path):
                shutil.copytree(world_path, os.path.join(final_dest, "world"))
                self.stdout_queue.put(f"✅ 备份完成: {name}")
            else:
                self.stdout_queue.put("⚠️ 未找到 world 文件夹，尝试全量备份...")
                # 简单处理：排除jar和backups自己
                shutil.copytree(src_dir, final_dest, ignore=shutil.ignore_patterns("*.jar", "backups", "logs"))
                self.stdout_queue.put(f"✅ 全量备份完成: {name}")

            # 清理旧备份 (简单版)
            self.prune_backups(dest_dir)

        except Exception as e:
            self.stdout_queue.put(f"❌ 备份失败: {e}")

    def prune_backups(self, folder):
        try:
            kp = int(self.backup_keep_entry.get())
        except: kp = 10
        items = sorted([os.path.join(folder, d) for d in os.listdir(folder)], key=os.path.getmtime, reverse=True)
        for i in items[kp:]:
            try: shutil.rmtree(i); self.stdout_queue.put(f"🗑️ 清理旧备份: {os.path.basename(i)}")
            except: pass

    def _manual_backup(self):
        threading.Thread(target=lambda: self.backup_world(self.current_server_path, "manual"), daemon=True).start()
    
    def _open_backup_folder(self):
        p = self.backup_dir_var.get()
        if os.path.exists(p):
            if os.name == 'nt': os.startfile(p)
            else: subprocess.Popen(['xdg-open', p])

    # ---------------- 杂项 ----------------
    def apply_memory_settings(self):
        messagebox.showinfo("OK", f"内存设置已更新: {self.xms_entry.get()} / {self.xmx_entry.get()}")

    def apply_periodic_backup_settings(self):
        messagebox.showinfo("OK", "周期备份设置已更新")

    def log_insert(self, text):
        self.stdout_queue.put(text)

    def on_closing(self):
        if self.server_process and self.server_process.poll() is None:
            if messagebox.askyesno("退出", "服务器仍在运行，确定强制退出吗？"):
                self.safe_write_stdin("stop\n")
                time.sleep(1)
                self.server_process.kill()
            else: return
        self.destroy()

if __name__ == '__main__':
    ensure_dirs()
    app = PageManager()
    app.mainloop()