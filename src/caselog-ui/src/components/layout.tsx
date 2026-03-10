import type { PropsWithChildren } from 'react';
import { Input } from './ui';

type NavItem = {
  path: string;
  label: string;
};

const topNavItems: NavItem[] = [
  { path: '/', label: 'Dashboard' },
  { path: '/shelves', label: 'Shelves' },
  { path: '/lists', label: 'Lists' },
  { path: '/mindmaps', label: 'Mind Maps' },
  { path: '/followups', label: 'Follow-ups' }
];

const sidebarItems: Array<NavItem & { icon: string; adminOnly?: boolean }> = [
  { path: '/shelves', label: 'Shelves', icon: '📚' },
  { path: '/lists', label: 'Lists', icon: '📋' },
  { path: '/mindmaps', label: 'Mind Maps', icon: '🧠' },
  { path: '/followups', label: 'Follow-ups', icon: '⏰' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
  { path: '/admin/users', label: 'Admin', icon: '🛡️', adminOnly: true }
];

const isActivePath = (currentPath: string, itemPath: string) => itemPath === '/' ? currentPath === '/' : currentPath.startsWith(itemPath);

const NavButton = ({
  item,
  currentPath,
  onNavigate,
  className
}: {
  item: NavItem;
  currentPath: string;
  onNavigate: (path: string) => void;
  className: string;
}) => (
  <button
    type="button"
    className={`${className} ${isActivePath(currentPath, item.path) ? 'active' : ''}`.trim()}
    onClick={() => onNavigate(item.path)}
  >
    {item.label}
  </button>
);

export const TopNav = ({ onNavigate, onSearch, searchValue, onToggleTheme, isDark, currentPath }: { onNavigate: (path: string) => void; onSearch: (value: string) => void; searchValue: string; onToggleTheme: () => void; isDark: boolean; currentPath: string }) => (
  <header className="top-nav-wrap">
    <div className="top-nav-inner">
      <div className="top-nav-left">
        <button type="button" className="wordmark" onClick={() => onNavigate('/')}>Caselog</button>
        <nav className="top-nav-links" aria-label="Primary navigation">
          {topNavItems.map((item) => <NavButton key={item.path} item={item} currentPath={currentPath} onNavigate={onNavigate} className="top-nav-button" />)}
        </nav>
      </div>
      <div className="top-nav-right">
        <Input className="top-search" value={searchValue} placeholder="Search…" onChange={(e) => onSearch(e.target.value)} />
        <button type="button" className="theme-toggle" onClick={onToggleTheme}>{isDark ? '☀️' : '🌙'}</button>
        <button type="button" className="avatar-button" onClick={() => onNavigate('/settings/profile')} aria-label="Open profile">A</button>
      </div>
    </div>
  </header>
);

export const Sidebar = ({ onNavigate, isAdmin, currentPath }: { onNavigate: (path: string) => void; isAdmin: boolean; currentPath: string }) => (
  <aside className="sidebar" aria-label="Sidebar navigation">
    <p className="sidebar-section-label">Navigation</p>
    {sidebarItems.filter((item) => !item.adminOnly || isAdmin).map((item) => (
      <button key={item.path} type="button" className={`sidebar-link ${isActivePath(currentPath, item.path) ? 'active' : ''}`.trim()} onClick={() => onNavigate(item.path)}>
        <span aria-hidden="true">{item.icon}</span>
        <span>{item.label}</span>
      </button>
    ))}
  </aside>
);

export const AppShell = ({ children, onNavigate, isAdmin, currentPath, ...top }: PropsWithChildren<{ onNavigate: (path: string) => void; isAdmin: boolean; onSearch: (value: string) => void; searchValue: string; onToggleTheme: () => void; isDark: boolean; currentPath: string }>) => (
  <div className="app-shell">
    <TopNav onNavigate={onNavigate} currentPath={currentPath} {...top} />
    <Sidebar onNavigate={onNavigate} isAdmin={isAdmin} currentPath={currentPath} />
    <main className="main-content">{children}</main>
  </div>
);
