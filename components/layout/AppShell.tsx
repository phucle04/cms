'use client';

import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppContext } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useAppContext();

  return (
    <>
      <Sidebar />
      <Header />
      <main
        className={cn(
          'pt-16 min-h-screen transition-[margin] duration-200',
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        )}
      >
        <div className="max-w-[1280px] mx-auto">{children}</div>
      </main>
    </>
  );
}
