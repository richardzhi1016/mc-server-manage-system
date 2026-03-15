# i18n Language Switching System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Chinese/English language switching to the frontend using react-i18next, with browser language auto-detection, localStorage persistence, and a Globe dropdown in TopNav.

**Architecture:** Install react-i18next + i18next-browser-languagedetector; create `src/i18n/config.ts` for initialization and `src/i18n/locale.ts` as a date-format helper; store ~257 strings in 8 namespaced JSON files; replace hardcoded strings with `t('key')` calls across ~20 files that contain Chinese text; add a language dropdown to TopNav.

**Tech Stack:** React 19, react-i18next ^15, i18next ^24, i18next-browser-languagedetector ^8, Zustand, Tailwind CSS, lucide-react (Globe icon already available)

---

## Chunk 1: Infrastructure — Dependencies, Config, Translation Files

### Task 1: Install i18n Packages

**Files:**
- Modify: `web-ui/package.json`

- [ ] **Step 1: Install packages**

```bash
cd web-ui
npm install react-i18next i18next i18next-browser-languagedetector
```

Expected output: packages added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Verify installation**

```bash
cd web-ui && npm ls react-i18next i18next i18next-browser-languagedetector
```

Expected: three lines showing installed versions (react-i18next@15.x, i18next@24.x, i18next-browser-languagedetector@8.x)

- [ ] **Step 3: Commit**

```bash
git add web-ui/package.json web-ui/package-lock.json
git commit -m "chore(i18n): install react-i18next and language detector"
```

---

### Task 2: Create i18n Configuration

**Files:**
- Create: `web-ui/src/i18n/config.ts`
- Create: `web-ui/src/i18n/locale.ts`

- [ ] **Step 1: Create `web-ui/src/i18n/config.ts`**

```typescript
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'zh-CN',
    supportedLngs: ['zh-CN', 'en-US'],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    resources: {
      'zh-CN': {
        common: zhCN.common,
        dashboard: zhCN.dashboard,
        players: zhCN.players,
        servers: zhCN.servers,
        mods: zhCN.mods,
        backups: zhCN.backups,
      },
      'en-US': {
        common: enUS.common,
        dashboard: enUS.dashboard,
        players: enUS.players,
        servers: enUS.servers,
        mods: enUS.mods,
        backups: enUS.backups,
      },
    },
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  })

export default i18next
```

- [ ] **Step 2: Create `web-ui/src/i18n/locale.ts`**

```typescript
import i18next from 'i18next'

/** Returns the current locale string for use in toLocaleString() calls. */
export function currentLocale(): string {
  return i18next.language === 'en-US' ? 'en-US' : 'zh-CN'
}
```

- [ ] **Step 3: Commit (placeholder — locales created in next task)**

Wait until Task 3 is complete, then commit together.

---

### Task 3: Create Translation JSON Files

**Files:**
- Create: `web-ui/src/i18n/locales/zh-CN.json`
- Create: `web-ui/src/i18n/locales/en-US.json`

- [ ] **Step 1: Create `web-ui/src/i18n/locales/zh-CN.json`**

```json
{
  "common": {
    "nav": {
      "dashboard": "仪表盘",
      "console": "控制台",
      "players": "玩家",
      "files": "文件",
      "mods": "模组",
      "plugins": "插件",
      "backups": "备份",
      "settings": "设置",
      "backToLobby": "返回大厅",
      "server": "服务器"
    },
    "status": {
      "running": "运行中",
      "stopped": "已停止",
      "starting": "启动中",
      "stopping": "停止中",
      "restarting": "重启中",
      "stable": "较稳定"
    },
    "actions": {
      "confirm": "确认",
      "cancel": "取消",
      "delete": "删除",
      "save": "保存",
      "refresh": "刷新",
      "next": "下一步",
      "previous": "上一步",
      "add": "添加",
      "remove": "移除",
      "restart": "重启服务器",
      "loadMore": "加载更多",
      "download": "下载",
      "restore": "恢复",
      "creating": "创建中...",
      "uploading": "上传中...",
      "restoring": "恢复中...",
      "installing": "安装中...",
      "saving": "保存中...",
      "start": "启动",
      "stop": "停止"
    },
    "console": {
      "connecting": "连接中...",
      "connected": "已连接",
      "reconnecting": "重连中...",
      "disconnected": "已断开",
      "startServer": "启动服务器",
      "stopServer": "停止服务器",
      "newLogsBelow": "新日志在下方"
    },
    "notFound": {
      "title": "页面未找到",
      "desc": "您访问的页面不存在或已被移动。",
      "back": "返回首页"
    },
    "language": {
      "zh": "中文",
      "en": "English"
    }
  },
  "dashboard": {
    "title": "仪表盘",
    "subtitle": "服务器实时状态监控",
    "updatedAt": "更新于",
    "createServer": "创建服务器",
    "metrics": {
      "cpu": "CPU 使用率",
      "memory": "内存使用",
      "players": "在线玩家",
      "disk": "磁盘空间",
      "memoryRate": "内存使用率",
      "usage": "使用率",
      "available": "可用 {{bytes}}",
      "low": "仅剩 {{bytes}}",
      "playersUnit": "人"
    },
    "timeRanges": {
      "hour1": "1小时",
      "hour6": "6小时",
      "hour24": "24小时"
    },
    "control": {
      "title": "服务器控制",
      "start": "启动",
      "stop": "停止",
      "restart": "重启",
      "operationFailed": "操作失败: {{error}}"
    }
  },
  "players": {
    "title": "玩家管理",
    "tabs": {
      "online": "在线 ({{count}})",
      "whitelist": "白名单 ({{count}})",
      "bans": "封禁 ({{count}})"
    },
    "noOnline": "没有在线玩家",
    "noOnlineDesc": "当前没有玩家在线",
    "actions": {
      "kick": "踢出",
      "ban": "封禁",
      "deop": "取消OP",
      "op": "OP",
      "teleport": "传送"
    },
    "kick": {
      "title": "踢出玩家",
      "confirm": "确定要将 \"{{username}}\" 踢出服务器吗？",
      "success": "{{username}} 已被踢出",
      "fail": "踢出失败"
    },
    "ban": {
      "title": "封禁玩家 {{username}}",
      "reasonLabel": "请输入封禁原因，这将记录到服务器日志中。",
      "placeholder": "输入封禁原因...",
      "continue": "继续",
      "success": "{{username}} 已被封禁",
      "fail": "封禁失败"
    },
    "op": {
      "grantTitle": "授予OP权限",
      "revokeTitle": "取消OP权限",
      "grantConfirm": "确定要授予 \"{{username}}\" 的OP权限吗？",
      "revokeConfirm": "确定要取消 \"{{username}}\" 的OP权限吗？",
      "granted": "{{username}} 已成为OP",
      "revoked": "{{username}} 已被取消OP",
      "fail": "操作失败"
    },
    "teleport": {
      "title": "传送 {{username}}",
      "select": "选择要将玩家传送到目标玩家身边",
      "noOthers": "没有其他在线玩家",
      "success": "{{username}} 已传送到 {{target}}",
      "fail": "传送失败"
    },
    "whitelist": {
      "title": "白名单",
      "addPlayer": "添加玩家",
      "empty": "白名单为空",
      "emptyDesc": "点击\"添加玩家\"将玩家添加到白名单",
      "addTitle": "添加玩家到白名单",
      "enterName": "输入玩家名称",
      "removeTitle": "从白名单移除",
      "removeConfirm": "确定要将 \"{{username}}\" 从白名单中移除吗？",
      "addSuccess": "{{username}} 已添加到白名单",
      "addFail": "添加失败",
      "removeSuccess": "{{username}} 已从白名单移除",
      "removeFail": "移除失败"
    },
    "banList": {
      "title": "封禁列表",
      "count": "{{count}} 个封禁",
      "empty": "没有封禁玩家",
      "emptyDesc": "被封禁的玩家将显示在这里",
      "banned": "已封禁",
      "reason": "原因: {{reason}}",
      "bannedAt": "封禁于 {{date}}",
      "unban": "解除封禁",
      "unbanConfirm": "确定要解除对 \"{{username}}\" 的封禁吗？该玩家将能够再次加入服务器。",
      "unbanSuccess": "{{username}} 已解除封禁",
      "unbanFail": "解除封禁失败"
    }
  },
  "servers": {
    "steps": {
      "select": "选择",
      "configure": "配置",
      "confirm": "确认",
      "upload": "上传"
    },
    "method": {
      "title": "选择创建方式",
      "desc": "请选择您想要的服务器创建方式"
    },
    "auto": {
      "name": "自动创建",
      "desc": "系统将自动下载 Minecraft 服务器文件并创建基础配置",
      "feature1": "自动下载指定版本的服务器",
      "feature2": "生成默认配置文件",
      "feature3": "一键完成设置"
    },
    "upload": {
      "name": "上传文件",
      "desc": "上传您已有的 Minecraft 服务器压缩包",
      "feature1": "支持 .7z 和 .7zip 格式",
      "feature2": "保留现有配置和世界",
      "feature3": "完整迁移现有服务器"
    },
    "configure": {
      "title": "服务器配置",
      "desc": "设置您的新 Minecraft 服务器的基本信息",
      "uploadDesc": "您已经上传了服务器文件，现在请配置服务器参数"
    },
    "fields": {
      "name": "服务器名称",
      "description": "服务器描述",
      "version": "Minecraft 版本",
      "difficulty": "难度",
      "maxPlayers": "最大玩家数",
      "port": "服务器端口",
      "motd": "服务器消息 (MOTD)"
    },
    "defaults": {
      "description": "我的 Minecraft 服务器",
      "motd": "欢迎来到我的 Minecraft 服务器！"
    },
    "difficulties": {
      "peaceful": "和平",
      "easy": "简单",
      "normal": "普通",
      "hard": "困难"
    },
    "uploadFile": {
      "title": "上传服务器文件",
      "subtitle": "上传您的 Minecraft 服务器包 (.7z 或 .7zip 格式)",
      "dropActive": "释放文件以上传",
      "dropIdle": "拖拽文件到此处或点击选择",
      "format": "支持 .7z 和 .7zip 格式"
    },
    "confirmCreate": {
      "title": "确认创建",
      "subtitle": "请确认以下服务器配置",
      "info": "服务器信息",
      "nameLabel": "名称",
      "method": "创建方式",
      "version": "版本",
      "difficulty": "难度",
      "maxPlayers": "最大玩家数",
      "port": "端口",
      "uploadedFile": "上传文件",
      "motd": "服务器消息 (MOTD)",
      "confirm": "确认创建"
    },
    "success": {
      "title": "服务器创建成功！",
      "desc": "您的服务器 \"{{name}}\" 已成功创建",
      "meta": "创建方式：{{method}} · 版本：{{version}}",
      "redirect": "即将跳转到管理面板...",
      "backToDashboard": "返回仪表盘"
    },
    "toast": {
      "uploadSuccess": "服务器包上传成功",
      "createSuccess": "服务器创建成功"
    }
  },
  "mods": {
    "title": "模组管理",
    "manage": "管理 {{server}} 的模组",
    "changed": "模组已变更，需要重启服务器才能生效",
    "installed": "已安装 ({{count}})",
    "empty": "暂无安装模组",
    "filters": {
      "all": "全部",
      "enabled": "已启用",
      "disabled": "已禁用"
    },
    "browse": "浏览 Modrinth",
    "searchPlaceholder": "搜索模组...",
    "noResults": "未找到相关模组",
    "browseHint": "在 Modrinth 搜索模组以安装",
    "plugins": {
      "title": "插件管理",
      "manage": "管理 {{server}} 的插件",
      "changed": "插件已变更，需要重启服务器才能生效",
      "installed": "已安装 ({{count}})",
      "empty": "暂无安装插件",
      "browse": "浏览 Modrinth 插件",
      "searchPlaceholder": "搜索插件...",
      "noResults": "未找到相关插件",
      "browseHint": "在 Modrinth 搜索插件以安装"
    }
  },
  "backups": {
    "title": "备份管理",
    "subtitle": "管理服务器备份，支持创建、恢复和下载",
    "types": {
      "startup": "启动备份",
      "scheduled": "定时备份",
      "manual": "手动备份"
    },
    "actions": {
      "create": "创建备份",
      "creating": "创建中...",
      "download": "下载",
      "restore": "恢复",
      "delete": "删除"
    },
    "empty": "暂无备份",
    "emptyDesc": "点击\"创建备份\"为当前服务器创建第一个备份",
    "confirmRestore": "确认恢复",
    "confirmDelete": "确认删除",
    "restoreWarning": "恢复此备份将覆盖当前服务器数据，服务器将在恢复期间停止运行。",
    "deleteWarning": "确定要删除此备份吗？此操作无法撤销。",
    "success": {
      "created": "备份创建成功",
      "restored": "备份恢复成功",
      "deleted": "备份已删除"
    },
    "errors": {
      "load": "加载备份列表失败",
      "create": "创建备份失败",
      "restore": "恢复备份失败",
      "delete": "删除备份失败"
    }
  }
}
```

- [ ] **Step 2: Create `web-ui/src/i18n/locales/en-US.json`**

```json
{
  "common": {
    "nav": {
      "dashboard": "Dashboard",
      "console": "Console",
      "players": "Players",
      "files": "Files",
      "mods": "Mods",
      "plugins": "Plugins",
      "backups": "Backups",
      "settings": "Settings",
      "backToLobby": "Back to Lobby",
      "server": "Server"
    },
    "status": {
      "running": "Running",
      "stopped": "Stopped",
      "starting": "Starting",
      "stopping": "Stopping",
      "restarting": "Restarting",
      "stable": "Stable"
    },
    "actions": {
      "confirm": "Confirm",
      "cancel": "Cancel",
      "delete": "Delete",
      "save": "Save",
      "refresh": "Refresh",
      "next": "Next",
      "previous": "Previous",
      "add": "Add",
      "remove": "Remove",
      "restart": "Restart Server",
      "loadMore": "Load More",
      "download": "Download",
      "restore": "Restore",
      "creating": "Creating...",
      "uploading": "Uploading...",
      "restoring": "Restoring...",
      "installing": "Installing...",
      "saving": "Saving...",
      "start": "Start",
      "stop": "Stop"
    },
    "console": {
      "connecting": "Connecting...",
      "connected": "Connected",
      "reconnecting": "Reconnecting...",
      "disconnected": "Disconnected",
      "startServer": "Start Server",
      "stopServer": "Stop Server",
      "newLogsBelow": "New logs below"
    },
    "notFound": {
      "title": "Page Not Found",
      "desc": "The page you visited does not exist or has been moved.",
      "back": "Back to Home"
    },
    "language": {
      "zh": "中文",
      "en": "English"
    }
  },
  "dashboard": {
    "title": "Dashboard",
    "subtitle": "Real-time server status monitoring",
    "updatedAt": "Updated at",
    "createServer": "Create Server",
    "metrics": {
      "cpu": "CPU Usage",
      "memory": "Memory Usage",
      "players": "Online Players",
      "disk": "Disk Space",
      "memoryRate": "Memory Usage Rate",
      "usage": "Usage",
      "available": "Available {{bytes}}",
      "low": "Only {{bytes}} left",
      "playersUnit": ""
    },
    "timeRanges": {
      "hour1": "1 Hour",
      "hour6": "6 Hours",
      "hour24": "24 Hours"
    },
    "control": {
      "title": "Server Control",
      "start": "Start",
      "stop": "Stop",
      "restart": "Restart",
      "operationFailed": "Operation failed: {{error}}"
    }
  },
  "players": {
    "title": "Player Management",
    "tabs": {
      "online": "Online ({{count}})",
      "whitelist": "Whitelist ({{count}})",
      "bans": "Bans ({{count}})"
    },
    "noOnline": "No Online Players",
    "noOnlineDesc": "No players are currently online",
    "actions": {
      "kick": "Kick",
      "ban": "Ban",
      "deop": "Deop",
      "op": "Op",
      "teleport": "Teleport"
    },
    "kick": {
      "title": "Kick Player",
      "confirm": "Are you sure you want to kick \"{{username}}\" from the server?",
      "success": "{{username}} has been kicked",
      "fail": "Failed to kick player"
    },
    "ban": {
      "title": "Ban Player {{username}}",
      "reasonLabel": "Please enter a ban reason. This will be recorded in the server log.",
      "placeholder": "Enter ban reason...",
      "continue": "Continue",
      "success": "{{username}} has been banned",
      "fail": "Failed to ban player"
    },
    "op": {
      "grantTitle": "Grant OP",
      "revokeTitle": "Revoke OP",
      "grantConfirm": "Are you sure you want to grant OP to \"{{username}}\"?",
      "revokeConfirm": "Are you sure you want to revoke OP from \"{{username}}\"?",
      "granted": "{{username}} is now an operator",
      "revoked": "{{username}}'s operator status has been revoked",
      "fail": "Operation failed"
    },
    "teleport": {
      "title": "Teleport {{username}}",
      "select": "Select a target player to teleport to",
      "noOthers": "No other online players",
      "success": "{{username}} has been teleported to {{target}}",
      "fail": "Failed to teleport player"
    },
    "whitelist": {
      "title": "Whitelist",
      "addPlayer": "Add Player",
      "empty": "Whitelist is empty",
      "emptyDesc": "Click \"Add Player\" to add players to the whitelist",
      "addTitle": "Add Player to Whitelist",
      "enterName": "Enter player name",
      "removeTitle": "Remove from Whitelist",
      "removeConfirm": "Are you sure you want to remove \"{{username}}\" from the whitelist?",
      "addSuccess": "{{username}} added to whitelist",
      "addFail": "Failed to add player",
      "removeSuccess": "{{username}} removed from whitelist",
      "removeFail": "Failed to remove player"
    },
    "banList": {
      "title": "Ban List",
      "count": "{{count}} bans",
      "empty": "No banned players",
      "emptyDesc": "Banned players will appear here",
      "banned": "Banned",
      "reason": "Reason: {{reason}}",
      "bannedAt": "Banned at {{date}}",
      "unban": "Unban",
      "unbanConfirm": "Are you sure you want to unban \"{{username}}\"? They will be able to rejoin the server.",
      "unbanSuccess": "{{username}} has been unbanned",
      "unbanFail": "Failed to unban player"
    }
  },
  "servers": {
    "steps": {
      "select": "Select",
      "configure": "Configure",
      "confirm": "Confirm",
      "upload": "Upload"
    },
    "method": {
      "title": "Select Creation Method",
      "desc": "Please select your desired server creation method"
    },
    "auto": {
      "name": "Auto Create",
      "desc": "The system will automatically download Minecraft server files and create basic configuration",
      "feature1": "Auto-download specified server version",
      "feature2": "Generate default configuration files",
      "feature3": "One-click setup completion"
    },
    "upload": {
      "name": "Upload File",
      "desc": "Upload your existing Minecraft server package",
      "feature1": "Supports .7z and .7zip formats",
      "feature2": "Keep existing configuration and world",
      "feature3": "Complete migration of existing servers"
    },
    "configure": {
      "title": "Server Configuration",
      "desc": "Set up basic information for your new Minecraft server",
      "uploadDesc": "You have uploaded the server files, now please configure the server parameters"
    },
    "fields": {
      "name": "Server Name",
      "description": "Server Description",
      "version": "Minecraft Version",
      "difficulty": "Difficulty",
      "maxPlayers": "Max Players",
      "port": "Server Port",
      "motd": "Server Message (MOTD)"
    },
    "defaults": {
      "description": "My Minecraft Server",
      "motd": "Welcome to my Minecraft server!"
    },
    "difficulties": {
      "peaceful": "Peaceful",
      "easy": "Easy",
      "normal": "Normal",
      "hard": "Hard"
    },
    "uploadFile": {
      "title": "Upload Server Files",
      "subtitle": "Upload your Minecraft server package (.7z or .7zip format)",
      "dropActive": "Release to upload",
      "dropIdle": "Drag files here or click to select",
      "format": "Supports .7z and .7zip formats"
    },
    "confirmCreate": {
      "title": "Confirm Creation",
      "subtitle": "Please confirm the following server configuration",
      "info": "Server Information",
      "nameLabel": "Name",
      "method": "Creation Method",
      "version": "Version",
      "difficulty": "Difficulty",
      "maxPlayers": "Max Players",
      "port": "Port",
      "uploadedFile": "Uploaded File",
      "motd": "Server Message (MOTD)",
      "confirm": "Confirm Creation"
    },
    "success": {
      "title": "Server Created Successfully!",
      "desc": "Your server \"{{name}}\" has been created successfully",
      "meta": "Method: {{method}} · Version: {{version}}",
      "redirect": "Redirecting to management panel...",
      "backToDashboard": "Back to Dashboard"
    },
    "toast": {
      "uploadSuccess": "Server package uploaded successfully",
      "createSuccess": "Server created successfully"
    }
  },
  "mods": {
    "title": "Mod Management",
    "manage": "Manage mods for {{server}}",
    "changed": "Mods changed, server restart required to take effect",
    "installed": "Installed ({{count}})",
    "empty": "No mods installed",
    "filters": {
      "all": "All",
      "enabled": "Enabled",
      "disabled": "Disabled"
    },
    "browse": "Browse Modrinth",
    "searchPlaceholder": "Search mods...",
    "noResults": "No relevant mods found",
    "browseHint": "Search for mods on Modrinth to install",
    "plugins": {
      "title": "Plugin Management",
      "manage": "Manage plugins for {{server}}",
      "changed": "Plugins changed, server restart required to take effect",
      "installed": "Installed ({{count}})",
      "empty": "No plugins installed",
      "browse": "Browse Modrinth Plugins",
      "searchPlaceholder": "Search plugins...",
      "noResults": "No relevant plugins found",
      "browseHint": "Search for plugins on Modrinth to install"
    }
  },
  "backups": {
    "title": "Backup Management",
    "subtitle": "Manage server backups: create, restore, and download",
    "types": {
      "startup": "Startup Backup",
      "scheduled": "Scheduled Backup",
      "manual": "Manual Backup"
    },
    "actions": {
      "create": "Create Backup",
      "creating": "Creating...",
      "download": "Download",
      "restore": "Restore",
      "delete": "Delete"
    },
    "empty": "No backups",
    "emptyDesc": "Click \"Create Backup\" to create the first backup for this server",
    "confirmRestore": "Confirm Restore",
    "confirmDelete": "Confirm Delete",
    "restoreWarning": "Restoring this backup will overwrite current server data. The server will stop during the restore process.",
    "deleteWarning": "Are you sure you want to delete this backup? This action cannot be undone.",
    "success": {
      "created": "Backup created successfully",
      "restored": "Backup restored successfully",
      "deleted": "Backup deleted"
    },
    "errors": {
      "load": "Failed to load backup list",
      "create": "Failed to create backup",
      "restore": "Failed to restore backup",
      "delete": "Failed to delete backup"
    }
  }
}
```

- [ ] **Step 3: Update `web-ui/src/main.tsx` to import i18n config**

Replace the file content with:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/config'
import App from './App.tsx'
import { ToastProvider } from './components/ui/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
```

- [ ] **Step 4: Verify the app still starts**

```bash
cd web-ui && npm run dev
```

Expected: Vite dev server starts on port 5173 with no errors in the terminal. Open browser and confirm the app loads (text still shows in Chinese because localStorage is empty, so browser language detection kicks in — if browser is zh, Chinese shows; if en, English shows).

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/i18n/ web-ui/src/main.tsx
git commit -m "feat(i18n): add i18next config, locale helper, and translation JSON files"
```

---

## Chunk 2: Language Switcher UI in TopNav

### Task 4: Add Language Dropdown to TopNav

**Files:**
- Modify: `web-ui/src/components/layout/TopNav.tsx`

- [ ] **Step 1: Replace TopNav.tsx with i18n-enabled version**

```typescript
import { Menu, Bell, Sun, Moon, Globe, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/useTheme'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'

interface TopNavProps {
  onMenuToggle: () => void
  serverName?: string
  serverStatus?: string
}

const LANGUAGES = [
  { code: 'zh-CN', labelKey: 'language.zh' },
  { code: 'en-US', labelKey: 'language.en' },
] as const

export function TopNav({ onMenuToggle, serverName, serverStatus }: TopNavProps) {
  const { theme, toggleTheme } = useTheme()
  const { t, i18n } = useTranslation('common')
  const [langOpen, setLangOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentLangLabel = i18n.language === 'en-US' ? t('language.en') : t('language.zh')

  function handleLangChange(code: string) {
    i18next.changeLanguage(code)
    setLangOpen(false)
  }

  return (
    <header
      className={cn(
        'h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800',
        'flex items-center justify-between px-4 lg:px-6'
      )}
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {serverName && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('nav.server')}:</span>
            <span className="font-medium text-gray-900 dark:text-white">{serverName}</span>
            {serverStatus && (
              <span
                className={cn(
                  'px-2 py-0.5 text-xs rounded-full font-medium',
                  serverStatus === 'running'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : serverStatus === 'stopped'
                    ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                )}
              >
                {serverStatus === 'running'
                  ? t('status.running')
                  : serverStatus === 'stopped'
                  ? t('status.stopped')
                  : serverStatus}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            onClick={() => setLangOpen((o) => !o)}
            className="gap-1 px-2 h-9 text-sm"
            aria-label="Switch language"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">{currentLangLabel}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>

          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 py-1">
              {LANGUAGES.map(({ code, labelKey }) => (
                <button
                  key={code}
                  onClick={() => handleLangChange(code)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                    'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                    i18n.language === code
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-300'
                  )}
                >
                  {i18n.language === code && <Check className="w-3 h-3 flex-shrink-0" />}
                  {i18n.language !== code && <span className="w-3 h-3 flex-shrink-0" />}
                  {t(labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </Button>

        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open the app. TopNav should show a Globe icon with "中文" or "English" text. Clicking it opens a dropdown. Selecting "English" switches the server status badge text immediately. The selection persists after page refresh.

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/components/layout/TopNav.tsx
git commit -m "feat(i18n): add language switcher dropdown to TopNav"
```

---

## Chunk 3: Migrate Layout & Common Namespace

### Task 5: Migrate Sidebar.tsx

**Files:**
- Modify: `web-ui/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update Sidebar.tsx**

Add `useTranslation` import and replace all label strings:

```typescript
import { LayoutDashboard, Server, Settings, Users, Terminal, Folder, Database, ArrowLeftCircle, Package, Puzzle } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { SidebarItem } from './SidebarItem'
import { useServerStore } from '@/store/useServerStore'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

interface SidebarProps {
  collapsed?: boolean
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const { t } = useTranslation('common')
  const { serverName } = useParams()
  const servers = useServerStore((s) => s.servers)
  const currentServer = servers.find((s) => s.name === serverName)
  const serverType = currentServer?.server_type?.toLowerCase() || ""

  const basePath = serverName ? `/${encodeURIComponent(serverName)}/panel` : '/servers'

  return (
    <aside
      className={cn(
        'flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800',
        'transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn('flex items-center gap-2 px-4 py-5 border-b border-gray-200 dark:border-gray-800', collapsed && 'justify-center px-2')}>
        <Server className="w-8 h-8 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
        {!collapsed && (
          <span className="font-bold text-lg text-gray-900 dark:text-white">
            MC Panel
          </span>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <SidebarItem
          to={basePath}
          icon={<LayoutDashboard className="w-5 h-5" />}
          label={t('nav.dashboard')}
          collapsed={collapsed}
          end
        />
        <SidebarItem
          to="/servers"
          icon={<ArrowLeftCircle className="w-5 h-5" />}
          label={t('nav.backToLobby')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/console`}
          icon={<Terminal className="w-5 h-5" />}
          label={t('nav.console')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/players`}
          icon={<Users className="w-5 h-5" />}
          label={t('nav.players')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/files`}
          icon={<Folder className="w-5 h-5" />}
          label={t('nav.files')}
          collapsed={collapsed}
        />
        {(serverType === "fabric" || serverType === "forge") && (
          <SidebarItem
            to={`${basePath}/mods`}
            icon={<Package className="w-5 h-5" />}
            label={t('nav.mods')}
            collapsed={collapsed}
          />
        )}
        {serverType === "paper" && (
          <SidebarItem
            to={`${basePath}/plugins`}
            icon={<Puzzle className="w-5 h-5" />}
            label={t('nav.plugins')}
            collapsed={collapsed}
          />
        )}
        <SidebarItem
          to={`${basePath}/backups`}
          icon={<Database className="w-5 h-5" />}
          label={t('nav.backups')}
          collapsed={collapsed}
        />
        <SidebarItem
          to={`${basePath}/settings`}
          icon={<Settings className="w-5 h-5" />}
          label={t('nav.settings')}
          collapsed={collapsed}
        />
      </nav>

      <div className={cn('px-2 py-4 border-t border-gray-200 dark:border-gray-800', collapsed && 'text-center')}>
        {!collapsed && (
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            MC Server Management
            <br />
            v1.0.0
          </div>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Check MobileNav.tsx — apply same pattern**

Read `web-ui/src/components/layout/MobileNav.tsx`. Add `useTranslation('common')` and replace nav labels using the same `t('nav.X')` keys.

- [ ] **Step 3: Migrate NotFound.tsx**

Read `web-ui/src/pages/NotFound.tsx`. Add `useTranslation('common')` and replace:
- Page title → `t('notFound.title')`
- Description → `t('notFound.desc')`
- Back button text → `t('notFound.back')`

- [ ] **Step 4: Migrate Console.tsx connection status strings**

Read `web-ui/src/pages/Console.tsx`. Add `useTranslation('common')` and replace:
- `"Connecting..."` → `t('console.connecting')`
- `"Connected"` → `t('console.connected')`
- `"Reconnecting..."` → `t('console.reconnecting')`
- `"Disconnected"` → `t('console.disconnected')`
- `"Start Server"` → `t('console.startServer')`
- `"Stop Server"` → `t('console.stopServer')`

Also read `web-ui/src/components/console/TerminalLogDisplay.tsx` and replace `"New logs below"` → `t('console.newLogsBelow')`.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/components/layout/Sidebar.tsx \
        web-ui/src/components/layout/MobileNav.tsx \
        web-ui/src/pages/NotFound.tsx \
        web-ui/src/pages/Console.tsx \
        web-ui/src/components/console/TerminalLogDisplay.tsx
git commit -m "feat(i18n): migrate layout and console strings to i18n"
```

---

## Chunk 4: Migrate Dashboard Namespace

### Task 6: Migrate Dashboard Page and Components

**Files:**
- Modify: `web-ui/src/pages/Dashboard.tsx`
- Modify: `web-ui/src/components/dashboard/QuickActions.tsx`
- Modify: `web-ui/src/components/dashboard/ResourceChart.tsx`
- Modify: `web-ui/src/components/dashboard/CpuStatusCard.tsx`
- Modify: `web-ui/src/components/dashboard/MemoryStatusCard.tsx`
- Modify: `web-ui/src/components/dashboard/PlayersStatusCard.tsx`
- Modify: `web-ui/src/components/dashboard/DiskStatusCard.tsx`
- Modify: `web-ui/src/components/dashboard/StatusCard.tsx`

- [ ] **Step 1: Migrate Dashboard.tsx**

Read `web-ui/src/pages/Dashboard.tsx`. Add imports:
```typescript
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n/locale'
```

Inside the component add: `const { t } = useTranslation('dashboard')`

Replace strings:
- `"仪表盘"` → `t('title')`
- `"服务器实时状态监控"` → `t('subtitle')`
- `"更新于"` → `t('updatedAt')`
- `"创建服务器"` → `t('createServer')`
- `"较稳定"` → `t('metrics.stable')` (or use `t` from `'common'` for `status.stable`)
- `toLocaleTimeString('zh-CN')` → `toLocaleTimeString(currentLocale())`

- [ ] **Step 2: Migrate QuickActions.tsx**

Read the current file (already shown above). Add `useTranslation('dashboard')`.

Replace:
```typescript
// Before
const actionText = actionState.action === 'start' ? '启动中' :
                  actionState.action === 'stop' ? '停止中' : '重启中'
// After
const actionText = actionState.action === 'start' ? t('control.start') + '...' :
                  actionState.action === 'stop' ? t('control.stop') + '...' : t('control.restart') + '...'
```

Also use `t` from `common` namespace for the status badge — the status strings `running`/`stopped`/`starting`/`stopping`/`restarting` all live in `common.status`:

```typescript
const { t } = useTranslation('dashboard')
const { t: tc } = useTranslation('common')

// Status badge:
if (isLoading) {
  const actionText = actionState.action === 'start' ? tc('status.starting') :
                    actionState.action === 'stop' ? tc('status.stopping') : tc('status.restarting')
  ...
}
if (isTransitional) {
  const statusText = serverStatus === 'starting' ? tc('status.starting') : tc('status.stopping')
  ...
}
if (isRunning) { return <span>...{tc('status.running')}</span> }
if (isStopped) { return <span>...{tc('status.stopped')}</span> }

// Buttons:
<Button>..{t('control.start')}</Button>
<Button>..{t('control.stop')}</Button>
<Button>..{t('control.restart')}</Button>

// Error:
<p>...{t('control.operationFailed', { error: actionState.error })}</p>

// Card title:
<CardTitle>{t('control.title')}</CardTitle>
```

- [ ] **Step 3: Migrate ResourceChart.tsx**

Read `web-ui/src/components/dashboard/ResourceChart.tsx`. Add `useTranslation('dashboard')`.

Replace time range labels:
- `"1小时"` → `t('timeRanges.hour1')`
- `"6小时"` → `t('timeRanges.hour6')`
- `"24小时"` → `t('timeRanges.hour24')`

Replace metric labels used in chart series names:
- `"CPU 使用率"` → `t('metrics.cpu')`
- `"内存使用率"` → `t('metrics.memoryRate')`
- `"在线玩家"` → `t('metrics.players')`
- `"人"` unit → `t('metrics.playersUnit')` (empty string in English)

- [ ] **Step 4: Migrate status cards**

For each card, add `useTranslation('dashboard')` and replace the title string:

**CpuStatusCard.tsx**: `"CPU 使用率"` → `t('metrics.cpu')`

**MemoryStatusCard.tsx**: `"内存使用"` → `t('metrics.memory')`

**PlayersStatusCard.tsx**: `"在线玩家"` → `t('metrics.players')`

**DiskStatusCard.tsx**:
- `"磁盘空间"` → `t('metrics.disk')`
- `"可用 ${formatBytes(freeBytes)}"` → `t('metrics.available', { bytes: formatBytes(freeBytes) })`
- `"仅剩 ${formatBytes(freeBytes)}"` → `t('metrics.low', { bytes: formatBytes(freeBytes) })`

**StatusCard.tsx**: `"使用率"` → `t('metrics.usage')`

- [ ] **Step 5: Migrate useServerActions.ts hook**

Read `web-ui/src/hooks/useServerActions.ts`. This hook fires all server-action toast messages — they must be translated here, not in the calling components.

Add to `zh-CN.json` → `dashboard.control`:
```json
"startSuccess": "服务器 {{server}} 已启动",
"startFail": "启动失败",
"stopSuccess": "服务器 {{server}} 已停止",
"stopFail": "停止失败",
"restartSuccess": "服务器 {{server}} 已重启",
"restartFail": "重启失败"
```

Add to `en-US.json` → `dashboard.control`:
```json
"startSuccess": "Server {{server}} started",
"startFail": "Failed to start server",
"stopSuccess": "Server {{server}} stopped",
"stopFail": "Failed to stop server",
"restartSuccess": "Server {{server}} restarted",
"restartFail": "Failed to restart server"
```

In `useServerActions.ts`, since it is a hook (React hook — can call `useTranslation`):
```typescript
import { useTranslation } from 'react-i18next'

// Inside the hook:
const { t } = useTranslation('dashboard')

// Replace toast calls:
notify({ type: "success", message: t('control.startSuccess', { server: serverName }) })
notify({ type: "error",   message: t('control.startFail') })
notify({ type: "success", message: t('control.stopSuccess', { server: serverName }) })
notify({ type: "error",   message: t('control.stopFail') })
notify({ type: "success", message: t('control.restartSuccess', { server: serverName }) })
notify({ type: "error",   message: t('control.restartFail') })
```

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/pages/Dashboard.tsx \
        web-ui/src/components/dashboard/ \
        web-ui/src/hooks/useServerActions.ts \
        web-ui/src/i18n/locales/zh-CN.json \
        web-ui/src/i18n/locales/en-US.json
git commit -m "feat(i18n): migrate dashboard namespace strings and useServerActions hook"
```

---

## Chunk 5: Migrate Players Namespace

### Task 7: Migrate Players Page and Components

**Files:**
- Modify: `web-ui/src/pages/Players.tsx`
- Modify: `web-ui/src/components/players/PlayerCard.tsx`
- Modify: `web-ui/src/components/players/BanReasonModal.tsx`
- Modify: `web-ui/src/components/players/ConfirmModal.tsx`
- Modify: `web-ui/src/components/players/TeleportModal.tsx`
- Modify: `web-ui/src/components/players/WhitelistManager.tsx`
- Modify: `web-ui/src/components/players/BanListManager.tsx`

- [ ] **Step 1: Migrate Players.tsx**

Read `web-ui/src/pages/Players.tsx`. Add `useTranslation('players')`.

Replace notification messages (using interpolation):
```typescript
const { t } = useTranslation('players')

// Kick
notify({ type: "success", message: t('kick.success', { username: kickTarget.username }) })
notify({ type: "error", message: t('kick.fail') })

// Ban
notify({ type: "success", message: t('ban.success', { username: banTarget.username }) })
notify({ type: "error", message: t('ban.fail') })

// Op
notify({ type: "success", message: t('op.revoked', { username: opTarget.username }) })
notify({ type: "success", message: t('op.granted', { username: opTarget.username }) })
notify({ type: "error", message: t('op.fail') })

// Teleport
notify({ type: "success", message: t('teleport.success', { username: teleportPlayer.username, target: targetUsername }) })
notify({ type: "error", message: t('teleport.fail') })
```

Replace UI strings:
```typescript
// Page title
<h1>{t('title')}</h1>

// Refresh button
<Button>{t('actions.refresh')}</Button>  // or use common t

// Tabs
`${t('tabs.online', { count: onlinePlayers.length })}`
`${t('tabs.whitelist', { count: whitelist.length })}`
`${t('tabs.bans', { count: bans.length })}`

// Empty state
<p>{t('noOnline')}</p>
<p>{t('noOnlineDesc')}</p>
```

For the kick/op confirm modals already in Players.tsx:
```typescript
// Kick modal title/confirm/button
t('kick.title'), t('kick.confirm', { username: kickTarget?.username }), t('kick.action') (use common 'actions.confirm')

// Op modal
t('op.grantTitle') or t('op.revokeTitle') based on isOp
t('op.grantConfirm', { username }) or t('op.revokeConfirm', { username })
```

- [ ] **Step 2: Migrate PlayerCard.tsx**

Read the file. Add `useTranslation('players')` and replace button labels:
- `"传送"` → `t('actions.teleport')`
- `"取消OP"` → `t('actions.deop')`
- `"OP"` → `t('actions.op')`
- `"踢出"` → `t('actions.kick')`
- `"封禁"` → `t('actions.ban')`

- [ ] **Step 3: Migrate BanReasonModal.tsx**

Read the file. Add `useTranslation('players')` and replace:
- `"封禁玩家 ${username}"` → `t('ban.title', { username })`
- `"请输入封禁原因..."` → `t('ban.reasonLabel')`
- `"输入封禁原因..."` (placeholder) → `t('ban.placeholder')`
- `"取消"` → use `useTranslation('common')` → `tc('actions.cancel')`
- `"继续"` → `t('ban.continue')`

- [ ] **Step 4: Migrate ConfirmModal.tsx**

Read the file. Add `useTranslation('common')` and replace:
- `"确认"` → `t('actions.confirm')`
- `"取消"` → `t('actions.cancel')`

- [ ] **Step 5: Migrate TeleportModal.tsx**

Read the file. Add `useTranslation('players')`.

Replace:
- `"传送 ${player.username}"` → `t('teleport.title', { username: player.username })`
- `"选择要将玩家传送到目标玩家身边"` → `t('teleport.select')`
- `"没有其他在线玩家"` → `t('teleport.noOthers')`
- `"取消"` → use common `tc('actions.cancel')`
- `"传送"` → `t('actions.teleport')`

- [ ] **Step 6: Migrate WhitelistManager.tsx**

Read the file. Add `useTranslation('players')`.

Replace all strings using `t('whitelist.X')` keys. Example:
- `"白名单"` → `t('whitelist.title')`
- `"添加玩家"` → `t('whitelist.addPlayer')`
- `"白名单为空"` → `t('whitelist.empty')`
- etc.

Notification messages:
- `notify({ message: t('whitelist.addSuccess', { username }) })`
- `notify({ message: t('whitelist.addFail') })`
- etc.

- [ ] **Step 7: Migrate BanListManager.tsx (+ toLocaleString fix)**

Read `web-ui/src/components/players/BanListManager.tsx`. Add imports:
```typescript
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n/locale'
```

Replace strings using `t('banList.X')` keys.

Fix toLocaleString:
```typescript
// Before
new Date(entry.banned_at).toLocaleString()

// After
new Date(entry.banned_at).toLocaleString(currentLocale())
```

For `"封禁于 ${date}"`:
```typescript
t('banList.bannedAt', { date: new Date(entry.banned_at).toLocaleString(currentLocale()) })
```

- [ ] **Step 8: Commit**

```bash
git add web-ui/src/pages/Players.tsx \
        web-ui/src/components/players/
git commit -m "feat(i18n): migrate players namespace strings"
```

---

## Chunk 6: Migrate Servers Namespace

### Task 8: Migrate ServerCreate.tsx

**Files:**
- Modify: `web-ui/src/pages/ServerCreate.tsx`

- [ ] **Step 1: Read the file**

Read `web-ui/src/pages/ServerCreate.tsx` (full content).

- [ ] **Step 2: Add i18n to ServerCreate.tsx**

Add at top:
```typescript
import { useTranslation } from 'react-i18next'
```

Inside the component:
```typescript
const { t } = useTranslation('servers')
const { t: tc } = useTranslation('common')
```

Replace step labels:
```typescript
// Steps array (lines ~234-246)
const steps = [
  { label: t('steps.select') },
  { label: mode === 'upload' ? t('steps.upload') : t('steps.configure') },
  { label: t('steps.confirm') },
]
```

Replace method selection screen (step 0):
```typescript
<h2>{t('method.title')}</h2>
<p>{t('method.desc')}</p>

// Auto card
<h3>{t('auto.name')}</h3>
<p>{t('auto.desc')}</p>
<li>{t('auto.feature1')}</li>
<li>{t('auto.feature2')}</li>
<li>{t('auto.feature3')}</li>

// Upload card
<h3>{t('upload.name')}</h3>
<p>{t('upload.desc')}</p>
<li>{t('upload.feature1')}</li>
<li>{t('upload.feature2')}</li>
<li>{t('upload.feature3')}</li>

// Button
<Button>{mode === 'upload' ? t('upload.name') : tc('actions.next')}</Button>
```

Replace configure screen (step 1):
```typescript
<h2>{t('configure.title')}</h2>
<p>{mode === 'upload' ? t('configure.uploadDesc') : t('configure.desc')}</p>

// Field labels
<label>{t('fields.name')}</label>
<label>{t('fields.description')}</label>
<label>{t('fields.version')}</label>
<label>{t('fields.difficulty')}</label>
<label>{t('fields.maxPlayers')}</label>
<label>{t('fields.port')}</label>
<label>{t('fields.motd')}</label>

// Difficulty options
<option value="peaceful">{t('difficulties.peaceful')}</option>
<option value="easy">{t('difficulties.easy')}</option>
<option value="normal">{t('difficulties.normal')}</option>
<option value="hard">{t('difficulties.hard')}</option>

// Buttons
<Button>{tc('actions.previous')}</Button>
<Button>{tc('actions.next')}</Button>
```

Replace upload screen:
```typescript
<h2>{t('uploadFile.title')}</h2>
<p>{t('uploadFile.subtitle')}</p>
// Dropzone
<p>{isDragging ? t('uploadFile.dropActive') : t('uploadFile.dropIdle')}</p>
<p>{t('uploadFile.format')}</p>
// Buttons
<Button>{tc('actions.previous')}</Button>
<Button>{uploading ? tc('actions.uploading') : t('upload.name')}</Button>
```

Replace confirm screen:
```typescript
<h2>{t('confirmCreate.title')}</h2>
<p>{t('confirmCreate.subtitle')}</p>
<h3>{t('confirmCreate.info')}</h3>
<span>{t('confirmCreate.nameLabel')}</span>
<span>{t('confirmCreate.method')}</span>
<span>{mode === 'auto' ? t('auto.name') : t('upload.name')}</span>
<span>{t('confirmCreate.version')}</span>
<span>{t('confirmCreate.difficulty')}</span>
<span>{t('confirmCreate.maxPlayers')}</span>
<span>{t('confirmCreate.port')}</span>
<span>{t('confirmCreate.uploadedFile')}</span>
<span>{t('confirmCreate.motd')}</span>
// Buttons
<Button>{tc('actions.previous')}</Button>
<Button>{creating ? tc('actions.creating') : t('confirmCreate.confirm')}</Button>
```

Replace success screen:
```typescript
<h2>{t('success.title')}</h2>
<p>{t('success.desc', { name: config.name })}</p>
<p>{t('success.meta', { method: mode === 'auto' ? t('auto.name') : t('upload.name'), version: config.version })}</p>
<p>{t('success.redirect')}</p>
<Button>{t('success.backToDashboard')}</Button>
```

Replace toast notifications:
```typescript
notify({ type: "success", message: t('toast.uploadSuccess') })
notify({ type: "success", message: t('toast.createSuccess') })
```

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/pages/ServerCreate.tsx
git commit -m "feat(i18n): migrate servers namespace strings"
```

---

## Chunk 7: Migrate Mods Namespace

### Task 9: Migrate Mods.tsx and Plugins.tsx

**Files:**
- Modify: `web-ui/src/pages/Mods.tsx`
- Modify: `web-ui/src/pages/Plugins.tsx`

- [ ] **Step 1: Migrate Mods.tsx**

Read `web-ui/src/pages/Mods.tsx`. Add `useTranslation('mods')`.

```typescript
const { t } = useTranslation('mods')
const { t: tc } = useTranslation('common')

// Page header
<h1>{t('title')}</h1>
<p>{t('manage', { server: serverName })}</p>

// Changed notice banner
<span>{t('changed')}</span>
<Button>{tc('actions.restart')}</Button>

// Installed tab
`${t('installed', { count: installedMods.length })}`

// Filter tabs
t('filters.all'), t('filters.enabled'), t('filters.disabled')

// Empty state
<p>{t('empty')}</p>

// Browse section
<h2>{t('browse')}</h2>
<input placeholder={t('searchPlaceholder')} />

// Load more
<Button>{tc('actions.loadMore')}</Button>

// No results
<p>{t('noResults')}</p>
<p>{t('browseHint')}</p>
```

- [ ] **Step 2: Migrate Plugins.tsx**

Read `web-ui/src/pages/Plugins.tsx`. Add `useTranslation('mods')` (same namespace, under `plugins` sub-key).

```typescript
const { t } = useTranslation('mods')
const { t: tc } = useTranslation('common')

// Page header
<h1>{t('plugins.title')}</h1>
<p>{t('plugins.manage', { server: serverName })}</p>

// Changed notice
<span>{t('plugins.changed')}</span>
<Button>{tc('actions.restart')}</Button>

// Installed tab
`${t('plugins.installed', { count: installedPlugins.length })}`

// Filters: same keys as mods
t('filters.all'), t('filters.enabled'), t('filters.disabled')

// Empty state
<p>{t('plugins.empty')}</p>

// Browse section
<h2>{t('plugins.browse')}</h2>
<input placeholder={t('plugins.searchPlaceholder')} />

// Load more, no results
<Button>{tc('actions.loadMore')}</Button>
<p>{t('plugins.noResults')}</p>
<p>{t('plugins.browseHint')}</p>
```

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/pages/Mods.tsx web-ui/src/pages/Plugins.tsx
git commit -m "feat(i18n): migrate mods and plugins namespace strings"
```

---

## Chunk 8: Migrate Backups Namespace + Fix Remaining toLocaleString

### Task 10: Migrate Backups.tsx

**Files:**
- Modify: `web-ui/src/pages/Backups.tsx`

- [ ] **Step 1: Update Backups.tsx**

Add imports:
```typescript
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n/locale'
```

Inside component: `const { t } = useTranslation('backups')`

Fix `formatDate` helper at top of file — replace hardcoded locale:
```typescript
// Before
function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString("zh-CN", { ... })
}

// After — formatDate now needs locale; pass it in or use i18next directly
import i18next from 'i18next'
import { currentLocale } from '@/i18n/locale'

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString(currentLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}
```

Fix `getTypeBadge` helper:
```typescript
// getTypeBadge uses t() — but it's outside the component and can't use hooks.
// Move label resolution inside the component, or pass t as a parameter.
// Simplest: return a key instead of a label, resolve in JSX.

function getTypeBadge(filename: string): { key: string; className: string } {
  if (filename.includes("_startup")) {
    return { key: "types.startup", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" }
  }
  if (filename.includes("_periodic")) {
    return { key: "types.scheduled", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" }
  }
  return { key: "types.manual", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" }
}

// In JSX where getTypeBadge is used:
const badge = getTypeBadge(backup.filename)
<span className={badge.className}>{t(badge.key)}</span>
```

Replace notification messages:
```typescript
notify({ type: "error",   message: t('errors.load') })
notify({ type: "success", message: t('success.created') })
notify({ type: "error",   message: t('errors.create') })
notify({ type: "success", message: t('success.restored') })
notify({ type: "error",   message: t('errors.restore') })
notify({ type: "success", message: t('success.deleted') })
notify({ type: "error",   message: t('errors.delete') })
```

Replace UI strings:
```typescript
// Page header
<h1>{t('title')}</h1>
<p>{t('subtitle')}</p>

// Create button
<Button>{creating ? t('actions.creating') : t('actions.create')}</Button>

// Empty state
<p>{t('empty')}</p>
<p>{t('emptyDesc')}</p>

// Backup action buttons
<Button>{t('actions.download')}</Button>
<Button>{t('actions.restore')}</Button>
<Button>{t('actions.delete')}</Button>

// Confirm modals
<h2>{confirmAction.type === 'restore' ? t('confirmRestore') : t('confirmDelete')}</h2>
<p>{confirmAction.type === 'restore' ? t('restoreWarning') : t('deleteWarning')}</p>
// Cancel button: tc('actions.cancel')
// Confirm restore button
<Button>{restoring ? t('actions.creating') : t('confirmRestore')}</Button>
// Confirm delete button
<Button>{t('confirmDelete')}</Button>
```

- [ ] **Step 2: Verify formatDate works for both locales**

With English selected, date like `2026-03-15 14:30:00` should format as `03/15/2026, 02:30:00 PM` (or similar en-US format). With Chinese, format as `2026/03/15 14:30:00`.

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/pages/Backups.tsx
git commit -m "feat(i18n): migrate backups namespace and fix toLocaleString"
```

---

### Task 11: Fix Dashboard.tsx toLocaleString

**Files:**
- Modify: `web-ui/src/pages/Dashboard.tsx` (already partially done in Task 6)

- [ ] **Step 1: Verify toLocaleString fix in Dashboard.tsx**

Ensure `toLocaleTimeString('zh-CN')` has been replaced with `toLocaleTimeString(currentLocale())` (this was done in Task 6, Step 1 — verify it's in place).

```bash
grep -n "zh-CN" web-ui/src/pages/Dashboard.tsx
```

Expected: no output (no remaining hardcoded zh-CN).

```bash
grep -rn "zh-CN" web-ui/src/
```

Expected: no output across the entire src directory.

- [ ] **Step 2: Final smoke test**

1. Open app with browser language set to English (`en`)
2. Verify all pages show English text
3. Switch to 中文 in TopNav dropdown
4. Verify all pages show Chinese text
5. Refresh the page — verify language preference persisted
6. Navigate through: Dashboard → Console → Players → Backups → Mods/Plugins → Settings

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(i18n): complete i18n migration — Chinese/English switching fully operational"
```

---

## IMPORTANT: JSON File Building Strategy

Tasks 3, 12, and 14 all modify `zh-CN.json` and `en-US.json`. Each task **adds new namespace keys** — it does NOT replace the file. When implementing Tasks 12 and 14:
- Read the current JSON file first
- Merge the new namespace into the existing JSON object
- Do NOT overwrite the existing namespaces

---

## Chunk 4 Addendum: ResourceChart.tsx toLocaleString

**Important:** In addition to replacing time-range and metric label strings, `ResourceChart.tsx` also contains a `toLocaleTimeString('zh-CN')` call for X-axis labels. Apply the same fix as Dashboard.tsx:

```typescript
import { currentLocale } from '@/i18n/locale'
// ...
date.toLocaleTimeString(currentLocale(), { ... })
```

This fix must be applied **in the same commit** as Task 6.

---

## Chunk 8 Addendum: Migrate FileBrowser.tsx

### Task 12: Migrate FileBrowser.tsx (files namespace)

**Files:**
- Modify: `web-ui/src/i18n/locales/zh-CN.json` — add `files` namespace
- Modify: `web-ui/src/i18n/locales/en-US.json` — add `files` namespace
- Modify: `web-ui/src/i18n/config.ts` — register `files` namespace
- Modify: `web-ui/src/components/file-browser/FileBrowser.tsx`

- [ ] **Step 1: Add `files` namespace to zh-CN.json**

Append the following to the top-level JSON object in `zh-CN.json`:

```json
"files": {
  "title": "文件管理",
  "root": "根目录",
  "newFolder": "新建文件夹",
  "uploadFile": "上传文件",
  "dropHere": "拖放文件到此处上传",
  "folderNamePlaceholder": "输入文件夹名称",
  "emptyFolder": "此文件夹为空",
  "confirmDelete": "确定删除 \"{{name}}\"？",
  "tooltip": {
    "refresh": "刷新",
    "newFolder": "新建文件夹",
    "upload": "上传文件"
  },
  "errors": {
    "load": "加载文件失败",
    "rename": "重命名失败",
    "delete": "删除失败",
    "createFolder": "创建文件夹失败",
    "upload": "上传失败"
  }
}
```

- [ ] **Step 2: Add `files` namespace to en-US.json**

```json
"files": {
  "title": "File Manager",
  "root": "Root",
  "newFolder": "New Folder",
  "uploadFile": "Upload File",
  "dropHere": "Drop files here to upload",
  "folderNamePlaceholder": "Enter folder name",
  "emptyFolder": "This folder is empty",
  "confirmDelete": "Are you sure you want to delete \"{{name}}\"?",
  "tooltip": {
    "refresh": "Refresh",
    "newFolder": "New Folder",
    "upload": "Upload File"
  },
  "errors": {
    "load": "Failed to load files",
    "rename": "Failed to rename",
    "delete": "Failed to delete",
    "createFolder": "Failed to create folder",
    "upload": "Failed to upload"
  }
}
```

- [ ] **Step 3: Register `files` namespace in config.ts**

In `web-ui/src/i18n/config.ts`, add `files: zhCN.files` and `files: enUS.files` to the respective resource entries.

- [ ] **Step 4: Migrate FileBrowser.tsx**

Read `web-ui/src/components/file-browser/FileBrowser.tsx`. It is a standalone helper-function + component file.

Add imports:
```typescript
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n/locale'
```

Fix `formatDate` (top-level helper — does NOT use hooks, so reads `currentLocale()` directly):
```typescript
import { currentLocale } from '@/i18n/locale'

function formatDate(timestamp: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString(currentLocale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
```

Inside the `FileBrowser` component add:
```typescript
const { t } = useTranslation('files')
```

Replace strings:
```typescript
// Header
<h3>{t('title')}</h3>

// Toolbar tooltips
<button title={t('tooltip.refresh')}>
<button onClick={() => setNewFolderState(t('newFolder'))} title={t('tooltip.newFolder')}>
<button title={t('tooltip.upload')}>

// Breadcrumb root entry
{ name: t('root'), path: '' }

// Drag overlay
<p>{t('dropHere')}</p>

// New folder placeholder
<input placeholder={t('folderNamePlaceholder')} defaultValue={t('newFolder')} />

// Empty state
<p>{t('emptyFolder')}</p>

// Error alerts (replace alert() calls):
alert(err instanceof Error ? err.message : t('errors.rename'))
// For delete confirm:
if (!confirm(t('confirmDelete', { name: contextMenu.item.name }))) return
alert(err instanceof Error ? err.message : t('errors.delete'))
// For create folder:
alert(err instanceof Error ? err.message : t('errors.createFolder'))
// For upload:
alert(err instanceof Error ? err.message : t('errors.upload'))

// setError for load failure:
setError(err instanceof Error ? err.message : t('errors.load'))
```

Note: `alert()` and `confirm()` calls are native browser dialogs. They cannot use React translation hooks but can receive a translated string passed to them — as shown above, call `t()` first to get the string, then pass it to `alert()`/`confirm()`.

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/i18n/locales/zh-CN.json \
        web-ui/src/i18n/locales/en-US.json \
        web-ui/src/i18n/config.ts \
        web-ui/src/components/file-browser/FileBrowser.tsx
git commit -m "feat(i18n): migrate files namespace and fix FileBrowser toLocaleDateString"
```

---

## Chunk 9: Migrate Servers Lobby and Settings Namespace

### Task 13: Migrate ServerLobby.tsx and server-lobby components

**Files:**
- Modify: `web-ui/src/pages/ServerLobby.tsx`
- Modify: `web-ui/src/components/server-lobby/` (read each file first)

The `servers` namespace already covers ServerCreate strings. ServerLobby.tsx and its components use English strings — add Chinese translations under a `lobby` sub-key in the `servers` namespace.

- [ ] **Step 1: Extend `servers` namespace in JSON files**

Add to `zh-CN.json` under `"servers"`:
```json
"lobby": {
  "title": "仪表盘",
  "subtitle": "管理您的 Minecraft 服务器实例",
  "systemNormal": "系统正常",
  "loadError": "加载服务器失败",
  "retry": "重试",
  "createSuccess": "服务器 \"{{name}}\" 创建成功！",
  "createFail": "创建服务器失败，请重试。",
  "cloneSuccess": "服务器 \"{{name}}\" 克隆成功！",
  "deleteSuccess": "服务器 \"{{name}}\" 已删除。"
}
```

Add to `en-US.json` under `"servers"`:
```json
"lobby": {
  "title": "Dashboard",
  "subtitle": "Manage your Minecraft server instances",
  "systemNormal": "System Normal",
  "loadError": "Failed to load servers",
  "retry": "Retry",
  "createSuccess": "Server \"{{name}}\" created successfully!",
  "createFail": "Failed to create server. Please try again.",
  "cloneSuccess": "Server \"{{name}}\" cloned successfully!",
  "deleteSuccess": "Server \"{{name}}\" deleted."
}
```

- [ ] **Step 2: Migrate ServerLobby.tsx**

Read `web-ui/src/pages/ServerLobby.tsx`. Add `useTranslation('servers')`.

Replace:
```typescript
const { t } = useTranslation('servers')

// Page title/subtitle
<h1>{t('lobby.title')}</h1>
<p>{t('lobby.subtitle')}</p>

// Status badge
<span>{t('lobby.systemNormal')}</span>

// Error state
<p>{t('lobby.loadError')}</p>
<Button>{t('lobby.retry')}</Button>

// Toast messages (already in English — replace with t())
showToast('success', t('lobby.createSuccess', { name: data.name }))
showToast('error', t('lobby.createFail'))
showToast('success', t('lobby.cloneSuccess', { name: newName }))
showToast('success', t('lobby.deleteSuccess', { serverName }))
```

- [ ] **Step 3: Read and assess server-lobby components**

Read each file in `web-ui/src/components/server-lobby/` (CreateServerModal, CloneServerModal, DeleteServerModal, LobbyServerCard, AddServerCard). These are primarily English — check for any Chinese strings. Migrate any Chinese strings found using the `servers` namespace.

For English-only modals (CreateServerModal, CloneServerModal, DeleteServerModal): Add `useTranslation('servers')` and wrap any visible UI labels in `t()` calls, adding corresponding Chinese translations to `zh-CN.json` under `servers.createModal`, `servers.cloneModal`, `servers.deleteModal` sub-keys as needed.

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/i18n/locales/zh-CN.json \
        web-ui/src/i18n/locales/en-US.json \
        web-ui/src/pages/ServerLobby.tsx \
        web-ui/src/components/server-lobby/
git commit -m "feat(i18n): migrate server lobby strings"
```

---

### Task 14: Migrate Settings Components

**Files:**
- Modify: `web-ui/src/i18n/locales/zh-CN.json` — add `settings` namespace
- Modify: `web-ui/src/i18n/locales/en-US.json` — add `settings` namespace
- Modify: `web-ui/src/i18n/config.ts` — register `settings` namespace
- Modify: `web-ui/src/pages/Settings.tsx`
- Modify: `web-ui/src/components/settings/StartupParams.tsx`
- Modify: `web-ui/src/components/settings/ServerProperties.tsx`
- Modify: `web-ui/src/components/settings/ScheduledTasks.tsx`

- [ ] **Step 1: Add `settings` namespace to JSON files**

Add to `zh-CN.json`:
```json
"settings": {
  "tabs": {
    "startup": "启动参数",
    "properties": "服务器属性",
    "tasks": "计划任务",
    "theme": "主题"
  },
  "startup": {
    "title": "启动参数",
    "selectServer": "选择服务器",
    "memoryAllocation": "内存分配",
    "minMemory": "最小内存",
    "maxMemory": "最大内存",
    "jvmFlags": "JVM 参数",
    "jvmPlaceholder": "输入 JVM 参数 (如 -XX:+UseG1GC)",
    "addFlag": "添加参数",
    "saving": "保存中...",
    "save": "保存启动参数"
  }
}
```

Add to `en-US.json`:
```json
"settings": {
  "tabs": {
    "startup": "Startup",
    "properties": "Server Properties",
    "tasks": "Scheduled Tasks",
    "theme": "Theme"
  },
  "startup": {
    "title": "Startup Parameters",
    "selectServer": "Select Server",
    "memoryAllocation": "Memory Allocation",
    "minMemory": "Minimum Memory",
    "maxMemory": "Maximum Memory",
    "jvmFlags": "JVM Flags",
    "jvmPlaceholder": "Enter JVM flag (e.g., -XX:+UseG1GC)",
    "addFlag": "Add Flag",
    "saving": "Saving...",
    "save": "Save Startup Parameters"
  }
}
```

- [ ] **Step 2: Register `settings` namespace in config.ts**

Add `settings: zhCN.settings` and `settings: enUS.settings` in the i18next resources object.

- [ ] **Step 3: Read all settings files and migrate**

Read each file in `web-ui/src/components/settings/` and `web-ui/src/pages/Settings.tsx`.

**Settings.tsx** (tab labels):
```typescript
const { t } = useTranslation('settings')
// Tab labels
t('tabs.startup'), t('tabs.properties'), t('tabs.tasks'), t('tabs.theme')
```

**StartupParams.tsx** (form labels):
```typescript
const { t } = useTranslation('settings')
// Field labels
<label>{t('startup.selectServer')}</label>
<label>{t('startup.memoryAllocation')}</label>
<label>{t('startup.minMemory')}</label>
<label>{t('startup.maxMemory')}</label>
<label>{t('startup.jvmFlags')}</label>
<input placeholder={t('startup.jvmPlaceholder')} />
<Button>{t('startup.addFlag')}</Button>
<Button>{saving ? t('startup.saving') : t('startup.save')}</Button>
```

**ServerProperties.tsx** and **ScheduledTasks.tsx**: Read each file, identify all UI strings, add them to the `settings` namespace JSON, and replace with `t()` calls.

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/i18n/locales/zh-CN.json \
        web-ui/src/i18n/locales/en-US.json \
        web-ui/src/i18n/config.ts \
        web-ui/src/pages/Settings.tsx \
        web-ui/src/components/settings/
git commit -m "feat(i18n): migrate settings namespace strings"
```

---

### Task 15: Final Verification

- [ ] **Step 1: Check no hardcoded zh-CN remains**

```bash
grep -rn "zh-CN\|toLocaleString\|toLocaleDateString\|toLocaleTimeString" web-ui/src/ | grep -v "i18n\|currentLocale\|node_modules"
```

Expected: no output (all locale calls now go through `currentLocale()`).

- [ ] **Step 2: Check no untranslated Chinese characters remain in component files**

```bash
grep -rPn "[^\x00-\x7F]" web-ui/src/pages/ web-ui/src/components/ | grep -v "node_modules"
```

Expected: no output (all Chinese strings moved to JSON files).

- [ ] **Step 3: Full smoke test**

1. Set browser language to English → open app → all UI in English
2. Switch to 中文 via TopNav → all UI in Chinese
3. Refresh → language persists
4. Navigate all pages: Dashboard, Console, Players, Backups, Mods/Plugins, FileManager, Settings, ServerLobby, ServerCreate, NotFound

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(i18n): complete i18n migration — Chinese/English switching fully operational"
```

---

## Summary: Files Changed

| File | Change |
|------|--------|
| `web-ui/package.json` | Add 3 i18n packages |
| `web-ui/src/main.tsx` | Import i18n config |
| `web-ui/src/i18n/config.ts` | **New** — i18next initialization (updated to register all 8 namespaces) |
| `web-ui/src/i18n/locale.ts` | **New** — currentLocale() helper |
| `web-ui/src/i18n/locales/zh-CN.json` | **New** — Chinese translations (8 namespaces) |
| `web-ui/src/i18n/locales/en-US.json` | **New** — English translations (8 namespaces) |
| `web-ui/src/components/layout/TopNav.tsx` | Add language dropdown |
| `web-ui/src/components/layout/Sidebar.tsx` | Migrate nav labels |
| `web-ui/src/components/layout/MobileNav.tsx` | Migrate nav labels |
| `web-ui/src/pages/NotFound.tsx` | Migrate page strings |
| `web-ui/src/pages/Console.tsx` | Migrate connection status strings |
| `web-ui/src/components/console/TerminalLogDisplay.tsx` | Migrate "New logs below" |
| `web-ui/src/pages/Dashboard.tsx` | Migrate + fix toLocaleTimeString |
| `web-ui/src/components/dashboard/QuickActions.tsx` | Migrate control strings |
| `web-ui/src/hooks/useServerActions.ts` | Migrate server action toast messages |
| `web-ui/src/components/dashboard/ResourceChart.tsx` | Migrate time ranges + labels + fix toLocaleTimeString |
| `web-ui/src/components/dashboard/CpuStatusCard.tsx` | Migrate metric title |
| `web-ui/src/components/dashboard/MemoryStatusCard.tsx` | Migrate metric title |
| `web-ui/src/components/dashboard/PlayersStatusCard.tsx` | Migrate metric title |
| `web-ui/src/components/dashboard/DiskStatusCard.tsx` | Migrate metric title + disk text |
| `web-ui/src/components/dashboard/StatusCard.tsx` | Migrate "使用率" |
| `web-ui/src/pages/Players.tsx` | Migrate all player strings |
| `web-ui/src/components/players/PlayerCard.tsx` | Migrate action buttons |
| `web-ui/src/components/players/BanReasonModal.tsx` | Migrate ban modal |
| `web-ui/src/components/players/ConfirmModal.tsx` | Migrate confirm/cancel |
| `web-ui/src/components/players/TeleportModal.tsx` | Migrate teleport modal |
| `web-ui/src/components/players/WhitelistManager.tsx` | Migrate whitelist strings |
| `web-ui/src/components/players/BanListManager.tsx` | Migrate banlist + fix toLocaleString |
| `web-ui/src/pages/ServerCreate.tsx` | Migrate creation wizard |
| `web-ui/src/pages/Mods.tsx` | Migrate mod management |
| `web-ui/src/pages/Plugins.tsx` | Migrate plugin management |
| `web-ui/src/pages/Backups.tsx` | Migrate backups + fix formatDate |
| `web-ui/src/components/file-browser/FileBrowser.tsx` | Migrate file strings + fix toLocaleDateString |
| `web-ui/src/pages/ServerLobby.tsx` | Migrate lobby strings |
| `web-ui/src/components/server-lobby/` (all files) | Migrate modal strings |
| `web-ui/src/pages/Settings.tsx` | Migrate tab labels |
| `web-ui/src/components/settings/StartupParams.tsx` | Migrate startup params labels |
| `web-ui/src/components/settings/ServerProperties.tsx` | Migrate server properties labels |
| `web-ui/src/components/settings/ScheduledTasks.tsx` | Migrate scheduled tasks labels |
