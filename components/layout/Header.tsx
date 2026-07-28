'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Settings } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { cn } from '@/lib/utils';

const pageNames: Record<string, string> = {
  '/': 'Tổng quan',
  '/products': 'Sản phẩm',
  '/research': 'Nghiên cứu TikTok',
  '/ideation': 'Ý tưởng',
  '/scripts': 'Kịch bản',
  '/settings': 'Cài đặt',
};

// Chỉ trả về breadcrumb cho route CON (vd /scripts/abc123) - các trang danh
// sách cấp 1 (vd /scripts) đã có PageHeader riêng hiển thị tiêu đề to hơn,
// hiện thêm ở đây sẽ bị trùng lặp.
function resolveBreadcrumb(pathname: string): { label: string; href: string } | null {
  if (pageNames[pathname]) return null;
  const prefix = Object.keys(pageNames)
    .filter((p) => p !== '/' && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? { label: pageNames[prefix], href: prefix } : null;
}

export function Header() {
  const pathname = usePathname();
  const breadcrumb = resolveBreadcrumb(pathname);
  const { sidebarCollapsed } = useAppContext();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-card border-b border-border transition-[margin] duration-200',
        sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
      )}
    >
      <div className="flex items-center gap-4">
        {breadcrumb && (
          <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-sm">
            <Link href={breadcrumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {breadcrumb.label}
            </Link>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="text-foreground font-medium">Chi tiết</span>
          </nav>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        <Link
          href="/settings"
          className="p-2 rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Cài đặt"
        >
          <Settings size={20} className="text-foreground/80" />
        </Link>
      </div>
    </header>
  );
}
