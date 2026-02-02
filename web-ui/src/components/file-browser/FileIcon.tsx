import {
    FileText,
    FileCode2,
    FileJson,
    FileImage,
    FileArchive,
    Package,
    FileType2,
    Settings,
    Database,
    File,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FileIconProps {
    filename: string;
    className?: string;
}

const EXTENSION_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
    // Config files
    '.properties': { icon: Settings, color: 'text-orange-500' },
    '.yml': { icon: FileCode2, color: 'text-purple-500' },
    '.yaml': { icon: FileCode2, color: 'text-purple-500' },
    '.json': { icon: FileJson, color: 'text-yellow-500' },
    '.xml': { icon: FileCode2, color: 'text-blue-400' },
    '.toml': { icon: FileCode2, color: 'text-orange-400' },
    '.cfg': { icon: Settings, color: 'text-gray-500' },
    '.conf': { icon: Settings, color: 'text-gray-500' },
    '.ini': { icon: Settings, color: 'text-gray-500' },

    // Java / Minecraft
    '.jar': { icon: Package, color: 'text-red-500' },
    '.java': { icon: FileCode2, color: 'text-orange-600' },
    '.class': { icon: FileType2, color: 'text-blue-600' },

    // Scripts
    '.sh': { icon: FileCode2, color: 'text-green-500' },
    '.bat': { icon: FileCode2, color: 'text-blue-500' },
    '.ps1': { icon: FileCode2, color: 'text-blue-400' },

    // Text
    '.txt': { icon: FileText, color: 'text-gray-500' },
    '.md': { icon: FileText, color: 'text-blue-500' },
    '.log': { icon: FileText, color: 'text-gray-400' },

    // Data
    '.dat': { icon: Database, color: 'text-green-600' },
    '.db': { icon: Database, color: 'text-blue-600' },
    '.sqlite': { icon: Database, color: 'text-blue-500' },
    '.nbt': { icon: Database, color: 'text-purple-600' },
    '.mca': { icon: Database, color: 'text-emerald-600' },
    '.mcr': { icon: Database, color: 'text-emerald-500' },

    // Archives
    '.zip': { icon: FileArchive, color: 'text-yellow-600' },
    '.tar': { icon: FileArchive, color: 'text-yellow-700' },
    '.gz': { icon: FileArchive, color: 'text-yellow-600' },
    '.rar': { icon: FileArchive, color: 'text-purple-600' },
    '.7z': { icon: FileArchive, color: 'text-green-600' },

    // Images
    '.png': { icon: FileImage, color: 'text-pink-500' },
    '.jpg': { icon: FileImage, color: 'text-pink-500' },
    '.jpeg': { icon: FileImage, color: 'text-pink-500' },
    '.gif': { icon: FileImage, color: 'text-pink-400' },
    '.ico': { icon: FileImage, color: 'text-blue-500' },
};

export function FileIcon({ filename, className = 'w-4 h-4' }: FileIconProps) {
    const ext = filename.includes('.') ? '.' + filename.split('.').pop()?.toLowerCase() : '';
    const iconInfo = EXTENSION_ICONS[ext];

    if (iconInfo) {
        const Icon = iconInfo.icon;
        return <Icon className={`${className} ${iconInfo.color} flex-shrink-0`} />;
    }

    return <File className={`${className} text-gray-500 flex-shrink-0`} />;
}
