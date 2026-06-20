import type { ReactNode } from 'react';
import './AppLayout.css';

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <div className="app-layout__phone">{children}</div>
    </div>
  );
}
