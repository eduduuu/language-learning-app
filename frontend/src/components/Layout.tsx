import React from 'react';
import {
  BarChart3,
  BookOpen,
  Brain,
  HelpCircle,
  LogOut,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cx } from './ui';

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Library',
    items: [{ id: 'home', label: 'Home', icon: BookOpen }],
  },
  {
    label: 'Practice',
    items: [
      { id: 'vocab', label: 'Vocabulary', icon: Brain },
      { id: 'quiz', label: 'Grammar quiz', icon: HelpCircle },
    ],
  },
  {
    label: 'Insights',
    items: [{ id: 'analytics', label: 'Analytics', icon: BarChart3 }],
  },
  {
    label: 'Account',
    items: [{ id: 'settings', label: 'Settings', icon: SettingsIcon }],
  },
];

const NavButton: React.FC<{
  item: NavItem;
  active: boolean;
  onClick: () => void;
}> = ({ item, active, onClick }) => {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cx(
        'group relative w-full flex items-center gap-3 pl-3 pr-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
        active
          ? 'bg-zinc-800/70 text-zinc-50'
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40',
      )}
    >
      {/* Active indicator */}
      <span
        className={cx(
          'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200',
          active ? 'h-5 bg-amber-400' : 'h-0 bg-transparent',
        )}
      />
      <Icon
        size={16}
        strokeWidth={active ? 2.3 : 1.9}
        className={cx(
          'transition-colors shrink-0',
          active ? 'text-amber-400' : 'text-zinc-500 group-hover:text-zinc-300',
        )}
      />
      <span className="truncate tracking-tight">{item.label}</span>
    </button>
  );
};

export const Layout: React.FC<LayoutProps> = ({
  activeTab,
  setActiveTab,
  children,
}) => {
  const { signOut, user } = useAuth();
  const initial = (user?.email?.[0] ?? 'G').toUpperCase();
  const email = user?.email ?? 'demo@local';
  const displayName = user?.email?.split('@')[0] ?? 'Guest';

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-[248px] shrink-0 border-r border-zinc-800/70 bg-zinc-950/95 backdrop-blur-sm flex flex-col">
        {/* Brand */}
        <div className="px-5 pt-6 pb-6 flex items-center gap-3">
          <div className="relative">
            <div className="grid place-items-center w-9 h-9 rounded-xl bg-amber-400/10 ring-1 ring-amber-400/30 text-amber-400">
              <BookOpen size={17} strokeWidth={2.2} />
            </div>
            <span className="absolute -inset-1 rounded-2xl bg-amber-400/10 blur-md -z-10" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[19px] leading-none text-zinc-50 truncate">
              Context
            </h1>
            <p className="text-[10px] tracking-[0.22em] uppercase text-zinc-500 mt-1">
              Reader
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={activeTab === item.id}
                    onClick={() => setActiveTab(item.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="border-t border-zinc-800/70 p-3">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-zinc-900/70 transition-colors group">
            <div className="grid place-items-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-400/90 to-amber-600/80 text-zinc-950 text-xs font-bold shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-zinc-200 truncate capitalize">
                {displayName}
              </div>
              <div className="text-[10.5px] text-zinc-500 truncate font-mono">
                {email}
              </div>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="p-1.5 rounded-md text-zinc-600 hover:text-rose-300 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main viewport */}
      <main className="relative flex-1 overflow-y-auto">
        {/* Ambient background glow */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-0 overflow-hidden"
        >
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-amber-400/[0.035] blur-[120px]" />
          <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-500/[0.03] blur-[120px]" />
        </div>

        <div className="relative z-10 p-8 lg:p-10">
          <div className="max-w-6xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
};