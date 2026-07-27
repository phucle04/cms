import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kịch bản',
};

export default function ScriptsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
