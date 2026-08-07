import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kiến thức',
};

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
