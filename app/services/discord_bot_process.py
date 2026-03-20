"""Discord Bot subprocess entry point.

Env vars required:
  DISCORD_BOT_TOKEN    -- Bot token
  DISCORD_CHANNEL_ID   -- Default channel for alerts
  INTERNAL_SECRET      -- Shared secret for Flask internal API
  FLASK_INTERNAL_URL   -- e.g. http://127.0.0.1:5000
  BOT_EVENT_PORT       -- Port to listen for Flask -> Bot events (default 5050)
"""
import asyncio
import logging
import os

import aiohttp
import discord
from aiohttp import web
from discord import app_commands

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN = os.environ["DISCORD_BOT_TOKEN"]
CHANNEL_ID = int(os.environ["DISCORD_CHANNEL_ID"])
INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "")
FLASK_URL = os.environ.get("FLASK_INTERNAL_URL", "http://127.0.0.1:5000")
EVENT_PORT = int(os.environ.get("BOT_EVENT_PORT", "5050"))

_INTERNAL_HEADERS = {"X-Internal-Secret": INTERNAL_SECRET}

# -- Discord client ----------------------------------------------------------

intents = discord.Intents.default()
client = discord.Client(intents=intents)
tree = app_commands.CommandTree(client)


async def _fetch_running_servers() -> list[str]:
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{FLASK_URL}/api/internal/servers",
            headers=_INTERNAL_HEADERS,
            timeout=aiohttp.ClientTimeout(total=5),
        ) as resp:
            data = await resp.json()
            return data.get("servers", [])


async def _fetch_server_status(server_name: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{FLASK_URL}/api/internal/server-status/{server_name}",
            headers=_INTERNAL_HEADERS,
            timeout=aiohttp.ClientTimeout(total=5),
        ) as resp:
            return await resp.json()


async def _fetch_online_players(server_name: str) -> list[str]:
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{FLASK_URL}/api/internal/online-players/{server_name}",
            headers=_INTERNAL_HEADERS,
            timeout=aiohttp.ClientTimeout(total=5),
        ) as resp:
            data = await resp.json()
            return data.get("players", [])


async def _send_console_command(server_name: str, command: str) -> None:
    async with aiohttp.ClientSession() as session:
        await session.post(
            f"{FLASK_URL}/api/internal/console-command",
            json={"server_name": server_name, "command": command},
            headers=_INTERNAL_HEADERS,
            timeout=aiohttp.ClientTimeout(total=5),
        )


# -- Slash commands ----------------------------------------------------------

class ServerSelectView(discord.ui.View):
    def __init__(self, servers: list[str], callback_fn):
        super().__init__(timeout=60)
        select = discord.ui.Select(
            placeholder="选择服务器",
            options=[discord.SelectOption(label=s, value=s) for s in servers],
        )
        select.callback = callback_fn
        self.add_item(select)


@tree.command(name="status", description="查看服务器状态")
async def cmd_status(interaction: discord.Interaction):
    servers = await _fetch_running_servers()
    if not servers:
        await interaction.response.send_message("当前没有运行中的服务器。", ephemeral=True)
        return

    async def on_select(inter: discord.Interaction):
        name = inter.data["values"][0]
        status = await _fetch_server_status(name)
        embed = discord.Embed(title=f"📊 {name} 状态", color=0x00CC44)
        embed.add_field(name="健康分", value=str(status.get("health_score", "—")))
        embed.add_field(name="TPS", value=str(status.get("tps", "—")))
        embed.add_field(name="在线玩家", value=str(status.get("players_online", "—")))
        await inter.response.send_message(embed=embed, ephemeral=True)

    await interaction.response.send_message(
        "请选择服务器：", view=ServerSelectView(servers, on_select), ephemeral=True
    )


@tree.command(name="players", description="查看在线玩家")
async def cmd_players(interaction: discord.Interaction):
    servers = await _fetch_running_servers()
    if not servers:
        await interaction.response.send_message("当前没有运行中的服务器。", ephemeral=True)
        return

    async def on_select(inter: discord.Interaction):
        name = inter.data["values"][0]
        players = await _fetch_online_players(name)
        text = "\n".join(players) if players else "（无在线玩家）"
        await inter.response.send_message(f"**{name}** 在线玩家：\n{text}", ephemeral=True)

    await interaction.response.send_message(
        "请选择服务器：", view=ServerSelectView(servers, on_select), ephemeral=True
    )


@tree.command(name="say", description="向服务器发送广播消息")
@app_commands.describe(message="广播消息内容")
@app_commands.default_permissions(administrator=True)
async def cmd_say(interaction: discord.Interaction, message: str):
    servers = await _fetch_running_servers()
    if not servers:
        await interaction.response.send_message("当前没有运行中的服务器。", ephemeral=True)
        return

    async def on_select(inter: discord.Interaction):
        name = inter.data["values"][0]
        await _send_console_command(name, f"say {message}")
        await inter.response.send_message(f"已向 **{name}** 发送广播：{message}", ephemeral=True)

    await interaction.response.send_message(
        "请选择目标服务器：", view=ServerSelectView(servers, on_select), ephemeral=True
    )


@tree.command(name="restart", description="重启服务器")
@app_commands.default_permissions(administrator=True)
async def cmd_restart(interaction: discord.Interaction):
    servers = await _fetch_running_servers()
    if not servers:
        await interaction.response.send_message("当前没有运行中的服务器。", ephemeral=True)
        return

    async def on_select(inter: discord.Interaction):
        name = inter.data["values"][0]
        async with aiohttp.ClientSession() as session:
            await session.post(
                f"{FLASK_URL}/api/servers/{name}/restart",
                headers=_INTERNAL_HEADERS,
                timeout=aiohttp.ClientTimeout(total=10),
            )
        await inter.response.send_message(f"已发送重启指令给 **{name}**。", ephemeral=True)

    await interaction.response.send_message(
        "请选择要重启的服务器：", view=ServerSelectView(servers, on_select), ephemeral=True
    )


# -- Event HTTP server (Flask -> Bot push) -----------------------------------

async def handle_event(request: web.Request) -> web.Response:
    if request.headers.get("X-Internal-Secret") != INTERNAL_SECRET:
        return web.Response(status=401)
    try:
        data = await request.json()
    except Exception:
        return web.Response(status=400)

    event_type = data.get("type", "")
    server_name = data.get("server_name", "")
    title = data.get("title", event_type)
    message = data.get("message", "")

    color_map = {
        "server_crashed": 0xFF0000,
        "health_critical": 0xFF0000,
        "player_joined": 0x00CC44,
        "health_recovered": 0x00CC44,
        "auto_restart_pending": 0xFFAA00,
        "auto_restart_executed": 0x0099FF,
        "player_left": 0x0099FF,
    }
    color = color_map.get(event_type, 0xAAAAAA)

    channel = client.get_channel(CHANNEL_ID)
    if channel:
        embed = discord.Embed(title=title, description=message, color=color)
        embed.set_footer(text=f"mc-server-manage · {server_name}")
        asyncio.create_task(channel.send(embed=embed))

    return web.Response(status=204)


async def start_event_server():
    app_server = web.Application()
    app_server.router.add_post("/event", handle_event)
    runner = web.AppRunner(app_server)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", EVENT_PORT)
    await site.start()
    logger.info("Bot event server listening on 127.0.0.1:%d", EVENT_PORT)


# -- Bot lifecycle -----------------------------------------------------------

@client.event
async def on_ready():
    await tree.sync()
    await start_event_server()
    logger.info("Discord bot ready: %s", client.user)


client.run(TOKEN)
