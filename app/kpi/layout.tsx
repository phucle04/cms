import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KPI Video',
};

export default function VideoKpiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
