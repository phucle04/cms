'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

const pageNames: Record<string, string> = {
  '/': 'Tổng quan',
  '/products': 'Sản phẩm',
  '/research': 'Nghiên cứu TikTok',
  '/ideation': 'Ý tưởng',
  '/scripts': 'Kịch bản',
  '/settings': 'Cài đặt',
};

// Chỉ trả về tên trang cho route CON (vd /scripts/abc123) - các trang danh
// sách cấp 1 (vd /scripts) đã có PageHeader riêng hiển thị tiêu đề to hơn,
// hiện thêm ở đây sẽ bị trùng lặp.
function resolveSubPageName(pathname: string): string | null {
  if (pageNames[pathname]) return null;
  const prefix = Object.keys(pageNames)
    .filter((p) => p !== '/' && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? pageNames[prefix] : null;
}

export function Header() {
  const pathname = usePathname();
  const pageName = resolveSubPageName(pathname);
  const { sidebarCollapsed } = useAppContext();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-card border-b border-border transition-[margin] duration-200',
        sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
      )}
    >
      <div className="flex items-center gap-4">
        {pageName && <h2 className="text-lg font-semibold text-muted-foreground">{pageName}</h2>}
      </div>

      <div className="flex items-center gap-4">
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
