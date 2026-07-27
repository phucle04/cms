'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Settings } from 'lucide-react';

const pageNames: Record<string, string> = {
  '/': 'Dashboard',
  '/research': 'Research & Strategy',
  '/ideation': 'Concept & Ideation',
  '/scripting': 'Scripting & Production',
  '/optimization': 'Optimization & Marketing',
  '/analytics': 'Analytics',
  '/archive': 'Archive',
  '/settings': 'Settings',
};

export function Header() {
  const pathname = usePathname();
  const pageName = pageNames[pathname] || 'CMS';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 lg:ml-64">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{pageName}</h2>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Settings"
        >
          <Settings size={20} className="text-gray-700 dark:text-gray-300" />
        </Link>
      </div>
    </header>
  );
}
