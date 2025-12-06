# mc_server_manager_v3_final_fixed.py
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
import json
import customtkinter as ctk
from tkinter import filedialog, messagebox

# Try to import requests
try:
    import requests
except ImportError:
    try:
        from tkinter import messagebox
        messagebox.showerror("缺少依赖", "请先安装 requests 库: pip install requests")
    except:
        print("缺少 requests 库，请安装: pip install requests")
    sys.exit(1)

# ------------------ 全局常量 ------------------
DEFAULT_SERVER_JAR = "server.jar"
READ_QUEUE_POLL_MS = 200
STOP_WAIT_SECONDS = 12
LOG_DIR = "logs"  # 总日志目录
LOG_APP_DIR = os.path.join(LOG_DIR, "app")       # 程序日志目录
LOG_SERVER_DIR = os.path.join(LOG_DIR, "server") # 服务器日志目录
BACKUP_DIR = "backups"
SERVERS_ROOT_DIR = "servers" 
DEFAULT_XMS = "1G" 
DEFAULT_XMX = "2G" 
START_BUTTON_BLOCK_MS = 15000

# 奶白色按钮配色 (UI Theme)
MILKY_FG = "#F5F5DC"
MILKY_HOVER = "#F0EBD8"
MILKY_TEXT = "#111111"

# ------------------ 工具函数 ------------------
def ensure_dirs():
    if not os.path.isdir(LOG_APP_DIR):
        os.makedirs(LOG_APP_DIR, exist_ok=True)
    if not os.path.isdir(LOG_SERVER_DIR):
        os.makedirs(LOG_SERVER_DIR, exist_ok=True)
        
    if not os.path.isdir(BACKUP_DIR):
        os.makedirs(BACKUP_DIR, exist_ok=True)
    if not os.path.isdir(SERVERS_ROOT_DIR): 
        os.makedirs(SERVERS_ROOT_DIR, exist_ok=True)

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
        versions.reverse() 
        return versions
    except Exception as e:
        return []

def get_adoptium_download_url(version):
    base = f"https://api.adoptium.net/v3/assets/latest/{version}/hotspot"
    params = {"architecture": "x64", "heap_size": "normal", "image_type": "jdk", "jvm_impl": "hotspot", "os": "windows", "vendor": "eclipse"}
    try:
        response = requests.get(base, params=params, timeout=10)
        data = response.json()
        if data:
            return data[0]["binary"]["package"]["link"]
        return None
    except Exception:
        return None

# ------------------ 主应用类 ------------------
class PageManager(ctk.CTk):
    def __init__(self):
        super().__init__()
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        self.title("Minecraft Server Manager V3 (Final)")
        self.geometry("1300x850") 
        
        # [修改 1] 调小最小尺寸，适应笔记本小屏幕
        self.minsize(1024, 600)

        # 核心状态
        self.server_process = None
        self.server_running = False
        self.stdout_queue = queue.Queue() 
        self.reader_thread = None
        self.reader_thread_stop_event = threading.Event()
        
        # 新增：在线玩家集合
        self.online_players = set()
        
        # --- 日志文件句柄分离 ---
        self.server_log_file_handle = None 
        self.app_log_file_handle = None    
        
        ensure_dirs()
        try:
            # App 日志保存到 logs/app/ 目录
            app_log_path = os.path.join(LOG_APP_DIR, f"app-{_timestamp_str()}.log")
            self.app_log_file_handle = open(app_log_path, 'a', encoding='utf-8')
        except: pass
        
        # 备份相关
        self.periodic_backup_thread = None
        self.periodic_backup_stop_event = threading.Event()
        self.startup_backup_done_event = threading.Event()
        self.periodic_backup_var = ctk.BooleanVar(value=False)
        self.startup_backup_var = ctk.BooleanVar(value=True)
        self.backup_map = {} 

        # 路径与配置
        self.current_server_path = None
        self.start_in_progress = False
        self.scanned_server_map = {} 
        
        # --- 内存设置选项 ---
        self.MEMORY_OPTIONS_RATIO = [
            (1, 2), (2, 4), (3, 6), (4, 8), 
            (6, 12), (8, 16), (12, 24), (16, 32)
        ]
        self.MEMORY_OPTIONS_DISPLAY = [
            f"Xms{s}G, Xmx{x}G" for s, x in self.MEMORY_OPTIONS_RATIO
        ]
        
        # --- 主页配置变量 ---
        self.online_mode_var = ctk.BooleanVar(value=True) 
        self.pvp_var = ctk.BooleanVar(value=True)
        self.max_players_var = ctk.StringVar(value="20")
        self.available_servers_var = ctk.StringVar(value="未检测到服务器") 
        self.selected_server_path = ctk.StringVar(value="") 
        
        self.memory_var = ctk.StringVar(value=self.MEMORY_OPTIONS_DISPLAY[1]) 
        self.pending_memory_var = ctk.StringVar(value=self.MEMORY_OPTIONS_DISPLAY[1]) 
        
        # --- 安装页变量 ---
        self.install_version_var = ctk.StringVar(value="请选择版本")
        self.install_name_var = ctk.StringVar(value="MyNewServer") 
        self.install_eula_var = ctk.BooleanVar(value=True) 
        self.install_online_mode_var = ctk.BooleanVar(value=True) 
        self.install_java_dl_var = ctk.BooleanVar(value=True) 
        self.install_auto_start_var = ctk.BooleanVar(value=True) 
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
        
        # 启动时执行服务器扫描
        self.after(100, self._initial_scan_servers)

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
        self.right_area = ctk.CTkFrame(container, corner_radius=6, fg_color="transparent")
        self.right_area.pack(side="right", fill="both", expand=True)

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
        
        menus = [
            ("启动页面", 'main'),
            ("安装部署", 'install'), 
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

    # ---------------- UI 布局 (1:2 比例) ----------------
    def _build_right_area(self):
        self.right_area.grid_rowconfigure(0, weight=1) # 上半部分
        self.right_area.grid_rowconfigure(1, weight=2) # 下半部分 (Server Log)
        self.right_area.grid_columnconfigure(0, weight=1)

        # === 上半部分 (Top Split Area) ===
        self.top_split_frame = ctk.CTkFrame(self.right_area, corner_radius=6, fg_color="transparent")
        self.top_split_frame.grid(row=0, column=0, sticky="nsew", padx=0, pady=(0, 6))
        
        # 上半部分左右分割 (Player:AppLog = 1:2)
        self.top_split_frame.grid_columnconfigure(0, weight=1) # Player List
        self.top_split_frame.grid_columnconfigure(1, weight=2) # App Log
        self.top_split_frame.grid_rowconfigure(0, weight=1)

        # 1. 左上: 玩家列表 (Player List)
        self.player_list_frame = ctk.CTkFrame(self.top_split_frame, corner_radius=6, border_width=2, border_color="#555555")
        self.player_list_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 3), pady=0)
        
        ctk.CTkLabel(self.player_list_frame, text="在线玩家列表", font=("", 12, "bold")).pack(pady=5)
        self.player_list_box = ctk.CTkTextbox(self.player_list_frame) 
        self.player_list_box.pack(fill="both", expand=True, padx=5, pady=5)
        self.player_list_box.insert("0.0", "等待服务器启动...")
        self.player_list_box.configure(state="disabled")

        # 2. 右上: 程序日志 (App Log)
        self.app_log_frame = ctk.CTkFrame(self.top_split_frame, corner_radius=6, border_width=2, border_color="#3A86FF")
        self.app_log_frame.grid(row=0, column=1, sticky="nsew", padx=(3, 0), pady=0)
        
        ctk.CTkLabel(self.app_log_frame, text="程序运行日志 (App Log)", font=("", 12, "bold")).pack(pady=5)
        self.app_log_text = ctk.CTkTextbox(self.app_log_frame, wrap="word")
        self.app_log_text.pack(fill="both", expand=True, padx=5, pady=5)
        self.app_log_text.insert('0.0', '💡 欢迎使用 Minecraft Server Manager V3\n')
        self.app_log_text.configure(state='disabled')

        # === 下半部分 (Bottom Area) ===
        # 3. 下方: Server Log + Command
        self.server_console_frame = ctk.CTkFrame(self.right_area, corner_radius=6, border_width=2, border_color="#2ECC71")
        self.server_console_frame.grid(row=1, column=0, sticky="nsew", padx=0, pady=0)
        self.server_console_frame.grid_rowconfigure(1, weight=1) 
        self.server_console_frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self.server_console_frame, text="服务器控制台输出 (Server Console)", font=("", 12, "bold")).grid(row=0, column=0, sticky="w", padx=10, pady=5)

        self.server_log_text = ctk.CTkTextbox(self.server_console_frame, wrap="word", font=("Consolas", 12))
        self.server_log_text.grid(row=1, column=0, sticky="nsew", padx=5, pady=0)
        self.server_log_text.configure(state='disabled')

        # 指令输入区
        self.command_container = ctk.CTkFrame(self.server_console_frame, fg_color="transparent")
        self.command_container.grid(row=2, column=0, sticky="ew", padx=5, pady=5)
        self.command_container.grid_columnconfigure(0, weight=1)
        
        self.input_entry = ctk.CTkEntry(self.command_container, placeholder_text="在此输入指令 (按回车发送)...")
        self.input_entry.grid(row=0, column=0, sticky="ew", padx=(0,6), pady=0)
        self.input_entry.bind('<Return>', self.send_command)
        
        send_btn = ctk.CTkButton(self.command_container, text="发送", command=self.send_command,
                                 fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, width=70)
        send_btn.grid(row=0, column=1, padx=0, pady=0)

    # ---------------- 页面管理 ----------------
    def create_pages(self):
        self.page_container = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        self.page_container.pack(fill="both", expand=True)
        self.pages = {}
        
        self._create_main_page()
        self._create_install_page() 
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
            
            if name == 'main':
                self.app_log_insert("🔄 切换到启动页面，正在重新扫描服务器文件夹...")
                self._initial_scan_servers()


    # ---------------- 页面 1: 启动页面 (Main) ----------------
    def _create_main_page(self):
        # [修改 2] 使用 CTkScrollableFrame 并应用奶白色滚动条
        page = ctk.CTkScrollableFrame(
            self.page_container, 
            corner_radius=6, 
            fg_color="transparent",
            scrollbar_button_color=MILKY_FG, 
            scrollbar_button_hover_color=MILKY_HOVER
        )
        self.pages['main'] = page
        
        selection_frame = ctk.CTkFrame(page)
        selection_frame.pack(fill="x", padx=20, pady=(0, 12))
        selection_frame.grid_columnconfigure(0, weight=1)
        
        ctk.CTkLabel(selection_frame, text="选择启动的服务器:", anchor="w").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        
        self.server_combo = ctk.CTkComboBox(selection_frame, 
                                            values=["未检测到服务器"], 
                                            variable=self.available_servers_var, 
                                            command=self._on_server_select)
        self.server_combo.grid(row=1, column=0, padx=5, pady=5, sticky="ew")

        self.folder_label = ctk.CTkLabel(page, text="当前文件夹: 未选择", anchor="w")
        self.folder_label.pack(fill="x", padx=20, pady=(8,2))
        self.jar_label = ctk.CTkLabel(page, text="使用Jar: 未选择", anchor="w")
        self.jar_label.pack(fill="x", padx=20, pady=(0,8))

        self.jar_entry = ctk.CTkEntry(page, placeholder_text="server.jar 路径")
        self.jar_entry.pack(fill="x", padx=20, pady=(0,12))

        # 内存设置
        mem_card = ctk.CTkFrame(page)
        mem_card.pack(fill="x", padx=20, pady=(0,12))
        mem_card.grid_columnconfigure(0, weight=1)
        
        ctk.CTkLabel(mem_card, text="选择启动内存:", anchor="w", font=("", 12, "bold")).grid(row=0, column=0, padx=8, pady=(8,4), sticky="w")
        
        combo_frame = ctk.CTkFrame(mem_card, fg_color="transparent")
        combo_frame.grid(row=1, column=0, padx=8, pady=4, sticky="ew")
        combo_frame.grid_columnconfigure(0, weight=1)

        self.memory_combo = ctk.CTkComboBox(combo_frame, 
                                            values=self.MEMORY_OPTIONS_DISPLAY, 
                                            variable=self.pending_memory_var, 
                                            width=250)
        self.memory_combo.grid(row=0, column=0, sticky="w")
        
        confirm_btn = ctk.CTkButton(combo_frame, text="确认", command=self.apply_memory_settings_gui,
                                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, width=80)
        confirm_btn.grid(row=0, column=1, padx=(6,0), sticky="w")


        explanation_text = "💡 Xms: 初始/最小内存 (Min Memory)。Xmx: 最大内存 (Max Memory)。"
        ctk.CTkLabel(mem_card, text=explanation_text, text_color=MILKY_FG, font=("", 10)).grid(row=2, column=0, padx=8, pady=(4,8), sticky="w")
        
        # 简易配置
        config_card = ctk.CTkFrame(page)
        config_card.pack(fill="x", padx=20, pady=(0,12))
        config_card.grid_columnconfigure(0, weight=1)
        config_card.grid_columnconfigure(1, weight=1)
        config_card.grid_columnconfigure(2, weight=1)
        
        ctk.CTkLabel(config_card, text="服务器配置 (自动读取)", font=("", 12, "bold")).grid(row=0, column=0, columnspan=3, pady=(5,5))
        
        self.online_switch = ctk.CTkSwitch(config_card, text="正版验证", variable=self.online_mode_var)
        self.online_switch.grid(row=1, column=0, padx=5, pady=5)
        
        self.pvp_switch = ctk.CTkSwitch(config_card, text="PVP伤害", variable=self.pvp_var)
        self.pvp_switch.grid(row=1, column=1, padx=5, pady=5)
        
        players_f = ctk.CTkFrame(config_card, fg_color="transparent")
        players_f.grid(row=1, column=2, padx=5, pady=5)
        ctk.CTkLabel(players_f, text="人数:").pack(side="left")
        self.max_players_entry = ctk.CTkEntry(players_f, textvariable=self.max_players_var, width=50)
        self.max_players_entry.pack(side="left", padx=5)

        self.save_prop_btn = ctk.CTkButton(config_card, text="保存配置到文件", command=self.save_server_properties_gui,
                                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, height=28)
        self.save_prop_btn.grid(row=2, column=0, columnspan=3, pady=(5,8))

        # 控制区
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

        # 备份简略 (自动保存修改)
        brief_frame = ctk.CTkFrame(page)
        brief_frame.pack(fill="x", padx=20, pady=(0,8))
        self.startup_backup_cb = ctk.CTkCheckBox(brief_frame, text="启动前自动备份", variable=self.startup_backup_var,
                                                 command=self._save_manager_config) 
        self.startup_backup_cb.pack(side="left", padx=10, pady=8)
        
        self.periodic_backup_cb = ctk.CTkCheckBox(brief_frame, text="运行中周期备份", variable=self.periodic_backup_var,
                                                  command=self._save_manager_config) 
        self.periodic_backup_cb.pack(side="left", padx=10, pady=8)

    # ---------------- 页面 2: 安装部署 (Install) ----------------
    def _create_install_page(self):
        # [修改 3] 使用 CTkScrollableFrame 并应用奶白色滚动条
        page = ctk.CTkScrollableFrame(
            self.page_container, 
            corner_radius=6, 
            fg_color="transparent",
            scrollbar_button_color=MILKY_FG, 
            scrollbar_button_hover_color=MILKY_HOVER
        )
        self.pages['install'] = page
        
        ctk.CTkLabel(page, text="快速架設 Paper 伺服器", font=("", 18, "bold")).pack(pady=15)
        
        form_frame = ctk.CTkFrame(page)
        form_frame.pack(fill="x", padx=20, pady=10)
        
        # 游戏版本
        row = 0
        ctk.CTkLabel(form_frame, text="游戏版本 (Paper):").grid(row=row, column=0, sticky="w", padx=15, pady=10)
        self.version_combo = ctk.CTkComboBox(form_frame, values=["加载中..."], variable=self.install_version_var, width=250)
        self.version_combo.grid(row=row, column=1, sticky="w", padx=10, pady=10)
        threading.Thread(target=self._fetch_paper_versions, daemon=True).start()
        
        # 伺服器名称
        row += 1
        ctk.CTkLabel(form_frame, text="伺服器名称:").grid(row=row, column=0, sticky="w", padx=15, pady=10)
        name_frame = ctk.CTkFrame(form_frame, fg_color="transparent")
        name_frame.grid(row=row, column=1, sticky="ew", padx=10, pady=10)
        
        self.install_name_entry = ctk.CTkEntry(name_frame, textvariable=self.install_name_var, width=200)
        self.install_name_entry.pack(side="left", fill="x", expand=True)
        
        ctk.CTkButton(name_frame, text="打开伺服器总目录", command=self._open_install_folder,
                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT).pack(side="left", padx=5) 
        
        # 正版验证 
        row += 1
        ctk.CTkLabel(form_frame, text="正版验证:").grid(row=row, column=0, sticky="w", padx=15, pady=10)
        self.install_online_switch = ctk.CTkSwitch(form_frame, text="启用正版验证 (online-mode)", variable=self.install_online_mode_var)
        self.install_online_switch.grid(row=row, column=1, sticky="w", padx=10, pady=10)

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

        # 部署后自动启动 
        row += 1
        ctk.CTkCheckBox(form_frame, text="部署完成后自动启动服务器", variable=self.install_auto_start_var).grid(row=row, column=1, sticky="w", padx=10, pady=10)


        # 部署按钮
        self.deploy_btn = ctk.CTkButton(page, text="开始部署 / 安装", height=40, font=("", 15, "bold"),
                                        fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT,
                                        command=self._start_deployment)
        self.deploy_btn.pack(pady=20, fill="x", padx=40)

    # ---------------- 页面 3: 备份设置 (Backup) ----------------
    def _create_backup_page(self):
        # [修改 4] 使用 CTkScrollableFrame 并应用奶白色滚动条，解决小屏幕显示不全问题
        page = ctk.CTkScrollableFrame(
            self.page_container, 
            corner_radius=6, 
            fg_color="transparent",
            scrollbar_button_color=MILKY_FG, 
            scrollbar_button_hover_color=MILKY_HOVER
        )
        self.pages['backup'] = page
        
        ctk.CTkLabel(page, text="备份设置", font=("", 18, "bold")).pack(pady=10)
        
        # 1. 显示当前选择的服务器名字
        self.backup_server_name_label = ctk.CTkLabel(page, 
                                                     textvariable=self.available_servers_var, 
                                                     font=("", 15, "bold"),
                                                     text_color="#F0EBD8")
        self.backup_server_name_label.pack(pady=(0, 10))

        # 2. 备份目录显示与删除
        dir_frame = ctk.CTkFrame(page)
        dir_frame.pack(fill="x", padx=20, pady=(0,12))
        dir_frame.grid_columnconfigure(0, weight=1)
        
        ctk.CTkLabel(dir_frame, text="备份目录:", font=("",12,"bold")).grid(row=0, column=0, padx=12, pady=(8,0), sticky="w")
        
        dir_controls_frame = ctk.CTkFrame(dir_frame, fg_color="transparent")
        dir_controls_frame.grid(row=1, column=0, padx=12, pady=(0,8), sticky="ew")
        dir_controls_frame.grid_columnconfigure(0, weight=1)
        
        self.backup_dir_var = ctk.StringVar(value=os.path.abspath(BACKUP_DIR))
        ctk.CTkLabel(dir_controls_frame, textvariable=self.backup_dir_var, anchor="w").grid(row=0, column=0, sticky="ew")
        
        ctk.CTkButton(dir_controls_frame, text="删除当前服务器备份", command=self._delete_backup_folder,
                      fg_color="red", hover_color="#B03A2E", text_color="white", width=140).grid(row=0, column=1, padx=(6,0))


        # 3. 周期备份设置
        auto_frame = ctk.CTkFrame(page)
        auto_frame.pack(fill="x", padx=20, pady=(0,12))
        auto_frame.grid_columnconfigure(0, weight=1)
        auto_frame.grid_columnconfigure(1, weight=1)
        
        ctk.CTkLabel(auto_frame, text="周期/保留设置", font=("",12,"bold")).grid(row=0, column=0, columnspan=2, padx=12, pady=(12,8), sticky="w")

        self.auto_backup_switch = ctk.CTkSwitch(auto_frame, text="启用运行中周期备份", variable=self.periodic_backup_var)
        self.auto_backup_switch.grid(row=1, column=0, columnspan=2, padx=12, pady=(0,8), sticky="w")
        
        # 周期
        ctk.CTkLabel(auto_frame, text="周期(分钟):").grid(row=2, column=0, padx=12, sticky="w")
        self.periodic_interval_entry = ctk.CTkEntry(auto_frame, placeholder_text="10", width=100)
        self.periodic_interval_entry.grid(row=3, column=0, padx=12, pady=(0,8), sticky="w")
        
        # 保留数量
        ctk.CTkLabel(auto_frame, text="保留数量:").grid(row=2, column=1, padx=12, sticky="w")
        self.backup_keep_entry = ctk.CTkEntry(auto_frame, placeholder_text="10", width=100)
        self.backup_keep_entry.grid(row=3, column=1, padx=12, pady=(0,8), sticky="w")
        
        btn = ctk.CTkButton(auto_frame, text="应用设置", command=self.apply_periodic_backup_settings,
                            fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, width=120)
        btn.grid(row=4, column=1, pady=(0,12), padx=12, sticky="e")
        
        ctk.CTkButton(auto_frame, text="立即备份世界", command=self._manual_backup,
                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, width=120).grid(row=4, column=0, pady=(0,12), padx=12, sticky="w")


        # 4. 还原备份功能
        restore_frame = ctk.CTkFrame(page)
        restore_frame.pack(fill="x", padx=20, pady=(0,12))
        restore_frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(restore_frame, text="还原备份世界 (要求服务器停止)", font=("",12,"bold")).grid(row=0, column=0, padx=12, pady=(12,8), sticky="w")

        self.restore_backup_var = ctk.StringVar(value="请选择一个备份")
        self.restore_combo = ctk.CTkComboBox(restore_frame, 
                                             values=["请选择一个备份"],
                                             variable=self.restore_backup_var,
                                             width=300)
        self.restore_combo.grid(row=1, column=0, padx=12, pady=4, sticky="ew")

        # 还原按钮配色修改为奶白色
        self.restore_btn = ctk.CTkButton(restore_frame, text="还原选中备份", command=self._restore_backup_world,
                                        fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT, width=120)
        self.restore_btn.grid(row=2, column=0, padx=12, pady=(8,4), sticky="w")
        
        restore_hint_frame = ctk.CTkFrame(restore_frame, fg_color="transparent")
        restore_hint_frame.grid(row=3, column=0, padx=12, pady=(0,8), sticky="ew")
        
        restore_hint = "提示: 还原备份要求服务器停止。\n备份类型中文: startup(启动前), manual(手动), periodic(周期)."
        ctk.CTkLabel(restore_hint_frame, text=restore_hint, text_color=MILKY_FG, font=("", 10)).pack(anchor="w")


        # 5. 底部按钮
        btn_frame = ctk.CTkFrame(page, fg_color="transparent")
        btn_frame.pack(fill="x", padx=20)
        ctk.CTkButton(btn_frame, text="打开备份文件夹", command=self._open_backup_folder,
                      fg_color=MILKY_FG, hover_color=MILKY_HOVER, text_color=MILKY_TEXT).pack(fill="x", pady=6)
        
        page.bind("<Visibility>", lambda e: self._refresh_backup_list() if self.current_page == 'backup' else None)


    def _create_extra_page(self):
        page = ctk.CTkFrame(self.page_container, corner_radius=6, fg_color="transparent")
        self.pages['extra'] = page
        ctk.CTkLabel(page, text="扩展功能 (占位)", font=("", 18, "bold")).pack(pady=20)

    # ---------------- 逻辑: 安装部署 (Install Logic) ----------------
    def _fetch_paper_versions(self):
        self.app_log_insert("🌐 正在获取 Paper 版本列表...")
        vers = get_paper_versions()
        
        def update_ui_after_fetch(versions):
            if versions:
                self.paper_versions = versions
                self.version_combo.configure(values=versions)
                self.install_version_var.set(versions[0])
                self.app_log_insert(f"✅ 获取到 {len(versions)} 个版本。")
            else:
                self.app_log_insert("⚠️ 版本列表获取失败。")
                self.version_combo.configure(values=["获取失败"])
                self.install_version_var.set("获取失败")

        self.after(0, update_ui_after_fetch, vers)


    def _open_install_folder(self):
        folder = os.path.abspath(SERVERS_ROOT_DIR) 
        try:
            if os.name == 'nt': os.startfile(folder)
            else: subprocess.Popen(['xdg-open', folder])
            self.app_log_insert(f"📂 已打开伺服器总目录: {folder}")
        except Exception as e:
            messagebox.showerror("错误", f"无法打开文件夹: {e}")

    def _start_deployment(self):
        server_name = self.install_name_var.get().strip()
        version = self.install_version_var.get()
        
        if not server_name:
            messagebox.showwarning("提示", "请输入伺服器名称")
            return
            
        folder = os.path.join(SERVERS_ROOT_DIR, server_name)

        if version in ["请选择版本", "加载中...", "获取失败"]:
            messagebox.showwarning("提示", "请选择有效的游戏版本")
            return
        
        if not self.install_eula_var.get():
            messagebox.showwarning("提示", "必须同意 EULA 协议才能继续")
            return
        
        if os.path.exists(folder) and os.listdir(folder):
            if not messagebox.askyesno("警告", f"目标文件夹 '{server_name}' 不为空 ({folder})。继续部署可能会覆盖文件。是否继续?"):
                return

        self.deploy_btn.configure(state="disabled", text="正在部署...")
        threading.Thread(target=self._deploy_worker, args=(folder, version), daemon=True).start()

    def _deploy_worker(self, folder, version):
        self.app_log_insert(f"🚀 开始在 {folder} 部署 Paper {version}...")
        
        try:
            if not os.path.exists(SERVERS_ROOT_DIR):
                os.makedirs(SERVERS_ROOT_DIR)
            if not os.path.exists(folder):
                os.makedirs(folder)
            
            java_path = None
            
            # A. 下载 Java
            if self.install_java_dl_var.get():
                req_ver = get_required_java_version(version)
                self.app_log_insert(f"⬇️ 正在查找 Java {req_ver} 下载链接...")
                url = get_adoptium_download_url(req_ver)
                if url:
                    self.app_log_insert(f"⬇️ 开始下载 Java: {url}")
                    zip_path = os.path.join(folder, "java_temp.zip")
                    try:
                        with requests.get(url, stream=True) as r:
                            r.raise_for_status()
                            dl = 0
                            with open(zip_path, 'wb') as f:
                                for chunk in r.iter_content(chunk_size=8192):
                                    f.write(chunk)
                                    dl += len(chunk)
                                    if dl % (5 * 1024 * 1024) < 8192: 
                                        self.app_log_insert(f"   已下载: {dl/1024/1024:.1f} MB ...")
                        self.app_log_insert("📦 解压 Java 中...")
                        extract_dir = os.path.join(folder, f"java{req_ver}")
                        os.makedirs(extract_dir, exist_ok=True)
                        with zipfile.ZipFile(zip_path, 'r') as z:
                            z.extractall(extract_dir)
                        os.remove(zip_path)
                        
                        java_root_dir = os.path.join(folder, f"java{req_ver}")
                        java_path = None
                        for root, dirs, files in os.walk(java_root_dir):
                            if "java.exe" in files:
                                java_path = os.path.join(root, "java.exe")
                                break
                        if java_path:
                            self.app_log_insert(f"✅ Java 安装成功: {java_path}")
                        else:
                            self.app_log_insert("⚠️ 解压后未找到 java.exe")
                    except Exception as e:
                        self.app_log_insert(f"❌ Java 下载/安装失败: {e}")
                else:
                    self.app_log_insert("❌ 无法获取 Java 下载地址。")

            # B. 下载 Server Jar
            self.app_log_insert(f"⬇️ 正在获取 Paper {version} 最新构建...")
            try:
                builds_url = f"https://api.papermc.io/v2/projects/paper/versions/{version}"
                resp = requests.get(builds_url)
                
                # [新增] 检查 API 是否返回了 404 (版本不存在)
                if resp.status_code == 404:
                    raise Exception(f"版本 {version} 在 PaperMC 中不存在！请检查是否输入了基岩版版本号？")
                
                resp.raise_for_status() # 检查其他网络错误
                bd = resp.json()
                
                if "builds" not in bd:
                    raise Exception(f"API 返回数据异常，未找到构建列表。返回内容: {bd}")

                latest = bd["builds"][-1]
                jar_url = f"https://api.papermc.io/v2/projects/paper/versions/{version}/builds/{latest}/downloads/paper-{version}-{latest}.jar"
                
                jar_dest = os.path.join(folder, "server.jar")
                self.app_log_insert(f"⬇️ 下载 Server JAR ({latest})...")
                with requests.get(jar_url, stream=True) as r:
                    r.raise_for_status()
                    with open(jar_dest, 'wb') as f:
                        for chunk in r.iter_content(8192):
                            f.write(chunk)
                self.app_log_insert("✅ Server JAR 下载完成。")
            except Exception as e:
                self.app_log_insert(f"❌ Server JAR 下载失败: {e}")
                raise e # 抛出异常以停止后续流程

            # C. 写入文件
            self.app_log_insert("📝 生成配置文件...")
            with open(os.path.join(folder, "eula.txt"), "w") as f:
                f.write("eula=true\n")
            
            props_path = os.path.join(folder, "server.properties")
            om = "true" if self.install_online_mode_var.get() else "false"
            with open(props_path, "w") as f:
                f.write(f"online-mode={om}\n")
                f.write("max-players=20\n")
                f.write("pvp=true\n")
                f.write("server-port=25565\n")
                f.write("motd=A Minecraft Server\n")
            
            # 始终创建 start.bat，方便用户手动启动
            bat_path = os.path.join(folder, "start.bat")
            cmd_java = java_path if java_path else "java"
            with open(bat_path, "w") as f:
                f.write("@echo off\n")
                f.write(f'"{cmd_java}" -Xms2G -Xmx2G -jar server.jar nogui\n')
                f.write("pause\n")

            self.app_log_insert("🎉 部署完成！")
            
            self.after(0, self._deployment_success_callback, folder)


        except Exception as e:
            self.after(0, self._deployment_failure_callback, str(e))
        finally:
            self.after(0, lambda: self.deploy_btn.configure(state="normal", text="开始部署 / 安装"))

    def _deployment_success_callback(self, folder):
        messagebox.showinfo("成功", "部署完成！")
        
        # 自动启动 (修改为使用集成控制台启动)
        if self.install_auto_start_var.get():
            self.app_log_insert("🚀 准备在集成控制台自动启动服务器...")
            
            # 1. 刷新服务器列表并切换到主页
            self.show_page('main')
            
            # 2. 自动选择该服务器
            server_name = os.path.basename(folder)
            if server_name in self.scanned_server_map:
                 self.available_servers_var.set(server_name)
                 self._on_server_select(server_name)
                 
            # 3. 调用集成启动方法
            self.start_server()
            
            messagebox.showinfo("自动启动", "服务器已在集成控制台启动。")
    
    def _deployment_failure_callback(self, error_message):
        self.app_log_insert(f"❌ 部署过程中止: {error_message}")
        messagebox.showerror("失败", error_message)


    # ---------------- 逻辑: 主页文件选择与配置读取 ----------------
    def _scan_server_folders(self):
        found_servers = []
        base_dir = SERVERS_ROOT_DIR 
        
        if not os.path.isdir(base_dir):
            return []

        for item in os.listdir(base_dir):
            full_path = os.path.join(base_dir, item)
            if item.startswith('.'): continue
            
            if os.path.isdir(full_path):
                for f in os.listdir(full_path):
                    if f.lower().endswith('.jar'):
                        found_servers.append((item, full_path)) 
                        break
        return found_servers

    def _initial_scan_servers(self):
        servers = self._scan_server_folders()
        
        if servers:
            self.scanned_server_map = {name: path for name, path in servers}
            server_names = list(self.scanned_server_map.keys())
            
            current_selection = self.available_servers_var.get()
            
            self.server_combo.configure(values=server_names)
            
            if current_selection in server_names:
                self.available_servers_var.set(current_selection)
                self._on_server_select(current_selection) 
            else:
                self.available_servers_var.set(server_names[0])
                self._on_server_select(server_names[0]) 
                
        else:
            self.scanned_server_map = {}
            self.server_combo.configure(values=["未检测到服务器"])
            self.available_servers_var.set("未检测到服务器")
            if not self.server_running: 
                pass 
    
    # [新增] 加载管理器配置
    def _load_manager_config(self, folder):
        config_path = os.path.join(folder, "manager_config.json")
        defaults = {
            "memory": self.MEMORY_OPTIONS_DISPLAY[1], # Default 2G/4G
            "startup_backup": True,
            "periodic_backup_enabled": False,
            "periodic_interval": "10",
            "periodic_keep": "10"
        }
        
        data = defaults.copy()
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    saved = json.load(f)
                    data.update(saved)
            except: pass 

        # Apply to UI
        self.pending_memory_var.set(data["memory"])
        self.memory_var.set(data["memory"])
        
        self.startup_backup_var.set(data["startup_backup"])
        
        self.periodic_backup_var.set(data["periodic_backup_enabled"])
        
        try:
            self.periodic_interval_entry.delete(0, 'end')
            self.periodic_interval_entry.insert(0, str(data["periodic_interval"]))
        except: pass

        try:
            self.backup_keep_entry.delete(0, 'end')
            self.backup_keep_entry.insert(0, str(data["periodic_keep"]))
        except: pass
        
        self.app_log_insert(f"🔧 已加载管理器配置: {os.path.basename(folder)}")

    # [新增] 保存管理器配置
    def _save_manager_config(self):
        if not self.current_server_path: return
        
        config_path = os.path.join(self.current_server_path, "manager_config.json")
        
        data = {
            "memory": self.memory_var.get(),
            "startup_backup": self.startup_backup_var.get(),
            "periodic_backup_enabled": self.periodic_backup_var.get(),
            "periodic_interval": self.periodic_interval_entry.get(),
            "periodic_keep": self.backup_keep_entry.get()
        }
        
        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
            self.app_log_insert("💾 管理器配置已保存 (内存/备份设置)")
        except Exception as e:
            self.app_log_insert(f"❌ 保存管理器配置失败: {e}")

    def _on_server_select(self, server_name):
        if server_name in self.scanned_server_map:
            folder = self.scanned_server_map[server_name]
            self.current_server_path = folder
            self.folder_label.configure(text=f"当前文件夹: {folder}")
            self.app_log_insert(f"📁 已选择服务器: {server_name}")
            
            jar_path = self.find_server_jar(folder)
            if jar_path:
                self.jar_label.configure(text=f"使用Jar: {os.path.basename(jar_path)}")
                self.jar_entry.delete(0, 'end')
                self.jar_entry.insert(0, jar_path)
            else:
                self.jar_label.configure(text=f"使用Jar: 未找到可用的 Jar 文件")
                self.jar_entry.delete(0, 'end')

            self.load_server_properties_gui(folder)
            self._load_manager_config(folder) # [修改] 调用加载
            
            self.after(0, self._refresh_backup_list) 
        else:
            self.current_server_path = None
            self.folder_label.configure(text=f"当前文件夹: 未选择")
            self.jar_label.configure(text=f"使用Jar: 未选择")
            self.jar_entry.delete(0, 'end')
            self.app_log_insert(f"⚠️ 请选择一个有效的服务器文件夹。")
            self.after(0, self._refresh_backup_list)

    def find_server_jar(self, folder):
        if not folder: return None
        try:
            cands = [f for f in os.listdir(folder) if f.lower().endswith('.jar')]
        except: return None
        if not cands: return None
        
        for c in cands:
            if c.lower() == DEFAULT_SERVER_JAR: return os.path.join(folder, c)
        
        for c in cands:
            if 'server' in c.lower() or 'minecraft' in c.lower() or 'paper' in c.lower(): 
                return os.path.join(folder, c)
                
        return os.path.join(folder, cands[0])

    def load_server_properties_gui(self, folder):
        p_path = os.path.join(folder, "server.properties")
        if not os.path.exists(p_path):
            self.app_log_insert("⚠️ 未找到 server.properties，使用默认值。")
            self.online_mode_var.set(True)
            self.pvp_var.set(True)
            self.max_players_var.set("20")
            return
        
        try:
            props = {}
            with open(p_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    if '=' in line and not line.strip().startswith('#'):
                        k, v = line.strip().split('=', 1)
                        props[k.strip()] = v.strip()
            
            if 'online-mode' in props:
                self.online_mode_var.set(props['online-mode'].lower() == 'true')
            if 'pvp' in props:
                self.pvp_var.set(props['pvp'].lower() == 'true')
            if 'max-players' in props:
                self.max_players_var.set(props['max-players'])
            
            self.app_log_insert("✅ 已读取 server.properties 配置。")
        except Exception as e:
            self.app_log_insert(f"❌ 读取配置失败: {e}")

    def save_server_properties_gui(self):
        if not self.current_server_path:
            messagebox.showwarning("提示", "未选择服务器文件夹")
            return
        
        p_path = os.path.join(self.current_server_path, "server.properties")
        
        lines = []
        if os.path.exists(p_path):
            with open(p_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
        else:
            lines = [] 

        new_props = {
            'online-mode': 'true' if self.online_mode_var.get() else 'false',
            'pvp': 'true' if self.pvp_var.get() else 'false',
            'max-players': self.max_players_var.get()
        }

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
        
        for k, v in new_props.items():
            if k not in updated_keys:
                if final_lines and final_lines[-1].strip() and not final_lines[-1].strip().endswith('\n'):
                    final_lines.append('\n')
                final_lines.append(f"{k}={v}\n")

        try:
            with open(p_path, 'w', encoding='utf-8') as f:
                f.writelines(final_lines)
            self.app_log_insert("💾 server.properties 保存成功！")
            messagebox.showinfo("成功", "配置已保存。")
        except Exception as e:
            self.app_log_insert(f"❌ 保存失败: {e}")
            messagebox.showerror("错误", str(e))
            
    def apply_memory_settings_gui(self):
        selected_value = self.pending_memory_var.get()
        self.memory_var.set(selected_value)
        self._save_manager_config() # [修改] 确认内存时保存
        
        try:
            match = re.search(r"Xms(\d+[GM])", selected_value)
            xms = match.group(1) if match else "N/A"
            match = re.search(r"Xmx(\d+[GM])", selected_value)
            xmx = match.group(1) if match else "N/A"
            messagebox.showinfo("内存设置确认", f"内存设置已确认:\n最小内存 (Xms): {xms}\n最大内存 (Xmx): {xmx}\n服务器将在下次启动时使用此设置。")
        except:
             messagebox.showinfo("内存设置确认", f"内存设置已确认: {selected_value}。服务器将在下次启动时使用此设置。")
             
        self.app_log_insert(f"✅ 内存设置已更新为: {selected_value}")

    # ---------------- 逻辑: 启动 / 停止 / 线程 ----------------
    
    def update_player_list_ui(self):
        """刷新界面上的玩家列表"""
        self.player_list_box.configure(state="normal")
        self.player_list_box.delete("0.0", "end")
        
        if not self.online_players:
            self.player_list_box.insert("0.0", "当前无玩家在线")
        else:
            # 排序并逐行显示
            content = "\n".join(sorted(self.online_players))
            self.player_list_box.insert("0.0", content)
            
        self.player_list_box.configure(state="disabled")

    def _parse_log_line_for_players(self, line):
        """核心逻辑：分析日志行，提取玩家动态 (加强版)"""
        
        # 0. 预处理：去除 ANSI 颜色代码
        clean_line = re.sub(r'\x1b\[[0-9;]*m', '', line)
        
        # 1. 玩家加入
        join_match = re.search(r"\b(\w+)\s+joined the game", clean_line)
        if join_match:
            player_name = join_match.group(1)
            if player_name.lower() not in ['server', 'player']: 
                self.online_players.add(player_name)
                self.update_player_list_ui()
            return

        # 2. 玩家退出
        leave_match = re.search(r"\b(\w+)\s+left the game", clean_line)
        if leave_match:
            player_name = leave_match.group(1)
            if player_name in self.online_players:
                self.online_players.discard(player_name)
                self.update_player_list_ui()
            return

        # 3. 捕捉 /list 命令的回显
        if "players online:" in clean_line:
            list_match = re.search(r"players online:\s+(.*)", clean_line)
            if list_match:
                names_str = list_match.group(1).strip()
                if names_str:
                    current_names = {n.strip() for n in names_str.split(",") if n.strip()}
                    self.online_players = current_names
                else:
                    self.online_players = set()
                self.update_player_list_ui()

    def start_server(self):
        if self.start_in_progress or self.server_running:
            messagebox.showinfo("提示", "服务器正在运行或启动中")
            return

        jar_path_input = self.jar_entry.get().strip()
        if not jar_path_input:
            messagebox.showerror("错误", "未选择 JAR 文件")
            return
            
        jar_path = os.path.abspath(jar_path_input)
        
        if not os.path.isfile(jar_path):
             messagebox.showerror("错误", f"找不到文件: {jar_path}")
             return

        server_dir = os.path.dirname(jar_path)
        self.current_server_path = server_dir
        
        # [新增] 启动前保存当前配置，确保下次启动时一致
        self._save_manager_config()

        self.start_in_progress = True
        self.start_button.configure(state="disabled")
        
        selected_mem = self.memory_var.get()
        xms = DEFAULT_XMS
        xmx = DEFAULT_XMX
        
        try:
            xms_match = re.search(r"Xms(\d+[GM])", selected_mem)
            xmx_match = re.search(r"Xmx(\d+[GM])", selected_mem)
            if xms_match and xmx_match:
                xms = xms_match.group(1)
                xmx = xmx_match.group(1)
            else:
                self.app_log_insert(f"⚠️ 内存选择格式解析不完全 ({selected_mem})，使用默认值 {DEFAULT_XMS}/{DEFAULT_XMX}")
        except Exception as e:
            self.app_log_insert(f"⚠️ 内存解析错误: {e}，使用默认值 {DEFAULT_XMS}/{DEFAULT_XMX}")


        if self.startup_backup_var.get():
            self.startup_backup_done_event.clear()
            threading.Thread(target=self._startup_backup_thread, args=(jar_path,), daemon=True).start()

        ensure_dirs()
        # 修改：Server Log 保存到 logs/server/ 目录
        log_f = os.path.join(LOG_SERVER_DIR, f"console-{_timestamp_str()}.log")
        try:
            # Server Log 文件
            self.server_log_file_handle = open(log_f, 'a', encoding='utf-8')
        except: pass

        cmd = ['java', f'-Xmx{xmx}', f'-Xms{xms}', '-jar', jar_path, 'nogui']
        
        try:
            self.server_process = subprocess.Popen(cmd, cwd=server_dir, stdin=subprocess.PIPE, 
                                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, 
                                                   text=True, bufsize=1)
            self.app_log_insert(f"🚀 启动命令: {' '.join(cmd)}")
            self.app_log_insert(f"📂 工作目录: {server_dir}")
            
            self.reader_thread_stop_event.clear()
            self.reader_thread = threading.Thread(target=self.enqueue_stdout, args=(self.server_process.stdout,), daemon=True)
            self.reader_thread.start()
            
            threading.Thread(target=self._monitor_process, daemon=True).start()
            
            if self.periodic_backup_var.get():
                self.periodic_backup_stop_event.clear()
                self.periodic_backup_thread = threading.Thread(target=self._periodic_backup_loop, daemon=True)
                self.periodic_backup_thread.start()

        except Exception as e:
            self.app_log_insert(f"❌ 启动异常: {e}")
            self.start_in_progress = False
            self.start_button.configure(state="normal")
        
        self.after(0, self._update_restore_button_state) 

    def enqueue_stdout(self, pipe):
        for line in iter(pipe.readline, ''):
            if self.reader_thread_stop_event.is_set(): break
            self.stdout_queue.put(line.rstrip())
        pipe.close()

    def poll_stdout_queue(self):
        while not self.stdout_queue.empty():
            line = self.stdout_queue.get_nowait()
            if not self.server_running and re.search(r"\bDone\s*\(", line):
                self.server_running = True
                self.start_in_progress = False
                self.start_button.configure(state="normal")
                self.status_label.configure(text="服务器状态: 运行中 ✅", text_color="lightgreen")
                self.update_controls_state()
                
                # 服务器启动完成后，清空列表
                self.online_players.clear()
                self.update_player_list_ui()
            
            self._parse_log_line_for_players(line)

            # 写入下方的 Server Log 区域
            self.server_log_text.configure(state='normal')
            self.server_log_text.insert('end', line + '\n')
            self.server_log_text.see('end')
            self.server_log_text.configure(state='disabled')
            
            # 写入 Server Log 文件
            if self.server_log_file_handle: self.server_log_file_handle.write(line+'\n')
        
        self.after(READ_QUEUE_POLL_MS, self.poll_stdout_queue)

    def _monitor_process(self):
        self.server_process.wait()
        self.server_running = False
        self.start_in_progress = False
        self.after(0, lambda: self.stdout_queue.put("🔴 服务器进程已退出。"))
        self.reader_thread_stop_event.set()
        self.periodic_backup_stop_event.set()
        self.after(0, self.update_controls_state)
        self.after(0, self._update_restore_button_state)
        self.online_players.clear()
        self.after(0, self.update_player_list_ui)

    def stop_server(self):
        if self.server_process and self.server_process.poll() is None:
            self.safe_write_stdin("stop\n")
            self.app_log_insert("🛑 发送 stop 指令...")
        else:
            messagebox.showinfo("提示", "服务器未运行")

    def safe_write_stdin(self, data):
        try:
            if self.server_process and self.server_process.stdin:
                self.server_process.stdin.write(data)
                self.server_process.stdin.flush()
        except Exception as e:
            self.app_log_insert(f"❌ 写入失败: {e}")

    def send_command(self, event=None):
        cmd = self.input_entry.get().strip()
        if cmd:
            self.safe_write_stdin(cmd + "\n")
            # 命令回显到 Server Log
            self.stdout_queue.put(f"> {cmd}")
            self.input_entry.delete(0, 'end')

    def update_controls_state(self):
        running = self.server_running
        try:
            state = "disabled" if running else "normal"
            self.memory_combo.configure(state=state)
            
            self.start_button.configure(state=state)
            self.status_label.configure(text="服务器状态: 运行中 ✅" if running else "服务器状态: 已停止", 
                                        text_color="lightgreen" if running else "white")
        except: pass

    # ---------------- 备份逻辑 (核心修复) ----------------
    def _startup_backup_thread(self, jar_path):
        folder = os.path.dirname(jar_path)
        self._prune_startup_backups(folder) 
        self.after(0, lambda: self.app_log_insert(f"🔄 [启动备份] 正在备份 {folder}..."))
        self.backup_world(folder, "startup")
        self.startup_backup_done_event.set()

    def _periodic_backup_loop(self):
        try:
            iv = int(self.periodic_interval_entry.get())
        except: iv = 10
        
        self.after(0, lambda: self.app_log_insert(f"⏱️ 周期备份启动，间隔 {iv} 分钟"))
        
        while not self.periodic_backup_stop_event.is_set():
            for _ in range(iv * 60):
                if self.periodic_backup_stop_event.is_set(): return
                time.sleep(1)
            
            if self.server_running and self.current_server_path:
                self.app_log_insert("⏳ [周期备份] 正在准备世界保存...")
                self.safe_write_stdin("save-all\n")
                time.sleep(2)
                self.safe_write_stdin("save-off\n")
                time.sleep(1)
                self.backup_world(self.current_server_path, "periodic")
                self.safe_write_stdin("save-on\n")
                self.after(0, lambda folder=self.current_server_path: self.prune_backups(folder))
                
    def _prune_startup_backups(self, src_dir):
        if not src_dir: return
        s_name = os.path.basename(src_dir)
        dest_dir = os.path.join(self.backup_dir_var.get(), s_name)
        if not os.path.isdir(dest_dir): return

        startup_backups = []
        for item in os.listdir(dest_dir):
            if re.match(r"backup-(\d{8})-(\d{6})_startup", item):
                startup_backups.append(item)
        
        startup_backups.sort(reverse=True)
        
        for i in startup_backups[1:]:
            full_path = os.path.join(dest_dir, i)
            try:
                shutil.rmtree(full_path)
                self.after(0, lambda name=i: self.app_log_insert(f"🗑️ [启动前备份] 清理旧启动备份: {name}"))
            except Exception as e:
                 self.after(0, lambda name=i, err=e: self.app_log_insert(f"❌ [启动前备份] 清理失败 {name}: {err}"))

    # === 修复重点：多世界备份逻辑 (Fix Multi-World Backup) ===
    def backup_world(self, src_dir, note):
        if not src_dir: return
        try:
            s_name = os.path.basename(src_dir)
            dest_dir = os.path.join(self.backup_dir_var.get(), s_name)
            os.makedirs(dest_dir, exist_ok=True)
            
            name = f"backup-{_timestamp_str()}_{note}"
            final_dest = os.path.join(dest_dir, name)
            
            # 1. 获取世界名 (level-name)
            level_name = "world" # 默认值
            p_path = os.path.join(src_dir, "server.properties")
            if os.path.exists(p_path):
                try:
                    with open(p_path, 'r', encoding='utf-8', errors='ignore') as f:
                        for line in f:
                            if line.strip().startswith("level-name="):
                                val = line.strip().split("=", 1)[1].strip()
                                if val: level_name = val
                                break
                except: pass

            # 2. 定义候选目标
            candidates = set()
            candidates.add(level_name)
            candidates.add(f"{level_name}_nether")
            candidates.add(f"{level_name}_the_end")
            candidates.add("world_nether")
            candidates.add("world_the_end")

            backed_up_count = 0
            
            # 3. 遍历并备份存在的文件夹
            for target in candidates:
                target_path = os.path.join(src_dir, target)
                if os.path.exists(target_path) and os.path.isdir(target_path):
                    shutil.copytree(target_path, os.path.join(final_dest, target), 
                                    dirs_exist_ok=True, 
                                    ignore=shutil.ignore_patterns("session.lock"))
                    self.after(0, lambda t=target: self.app_log_insert(f"   - 已备份世界目录: {t}"))
                    backed_up_count += 1
            
            # 4. 如果没找到任何 Paper 样式的文件夹
            if backed_up_count == 0:
                target_path = os.path.join(src_dir, level_name)
                if os.path.exists(target_path) and os.path.isdir(target_path):
                    shutil.copytree(target_path, os.path.join(final_dest, level_name),
                                    dirs_exist_ok=True,
                                    ignore=shutil.ignore_patterns("session.lock"))
                    self.after(0, lambda: self.app_log_insert(f"✅ 备份完成: {name} (单世界/Vanilla结构)"))
                else:
                    self.after(0, lambda: self.app_log_insert("⚠️ 未检测到标准世界结构，执行全量文件备份..."))
                    shutil.copytree(src_dir, final_dest, 
                                    ignore=shutil.ignore_patterns("*.jar", "backups", "logs", "servers", "session.lock"), 
                                    dirs_exist_ok=True) 
                    self.after(0, lambda: self.app_log_insert(f"✅ 全量备份完成: {name}"))
            else:
                 self.after(0, lambda: self.app_log_insert(f"✅ 备份完成: {name} (共 {backed_up_count} 个世界文件夹)"))

            self.after(0, self._refresh_backup_list)

        except Exception as e:
            error_message = str(e)
            self.after(0, lambda msg=error_message: self.app_log_insert(f"❌ 备份失败: {msg}"))

    def prune_backups(self, src_dir):
        if not src_dir: return
        try:
            kp = int(self.backup_keep_entry.get())
        except: kp = 10
        
        s_name = os.path.basename(src_dir)
        folder = os.path.join(self.backup_dir_var.get(), s_name)
        if not os.path.isdir(folder): return

        items_to_prune = []
        for d in os.listdir(folder):
            if not os.path.isdir(os.path.join(folder, d)): continue
            if not re.match(r"backup-(\d{8})-(\d{6})_startup", d):
                items_to_prune.append(os.path.join(folder, d))
        
        items_to_prune.sort(key=os.path.getmtime, reverse=True)
        
        for i in items_to_prune[kp:]:
            try: 
                shutil.rmtree(i)
                self.after(0, lambda name=os.path.basename(i): self.app_log_insert(f"🗑️ [周期备份清理] 清理旧备份: {name}"))
            except Exception as e:
                 error_message = str(e)
                 self.after(0, lambda name=os.path.basename(i), msg=error_message: self.app_log_insert(f"❌ [周期备份清理] 清理失败 {name}: {msg}"))
        
        self.after(0, self._refresh_backup_list)


    def _manual_backup(self):
        if not self.current_server_path:
            messagebox.showwarning("提示", "未选择服务器，无法手动备份")
            return

        def manual_backup_worker():
            self.app_log_insert("⏳ [手动备份] 正在开始...")

            if self.server_running:
                self.app_log_insert("⏳ [手动备份] 正在准备世界保存(save-all/off)...")
                self.safe_write_stdin("save-all\n")
                time.sleep(2)
                self.safe_write_stdin("save-off\n")
                time.sleep(1)
            
            self.backup_world(self.current_server_path, "manual")

            if self.server_running:
                self.safe_write_stdin("save-on\n")
                self.app_log_insert("✅ [手动备份] 服务器自动保存已恢复(save-on)")

            self.prune_backups(self.current_server_path)

        threading.Thread(target=manual_backup_worker, daemon=True).start()
    
    def _open_backup_folder(self):
        p = self.backup_dir_var.get()
        if os.path.exists(p):
            if os.name == 'nt': os.startfile(p)
            else: subprocess.Popen(['xdg-open', p])

    def _delete_backup_folder(self):
        server_name = self.available_servers_var.get()
        if server_name == "未检测到服务器" or not server_name:
            messagebox.showinfo("提示", "请先选择一个服务器")
            return

        backup_root = self.backup_dir_var.get()
        server_backup_path = os.path.join(backup_root, server_name)
        
        if not os.path.exists(server_backup_path):
            messagebox.showinfo("提示", f"未找到服务器 '{server_name}' 的备份记录。")
            return
            
        if messagebox.askyesno("确认删除", f"您确定要删除服务器 '{server_name}' 的所有备份吗？"):
            if messagebox.askyesno("再次确认 (不可逆)", f"警告：此操作不可恢复！\n\n您真的确定要彻底删除 '{server_name}' 的所有备份文件吗？"):
                try:
                    shutil.rmtree(server_backup_path)
                    self.app_log_insert(f"🗑️ 已删除服务器备份: {server_name}")
                    messagebox.showinfo("成功", f"服务器 '{server_name}' 的备份已全部删除。")
                    self._refresh_backup_list()
                except Exception as e:
                    self.app_log_insert(f"❌ 删除备份失败: {e}")
                    messagebox.showerror("错误", f"删除失败: {e}")
                
    # ---------------- 还原逻辑 (同步修复) ----------------
    def _get_backup_list(self, server_name):
        if not server_name or server_name == "未检测到服务器":
            return []
            
        server_backup_path = os.path.join(self.backup_dir_var.get(), server_name)
        if not os.path.isdir(server_backup_path):
            return []
            
        backups = []
        for item in os.listdir(server_backup_path):
            full_path = os.path.join(server_backup_path, item)
            if os.path.isdir(full_path):
                match = re.match(r"backup-(\d{8})-(\d{6})_(\w+)", item)
                
                if match:
                    date_str = match.group(1)
                    time_str = match.group(2)
                    type_en = match.group(3)
                    
                    type_map = {'startup': '启动前备份', 'manual': '手动备份', 'periodic': '周期备份'}
                    type_cn = type_map.get(type_en, '未知类型')
                    
                    try:
                        dt_obj = datetime.datetime.strptime(date_str + time_str, "%Y%m%d%H%M%S")
                        time_display = dt_obj.strftime("%Y年%m月%d日 %H:%M:%S")
                    except:
                        time_display = "时间格式错误"

                    display_name = f"[{type_cn}] {time_display}"
                    backups.append((item, display_name, full_path))
                    
        backups.sort(key=lambda x: x[0], reverse=True)
        return backups

    def _refresh_backup_list(self):
        server_name = self.available_servers_var.get()
        if server_name == "未检测到服务器" or not self.current_server_path:
            self.restore_combo.configure(values=["未选择服务器"])
            self.restore_backup_var.set("未选择服务器")
            self.backup_map = {}
            self._update_restore_button_state()
            return
            
        backup_list = self._get_backup_list(server_name)
        
        if backup_list:
            display_names = [item[1] for item in backup_list]
            self.restore_combo.configure(values=display_names)
            self.backup_map = {item[1]: item[2] for item in backup_list}
            self.restore_backup_var.set(display_names[0])
        else:
            self.restore_combo.configure(values=["该服务器无备份"])
            self.restore_backup_var.set("该服务器无备份")
            self.backup_map = {}
            
        self._update_restore_button_state()

    def _update_restore_button_state(self):
        if self.server_running:
            self.restore_btn.configure(state="disabled", text="服务器运行中，无法还原")
        elif not self.backup_map:
            self.restore_btn.configure(state="disabled", text="无可用备份")
        else:
            self.restore_btn.configure(state="normal", text="还原选中备份")

    def _restore_backup_world(self):
        if self.server_running:
            messagebox.showwarning("警告", "服务器正在运行中，请先停止服务器再进行还原操作！")
            return
            
        selected_display_name = self.restore_backup_var.get()
        if selected_display_name not in self.backup_map:
            messagebox.showwarning("提示", "请选择一个有效的备份！")
            return

        backup_path = self.backup_map[selected_display_name]
        server_path = self.current_server_path

        if not server_path or not os.path.isdir(server_path):
            messagebox.showerror("错误", "当前未选择有效的服务器文件夹。")
            return

        if not messagebox.askyesno("确认还原", f"警告: 您确定要将服务器 '{os.path.basename(server_path)}' 还原到备份点:\n{selected_display_name}\n此操作将覆盖当前服务器世界数据！"):
            return
            
        self.restore_btn.configure(state="disabled", text="还原中...")
        
        threading.Thread(target=self._restore_worker, args=(server_path, backup_path, selected_display_name), daemon=True).start()

    def _restore_worker(self, server_path, backup_path, display_name):
        self.app_log_insert(f"🔁 [还原] 开始将服务器 {os.path.basename(server_path)} 还原到 {display_name}...")
        
        try:
            # 1. 获取所有备份中的子文件夹
            backup_subdirs = [d for d in os.listdir(backup_path) if os.path.isdir(os.path.join(backup_path, d))]
            
            restored_any = False
            
            for subdir in backup_subdirs:
                src_p = os.path.join(backup_path, subdir)
                dest_p = os.path.join(server_path, subdir)
                
                if os.path.exists(dest_p):
                     self.app_log_insert(f"🗑️ [还原] 清理旧数据: {subdir}")
                     shutil.rmtree(dest_p)
                
                self.app_log_insert(f"📥 [还原] 恢复数据: {subdir}")
                shutil.copytree(src_p, dest_p)
                restored_any = True

            if restored_any:
                self.app_log_insert("✅ [还原] 世界还原成功！请重新启动服务器。")
                self.after(0, lambda: messagebox.showinfo("成功", "世界还原成功！请重新启动服务器。"))
            else:
                self.app_log_insert("⚠️ [还原] 未找到子文件夹，尝试全量覆盖还原...")
                exclude_list = ["logs", "backups", "servers", os.path.basename(server_path)]
                for item in os.listdir(server_path):
                     if item not in exclude_list:
                         path_to_delete = os.path.join(server_path, item)
                         if os.path.isdir(path_to_delete): shutil.rmtree(path_to_delete)
                         elif os.path.isfile(path_to_delete): os.remove(path_to_delete)
                         
                for item in os.listdir(backup_path):
                    src_item = os.path.join(backup_path, item)
                    dst_item = os.path.join(server_path, item)
                    if item in exclude_list: continue 
                    
                    if os.path.isdir(src_item):
                         shutil.copytree(src_item, dst_item)
                    elif os.path.isfile(src_item):
                         shutil.copy2(src_item, dst_item)
                
                self.app_log_insert("✅ [还原] 全量还原成功！请重新启动服务器。")
                self.after(0, lambda: messagebox.showinfo("成功", "全量还原成功！请重新启动服务器。"))

        except Exception as e:
            error_message = str(e)
            self.app_log_insert(f"❌ [还原] 还原失败: {error_message}")
            self.after(0, lambda msg=error_message: messagebox.showerror("错误", f"还原失败: {msg}"))
        finally:
            self.after(0, self._update_restore_button_state)

    # ---------------- 杂项 ----------------

    def apply_periodic_backup_settings(self):
        self._save_manager_config() # [修改] 保存设置
        messagebox.showinfo("OK", "周期备份设置已更新并保存")

    def app_log_insert(self, text):
        self.app_log_text.configure(state='normal')
        self.app_log_text.insert('end', text + '\n')
        self.app_log_text.see('end')
        self.app_log_text.configure(state='disabled')
        if self.app_log_file_handle:
            try:
                ts = datetime.datetime.now().strftime("[%H:%M:%S] ")
                self.app_log_file_handle.write(ts + text + '\n')
                self.app_log_file_handle.flush()
            except: pass

    log_insert = app_log_insert 

    def on_closing(self):
        if self.server_process and self.server_process.poll() is None:
            if messagebox.askyesno("退出", "服务器仍在运行，确定强制退出吗？"):
                self.safe_write_stdin("stop\n")
                time.sleep(1)
                try:
                    self.server_process.terminate()
                    time.sleep(1)
                    if self.server_process.poll() is None:
                         self.server_process.kill() 
                except:
                    pass
            else: return
        
        if self.app_log_file_handle: self.app_log_file_handle.close()
        if self.server_log_file_handle: self.server_log_file_handle.close()
        
        self.destroy()

if __name__ == '__main__':
    ensure_dirs()
    app = PageManager()
    app.mainloop()