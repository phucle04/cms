'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  BookOpen,
  Brain,
  Database,
  Film,
  Home,
  Menu,
  Search,
  Settings,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: Home,
  },
  {
    name: 'Research & Strategy',
    href: '/research',
    icon: Search,
  },
  {
    name: 'Concept & Ideation',
    href: '/ideation',
    icon: Brain,
  },
  {
    name: 'Scripting & Production',
    href: '/scripting',
    icon: Film,
  },
  {
    name: 'Optimization & Marketing',
    href: '/optimization',
    icon: TrendingUp,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    name: 'Archive',
    href: '/archive',
    icon: Database,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useAppContext();

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-md lg:hidden hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 overflow-y-auto transition-all duration-300 z-40',
          !sidebarOpen && '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center gap-2 p-6 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">CMS</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Content System</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">v1.0 Beta</p>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
