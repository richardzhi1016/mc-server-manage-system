# Minecraft Fabric Server File Structure

This document explains the file structure of a Minecraft Fabric server (version 1.21.10 with Fabric Loader 0.18.4) at different stages of setup.

## Before EULA Acceptance

After downloading and running the Fabric server JAR for the first time, the server will stop and require EULA acceptance.

### File Structure Before EULA Acceptance

```
📁 Server Root Directory
├── 📄 fabric-server-mc.1.21.10-loader.0.18.4-launcher.1.1.1.jar
├── 📄 eula.txt (generated after first run)
├── 📄 server.properties (generated after first run)
├── 📁 .fabric/
│   ├── 📁 processedMods/
│   │   └── 📄 mixinextras-0.5.0-1f6627383f457848.jar
│   ├── 📁 remappedJars/
│   │   └── 📁 minecraft-1.21.10-0.18.4/
│   │       └── 📄 server-intermediary.jar
│   └── 📁 server/
│       ├── 📄 1.21.10-server.jar
│       └── 📄 fabric-loader-server-0.18.4-minecraft-1.21.10.jar
├── 📁 libraries/ (contains ~50+ JAR dependencies)
├── 📁 logs/
│   └── 📄 latest.log
├── 📁 mods/ (empty)
└── 📁 versions/
    └── 📁 1.21.10/
        └── 📄 server-1.21.10.jar
```

### Files Created During First Run (Before EULA Acceptance)

#### `eula.txt`
- **Purpose**: End User License Agreement file
- **Details**: Generated during the first server run attempt. Contains the Minecraft EULA that must be manually accepted by changing `eula=false` to `eula=true`.

#### `server.properties`
- **Purpose**: Server configuration file
- **Details**: Generated with default server settings. Contains all configurable options like game rules, difficulty, max players, server port, etc.

### Pre-existing Files and Directories

#### `fabric-server-mc.1.21.10-loader.0.18.4-launcher.1.1.1.jar`
- **Purpose**: The main Fabric server launcher JAR file
- **Details**: This is the executable file used to start the Minecraft server with Fabric modding capabilities. The filename indicates:
  - Minecraft version: 1.21.10
  - Fabric Loader version: 0.18.4
  - Launcher version: 1.1.1

#### `.fabric/`
- **Purpose**: Fabric-specific server files and configurations
- **Contents**:
  - `processedMods/`: Contains processed mod files (e.g., MixinExtras for enhanced modding capabilities)
  - `remappedJars/`: Contains remapped Minecraft JAR files for mod compatibility
  - `server/`: Core server files

#### `libraries/`
- **Purpose**: Java libraries and dependencies required for the server
- **Details**: Contains all JAR dependencies organized by package structure including Minecraft-related, Fabric-specific, utilities, logging, performance, and system integration libraries.

#### `logs/`
- **Purpose**: Server log files
- **Contents**: Contains `latest.log` with server output, errors, and events from the first run attempt.

#### `mods/`
- **Purpose**: Directory for Fabric mods
- **Details**: Initially empty. This is where `.jar` mod files should be placed.

#### `versions/`
- **Purpose**: Minecraft version files
- **Contents**: Contains the vanilla Minecraft 1.21.10 server JAR file.

## After EULA Acceptance

After accepting the EULA (changing `eula=false` to `eula=true` in `eula.txt`) and running the server again, additional files are generated.

### Complete File Structure After EULA Acceptance

```
📁 Server Root Directory
├── 📄 fabric-server-mc.1.21.10-loader.0.18.4-launcher.1.1.1.jar
├── 📄 eula.txt
├── 📄 server.properties
├── 📄 banned-ips.json
├── 📄 banned-players.json
├── 📄 ops.json
├── 📄 whitelist.json
├── 📄 usercache.json
├── 📁 .fabric/
│   ├── 📁 processedMods/
│   │   └── 📄 mixinextras-0.5.0-1f6627383f457848.jar
│   ├── 📁 remappedJars/
│   │   └── 📁 minecraft-1.21.10-0.18.4/
│   │       └── 📄 server-intermediary.jar
│   └── 📁 server/
│       ├── 📄 1.21.10-server.jar
│       └── 📄 fabric-loader-server-0.18.4-minecraft-1.21.10.jar
├── 📁 libraries/ (contains ~50+ JAR dependencies)
├── 📁 logs/
│   └── 📄 latest.log
├── 📁 mods/ (empty)
├── 📁 versions/
│   └── 📁 1.21.10/
│       └── 📄 server-1.21.10.jar
└── 📁 world/
    ├── 📄 level.dat
    ├── 📄 level.dat_old
    ├── 📄 session.lock
    ├── 📁 data/
    │   ├── 📄 chunks.dat
    │   ├── 📄 raids.dat
    │   ├── 📄 random_sequences.dat
    │   ├── 📄 scoreboard.dat
    │   └── 📄 world_border.dat
    ├── 📁 datapacks/
    ├── 📁 DIM-1/ (Nether)
    │   └── 📁 data/
    │       ├── 📄 chunks.dat
    │       ├── 📄 raids.dat
    │       └── 📄 world_border.dat
    ├── 📁 DIM1/ (End)
    │   └── 📁 data/
    │       ├── 📄 chunks.dat
    │       ├── 📄 raids_end.dat
    │       └── 📄 world_border.dat
    ├── 📁 entities/
    │   └── 📄 r.0.0.mca
    ├── 📁 playerdata/
    ├── 📁 poi/
    │   ├── 📄 r.0.0.mca
    │   └── 📄 r.1.0.mca
    └── 📁 region/
        ├── 📄 r.0.0.mca
        └── 📄 r.1.0.mca
```

### New Files Created After EULA Acceptance

#### Player and Server Management Files

##### `banned-ips.json`
- **Purpose**: IP address ban list
- **Format**: JSON array containing banned IP addresses with ban reasons and timestamps

##### `banned-players.json`
- **Purpose**: Player ban list
- **Format**: JSON array containing banned player UUIDs, usernames, ban reasons, and timestamps

##### `ops.json`
- **Purpose**: Server operator list
- **Format**: JSON array containing player UUIDs, usernames, and operator levels (1-4)

##### `whitelist.json`
- **Purpose**: Server whitelist
- **Format**: JSON array containing allowed player UUIDs and usernames (when whitelist is enabled)

##### `usercache.json`
- **Purpose**: Player cache for faster lookups
- **Format**: JSON array containing recently connected players' UUIDs, usernames, and connection timestamps

#### `world/`
- **Purpose**: The main Minecraft world data directory
- **Contents**:
  - `level.dat`: World metadata (spawn point, game mode, difficulty, etc.)
  - `level.dat_old`: Backup of previous level.dat
  - `session.lock`: Prevents multiple server instances from accessing the same world
  - `data/`: World-wide data files (chunks, raids, scoreboard, etc.)
  - `datapacks/`: Data packs directory (for custom content)
  - `DIM-1/`: Nether dimension data
  - `DIM1/`: End dimension data
  - `entities/`: Entity data files (.mca format)
  - `playerdata/`: Individual player data files
  - `poi/`: Point of Interest data (villages, portals, etc.)
  - `region/`: Main world terrain data in MCA (Minecraft Anvil) format

## Directory Structure Details

### `.fabric/`
- **Purpose**: Fabric-specific server files and configurations
- **Contents**:
  - `processedMods/`: Contains processed mod files (e.g., MixinExtras for enhanced modding capabilities)
  - `remappedJars/`: Contains remapped Minecraft JAR files for mod compatibility
    - `minecraft-1.21.10-0.18.4/server-intermediary.jar`: Remapped server JAR for Fabric mod loading
  - `server/`: Core server files
    - `1.21.10-server.jar`: Vanilla Minecraft server JAR
    - `fabric-loader-server-0.18.4-minecraft-1.21.10.jar`: Fabric loader integrated server JAR

### `libraries/`
- **Purpose**: Java libraries and dependencies required for the server
- **Details**: Contains all JAR dependencies organized by package structure:
  - **Minecraft-related**: Authlib, Brigadier (command system), DataFixerUpper
  - **Fabric-specific**: Fabric Loader, Intermediary mappings, Sponge Mixin
  - **Utilities**: Jackson (JSON processing), Guava, Apache Commons, Netty (networking)
  - **Logging**: Log4j, SLF4J logging frameworks
  - **Performance**: FastUtil, LZ4 compression, JOML math library
  - **System integration**: JNA (Java Native Access), OSHI (system information)

### `logs/`
- **Purpose**: Server log files
- **Contents**:
  - `latest.log`: Current server log file containing all server output, errors, and events

### `mods/`
- **Purpose**: Directory for Fabric mods
- **Details**: Place all `.jar` mod files here. Currently empty as no mods have been installed yet.

### `versions/`
- **Purpose**: Minecraft version files
- **Contents**:
  - `1.21.10/server-1.21.10.jar`: The vanilla Minecraft 1.21.10 server JAR file

## Server Startup Process

### First Run (Before EULA Acceptance)
1. **Launcher Execution**: The `fabric-server-mc.1.21.10-loader.0.18.4-launcher.1.1.1.jar` is executed
2. **Library Loading**: Dependencies from `libraries/` are loaded
3. **Fabric Setup**: Files in `.fabric/` are used to set up the modding environment
4. **EULA Generation**: Server stops and generates `eula.txt` and `server.properties`
5. **Server Shutdown**: Server terminates requiring manual EULA acceptance

### Subsequent Runs (After EULA Acceptance)
1. **Launcher Execution**: Server JAR is executed
2. **EULA Check**: Server verifies `eula.txt` is accepted (`eula=true`)
3. **Library Loading**: Dependencies from `libraries/` are loaded
4. **Fabric Setup**: Files in `.fabric/` are used to set up the modding environment
5. **Minecraft Loading**: Base game from `versions/` is loaded
6. **World Loading**: Existing world data from `world/` directory is loaded
7. **Mod Discovery**: Mods in `mods/` directory are discovered and loaded
8. **Server Initialization**: Server initializes with settings from `server.properties`
9. **Player Management**: Ban lists, operator lists, and whitelists are loaded
10. **Server Start**: Server becomes ready to accept player connections

## Key Components

- **Fabric Loader**: Enables mod loading and compatibility
- **Mixin**: Allows runtime code modification for mods
- **Intermediary Mappings**: Provides stable method/field names for mod development
- **Netty**: Handles network communications
- **Log4j**: Manages server logging
- **MCA Files**: Minecraft Anvil format for storing world data efficiently

## World Data Structure

The `world/` directory contains all persistent game data:

- **level.dat**: Contains world settings, seed, spawn coordinates, and game rules
- **region/r.X.Z.mca**: Terrain data for overworld chunks (16x16 block areas)
- **DIM-1/**: Nether dimension data
- **DIM1/**: End dimension data
- **entities/**: Moving entities (mobs, items, etc.)
- **poi/**: Points of Interest (villages, portals, job sites)
- **playerdata/**: Individual player inventories, positions, and stats

## File Format Details

- **JSON Files**: Human-readable text format for configuration and lists
- **DAT Files**: Minecraft's NBT format for complex data structures
- **MCA Files**: Minecraft Anvil format for chunk data (compressed, efficient)
- **LOG Files**: Plain text server logs with timestamps

## Maintenance Notes

- **Automatic Management**: `libraries/` and `.fabric/` are managed automatically by Fabric
- **Manual Configuration**: Edit `server.properties` for server settings
- **Mod Installation**: Place `.jar` files directly in the `mods/` directory
- **Log Rotation**: Server logs in `logs/` are rotated automatically
- **World Backups**: Always backup the `world/` directory before major changes
- **File Permissions**: Ensure server has read/write access to all directories
- **JSON Editing**: Use proper JSON syntax when manually editing ban/whitelist files