import type { ReactNode } from 'react';
import type { Theme } from '../hooks/useTheme';

type LinkItem = {
  to: string;
  label: string;
};

type AppShellProps = {
  theme: Theme;
  onToggleTheme: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
};

const navItems: LinkItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/search', label: 'Search' },
  { to: '/followups', label: 'Follow-ups' },
  { to: '/settings', label: 'Settings' }
];

const sidebarItems: LinkItem[] = [
  { to: '/kases', label: 'Kases' },
  { to: '/lists', label: 'Lists' },
  { to: '/mindmaps', label: 'Mind Maps' },
  { to: '/notes', label: 'Notes' },
  { to: '/unorganized', label: 'Unorganized' },
  { to: '/admin/users', label: 'Admin Users' }
];

const NavItem = ({ item, currentPath, onNavigate }: { item: LinkItem; currentPath: string; onNavigate: (path: string) => void }) => {
  const active = item.to === '/' ? currentPath === '/' : currentPath.startsWith(item.to);

  return (
    <button type="button" onClick={() => onNavigate(item.to)} className={`app-link ${active ? 'active' : ''}`}>
      {item.label}
    </button>
  );
};

export const AppShell = ({ theme, onToggleTheme, currentPath, onNavigate, children }: AppShellProps) => (
  <div className="app-shell">
    <header className="app-header">
      <div className="header-inner">
        <div className="header-brand">
          <span className="app-title">Caselog</span>
          <nav className="top-nav">
            {navItems.map((item) => (
              <NavItem key={item.to} item={item} currentPath={currentPath} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>
        <button type="button" onClick={onToggleTheme} className="theme-toggle">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>

    <div className="app-grid">
      <aside className="sidebar">
        <p className="sidebar-title">Navigation</p>
        <ul>
          {sidebarItems.map((item) => (
            <li key={item.to}>
              <NavItem item={item} currentPath={currentPath} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </aside>

      <main>{children}</main>
    </div>
  </div>
);
