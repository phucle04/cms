// Định dạng số kiểu Việt Nam - gọn cho số lớn: 3.100.000 -> "3,1 triệu"
export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    return `${sign}${trimZero((abs / 1_000_000).toFixed(1))} triệu`;
  }
  if (abs >= 1_000) {
    return `${sign}${trimZero((abs / 1_000).toFixed(1))} nghìn`;
  }
  return value.toLocaleString('vi-VN');
}

function trimZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2).replace('.', ',') : s.replace('.', ',');
}

export function formatCurrency(amount: number, currency: 'USD' | 'VND' = 'USD'): string {
  if (currency === 'VND') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return `$${amount.toFixed(amount < 1 ? 4 : 2)}`;
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('vi-VN');
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay} ngày trước`;
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} tháng trước`;
  const diffYear = Math.round(diffMonth / 12);
  return `${diffYear} năm trước`;
}
