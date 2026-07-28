'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Lightbulb,
  Menu,
  Package,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

const navigation = [
  {
    name: 'Tổng quan',
    href: '/',
    icon: Home,
  },
  {
    name: 'Sản phẩm',
    href: '/products',
    icon: Package,
  },
  {
    name: 'Nghiên cứu TikTok',
    href: '/research',
    icon: Search,
  },
  {
    name: 'Ý tưởng',
    href: '/ideation',
    icon: Lightbulb,
  },
  {
    name: 'Kịch bản',
    href: '/scripts',
    icon: FileText,
  },
  {
    name: 'Cài đặt',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed } = useAppContext();

  return (
    <>
      {/* Nút mở menu trên di động */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-md lg:hidden hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Đóng/mở menu"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen bg-card border-r border-border overflow-y-auto transition-all duration-200 z-40',
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64',
          'w-64',
          !sidebarOpen && '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center gap-2 p-6 bg-card border-b border-border">
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">Thảo Nguyên</h1>
              <p className="text-xs text-muted-foreground truncate">Hệ thống nội dung</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1.5 rounded-md hover:bg-accent text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            title={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? item.name : undefined}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  sidebarCollapsed && 'lg:justify-center lg:px-2',
                  isActive
                    ? 'bg-primary/10 text-link'
                    : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon size={18} className="shrink-0" />
                <span className={cn(sidebarCollapsed && 'lg:hidden')}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-muted/40">
          {!sidebarCollapsed && <p className="text-xs text-muted-foreground">v1.0 Beta</p>}
        </div>
      </aside>

      {/* Overlay cho di động */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
