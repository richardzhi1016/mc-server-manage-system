import React, { useState, useEffect, useRef } from 'react';
import { Plus, Server as ServerIcon, MoreVertical, X, Box, Layers, Code, ScrollText, ArrowLeft, ChevronRight, Check, Moon, Sun, ChevronDown, Search } from 'lucide-react';

// --- Types ---
type ServerType = 'Vanilla' | 'Forge' | 'Fabric' | 'Paper';
type CategoryType = 'Official' | 'Plugins' | 'Mods';

interface Server {
  id: string;
  name: string;
  version: string;
  type: ServerType;
  status: 'online' | 'offline';
  port: number;
}

// --- Mock Data ---
const initialServers: Server[] = [
  { id: '1', name: 'Survival World', version: '1.20.4', type: 'Vanilla', status: 'online', port: 25565 },
  { id: '2', name: 'Tech Modpack', version: '1.19.2', type: 'Forge', status: 'offline', port: 25566 },
  { id: '3', name: 'Friends SMP', version: '1.20.1', type: 'Fabric', status: 'online', port: 25567 },
  { id: '4', name: 'Creative Plot', version: '1.20.4', type: 'Paper', status: 'offline', port: 25568 },
];

// --- Mock Data ---

const StatusBadge = ({ status }: { status: Server['status'] }) => {
  const styles = {
    online: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    offline: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
  };

  const dotStyles = {
    online: 'bg-green-500',
    offline: 'bg-slate-400',
  };

  return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${styles[status]}`}>
        <span className={`w-2 h-2 rounded-full ${dotStyles[status]}`} />
        <span className="uppercase tracking-wide">{status}</span>
      </div>
  );
};

const TypeBadge = ({ type }: { type: Server['type'] }) => {
  const styles = {
    Vanilla: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-900/40 dark:text-stone-400 dark:border-stone-700',
    Forge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-500 dark:border-amber-800',
    Fabric: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
    Paper: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
  };

  return (
      <span className={`text-xs font-medium px-2 py-1 rounded border transition-colors ${styles[type]}`}>
      {type}
    </span>
  );
};

const ServerCard = ({ server }: { server: Server }) => {
  return (
      <div className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-52">
        <div className={`h-2 w-full transition-colors duration-500 ${server.status === 'online' ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />

        <div className="p-5 flex flex-col flex-1">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              <ServerIcon size={20} />
            </div>
            <button className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <MoreVertical size={18} />
            </button>
          </div>

          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1 truncate">{server.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mb-4">:{server.port}</p>

          <div className="mt-auto flex items-center justify-between">
            <StatusBadge status={server.status} />

            <div className="flex items-center gap-2">
              <TypeBadge type={server.type} />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-200 dark:border-slate-600">
              {server.version}
            </span>
            </div>
          </div>
        </div>
      </div>
  );
};

const AddServerCard = ({ onClick }: { onClick: () => void }) => {
  return (
      <button
          onClick={onClick}
          className="group h-52 w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200"
      >
        <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:border-blue-200 dark:group-hover:border-blue-700 group-hover:shadow-md flex items-center justify-center transition-all duration-200">
          <Plus size={28} />
        </div>
        <span className="font-semibold">Create New Server</span>
      </button>
  );
};

// --- Custom Dropdown Component ---
interface CustomSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}

const CustomSelect = ({ options, value, onChange, label }: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
      <div className="space-y-2 relative" ref={dropdownRef}>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>

        {/* Trigger Button */}
        <button
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-slate-900 flex items-center justify-between outline-none transition-all text-slate-800 dark:text-slate-100 font-medium ${
                isOpen
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
            }`}
        >
          <span>{value}</span>
          <ChevronDown
              size={16}
              className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
            <div className="
          absolute z-20 w-full mt-1
          bg-white dark:bg-slate-900
          border border-slate-200 dark:border-slate-600
          rounded-xl shadow-xl
          animate-in fade-in zoom-in-95 duration-100
          max-h-40 overflow-y-auto p-1
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-slate-200
          [&::-webkit-scrollbar-thumb]:dark:bg-slate-700
          [&::-webkit-scrollbar-thumb]:rounded-full
        ">
              {options.map((option) => (
                  <button
                      key={option}
                      onClick={() => {
                        onChange(option);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm font-medium transition-colors flex items-center justify-between rounded-lg mb-0.5 last:mb-0
                ${option === value
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                  >
                    {option}
                    {option === value && <Check size={14} />}
                  </button>
              ))}
            </div>
        )}
      </div>
  );
};

// --- Create Server Modal ---
interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateServer: (data: { type: ServerType; name: string; version: string }) => void;
  versions: string[];
  latestRelease: string;
}

const CreateModal = ({ isOpen, onClose, onCreateServer, versions, latestRelease }: CreateModalProps) => {
  const [step, setStep] = useState<'category' | 'type' | 'details'>('category');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | null>(null);
  const [selectedType, setSelectedType] = useState<ServerType | null>(null);

  // Step 3 Form State
  const [serverName, setServerName] = useState('');
  const [selectedVersion, setSelectedVersion] = useState(latestRelease);
  const [eulaAgreed, setEulaAgreed] = useState(false);

  // Update default version when latestRelease changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('category');
      setSelectedCategory(null);
      setSelectedType(null);
      setServerName('');
      setEulaAgreed(false);
      setSelectedVersion(latestRelease);
    }
  }, [isOpen, latestRelease]);

  if (!isOpen) return null;

  // Data
  const categories = [
    {
      id: 'Official' as CategoryType,
      label: 'Official',
      icon: <Box size={32} />,
      desc: 'Standard vanilla experience',
      color: 'hover:bg-stone-50 dark:hover:bg-stone-900/30 hover:border-stone-300 dark:hover:border-stone-700 text-stone-700 dark:text-stone-300'
    },
    {
      id: 'Plugins' as CategoryType,
      label: 'Plugins',
      icon: <ScrollText size={32} />,
      desc: 'Optimized for plugins (Spigot/Paper)',
      color: 'hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:border-sky-300 dark:hover:border-sky-700 text-sky-700 dark:text-sky-300'
    },
    {
      id: 'Mods' as CategoryType,
      label: 'Mods',
      icon: <Layers size={32} />,
      desc: 'For modpacks (Forge/Fabric)',
      color: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 text-indigo-700 dark:text-indigo-300'
    },
  ];

  const typesByCategory: Record<CategoryType, { id: ServerType; icon: React.ReactNode; desc: string; color: string }[]> = {
    'Official': [
      { id: 'Vanilla', icon: <Box size={24} />, desc: 'The original Minecraft server software from Mojang', color: 'hover:bg-stone-50 dark:hover:bg-stone-900/30 hover:border-stone-300 dark:hover:border-stone-700 text-stone-700 dark:text-stone-300' },
    ],
    'Plugins': [
      { id: 'Paper', icon: <ScrollText size={24} />, desc: 'High performance Spigot fork, supports plugins', color: 'hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:border-sky-300 dark:hover:border-sky-700 text-sky-700 dark:text-sky-300' },
    ],
    'Mods': [
      { id: 'Forge', icon: <Layers size={24} />, desc: 'The most popular mod loader for heavy modpacks', color: 'hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:border-amber-300 dark:hover:border-amber-700 text-amber-700 dark:text-amber-300' },
      { id: 'Fabric', icon: <Code size={24} />, desc: 'Lightweight, modular, and fast mod loader', color: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 text-indigo-700 dark:text-indigo-300' },
    ]
  };

  const handleCategorySelect = (category: CategoryType) => {
    setSelectedCategory(category);
    setStep('type');
  };

  const handleTypeSelect = (type: ServerType) => {
    setSelectedType(type);
    setServerName(`My ${type} Server`);
    setStep('details');
  };

  const handleBack = () => {
    if (step === 'type') {
      setStep('category');
      setSelectedCategory(null);
    } else if (step === 'details') {
      setStep('type');
      setSelectedType(null);
    }
  };

  const handleFinalCreate = () => {
    if (selectedType && serverName && eulaAgreed) {
      onCreateServer({
        type: selectedType,
        name: serverName,
        version: selectedVersion
      });
    }
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

        {/* Change Log:
         - Added `h-[550px]` to enforce a consistent height across all steps.
         - Kept `max-h-[90vh]` for responsiveness on small screens.
      */}
        <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-[500px] max-h-[90vh] flex flex-col border border-transparent dark:border-slate-700">

          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 z-10 transition-colors">
            <div className="flex items-center gap-3">
              {step !== 'category' && (
                  <button onClick={handleBack} className="p-1 -ml-2 rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <ArrowLeft size={20} />
                  </button>
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 transition-colors">
                  {step === 'category' ? 'Select Category' :
                      step === 'type' ? `Select ${selectedCategory} Software` :
                          'Configure Server'}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  Step {step === 'category' ? '1' : step === 'type' ? '2' : '3'} of 3
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Change Log:
           - Changed `min-h-[350px]` to `flex-1` so it fills the fixed parent height.
           - Removed the transition on height since the parent height is now fixed.
        */}
          <div className={`p-6 flex-1 ${step === 'details' ? 'overflow-visible' : 'overflow-y-auto'}`}>

            {/* STEP 1: Categories */}
            {step === 'category' && (
                <div className="grid grid-cols-1 gap-6">
                  {categories.map((cat) => (
                      <button
                          key={cat.id}
                          onClick={() => handleCategorySelect(cat.id)}
                          className={`flex items-center gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-700 text-left transition-all duration-200 group ${cat.color} hover:shadow-md dark:hover:shadow-none dark:hover:bg-opacity-10`}
                      >
                        <div className="p-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 shadow-sm group-hover:scale-110 transition-transform text-slate-600 dark:text-slate-300">
                          {cat.icon}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-lg transition-colors">{cat.label}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">{cat.desc}</div>
                        </div>
                        <ChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
                      </button>
                  ))}
                </div>
            )}

            {/* STEP 2: Server Types */}
            {step === 'type' && selectedCategory && (
                <div className="grid grid-cols-1 gap-3 animate-in slide-in-from-right-4 duration-200">
                  {typesByCategory[selectedCategory].map((type) => (
                      <button
                          key={type.id}
                          onClick={() => handleTypeSelect(type.id)}
                          className={`flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left transition-all duration-200 group ${type.color} hover:shadow-md dark:hover:shadow-none dark:hover:bg-opacity-10`}
                      >
                        <div className="p-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600 shadow-sm group-hover:scale-110 transition-transform text-slate-600 dark:text-slate-300">
                          {type.icon}
                        </div>
                        <div>
                          <div className="font-bold text-lg transition-colors">{type.id}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">{type.desc}</div>
                        </div>
                      </button>
                  ))}
                </div>
            )}

            {/* STEP 3: Details Form */}
            {step === 'details' && selectedType && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">

                  <div className="space-y-2">
                    <label htmlFor="serverName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Server Name</label>
                    <input
                        type="text"
                        id="serverName"
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 outline-none transition-all text-slate-800 dark:text-slate-100 font-medium placeholder-slate-400 dark:placeholder-slate-500"
                        placeholder="e.g. My Survival World"
                    />
                  </div>

                  <CustomSelect
                      label="Minecraft Version"
                      options={versions}
                      value={selectedVersion}
                      onChange={setSelectedVersion}
                  />

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center mt-0.5">
                        <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={eulaAgreed}
                            onChange={(e) => setEulaAgreed(e.target.checked)}
                        />
                        <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-500 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all"></div>
                        <Check size={14} className="absolute left-0.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 leading-snug select-none transition-colors">
                        I agree to the <span className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Minecraft EULA</span>.
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">You must agree to the EULA to run a server.</p>
                      </div>
                    </label>
                  </div>

                  <button
                      onClick={handleFinalCreate}
                      disabled={!serverName || !eulaAgreed}
                      className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none disabled:shadow-none transition-all duration-200 flex items-center justify-center gap-2 mt-4"
                  >
                    <Plus size={20} strokeWidth={3} />
                    Create Server
                  </button>

                </div>
            )}
          </div>
        </div>
      </div>
  );
};

export default function App() {
  const [servers, setServers] = useState<Server[]>(initialServers);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [latestRelease, setLatestRelease] = useState('1.20.4');

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const response = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest.json');
        const data = await response.json();
        const versions = data.versions.map((v: { id: string }) => v.id);
        setMcVersions(versions);
        if (data.latest?.release) {
          setLatestRelease(data.latest.release);
        }
      } catch (error) {
        console.error('Failed to fetch Minecraft versions:', error);
      }
    };
    fetchVersions();
  }, []);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleOpenCreateModal = () => {
    setCreateModalOpen(true);
  };

  const handleCreateServer = (data: { type: ServerType; name: string; version: string }) => {
    const newId = (Math.max(...servers.map(s => parseInt(s.id))) + 1).toString();
    const newServer: Server = {
      id: newId,
      name: data.name,
      version: data.version,
      type: data.type,
      status: 'offline',
      port: 25500 + parseInt(newId)
    };

    setServers([...servers, newServer]);
    setCreateModalOpen(false);
  };

  return (
      <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-6 md:p-10 relative transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">Dashboard</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">Manage your Minecraft server instances</p>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm"
                  title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                System Normal
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {servers.map((server) => (
                <ServerCard key={server.id} server={server} />
            ))}
            <AddServerCard onClick={handleOpenCreateModal} />
          </div>
        </div>
        <CreateModal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} onCreateServer={handleCreateServer} versions={mcVersions} latestRelease={latestRelease} />
      </div>
  );
}