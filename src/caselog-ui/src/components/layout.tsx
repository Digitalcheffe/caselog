import type { PropsWithChildren } from 'react';
import { Button, Input } from './ui';

export const TopNav = ({ onNavigate, onSearch, searchValue, onToggleTheme, isDark }: { onNavigate: (path: string) => void; onSearch: (value: string) => void; searchValue: string; onToggleTheme: () => void; isDark: boolean }) => (
  <header className="top-nav-wrap"><div className="top-nav-inner"><strong>Caselog</strong><nav><button onClick={() => onNavigate('/')}>Dashboard</button><button onClick={() => onNavigate('/search')}>Search</button></nav><div className="row"><Input value={searchValue} placeholder="Search…" onChange={(e) => onSearch(e.target.value)} /><Button variant="secondary" onClick={onToggleTheme}>{isDark ? '☀️' : '🌙'}</Button></div></div></header>
);

export const Sidebar = ({ onNavigate, isAdmin }: { onNavigate: (path: string) => void; isAdmin: boolean }) => (
  <aside className="sidebar"><button onClick={() => onNavigate('/shelves')}>Shelves</button><button onClick={() => onNavigate('/lists')}>Lists</button><button onClick={() => onNavigate('/mindmaps')}>Mind maps</button><button onClick={() => onNavigate('/followups')}>Follow-ups</button><button onClick={() => onNavigate('/settings')}>Settings</button>{isAdmin ? <button onClick={() => onNavigate('/admin/users')}>Admin</button> : null}</aside>
);

export const AppShell = ({ children, onNavigate, isAdmin, ...top }: PropsWithChildren<{ onNavigate: (path: string) => void; isAdmin: boolean; onSearch: (value: string) => void; searchValue: string; onToggleTheme: () => void; isDark: boolean }>) => (
  <div><TopNav onNavigate={onNavigate} {...top} /><div className="layout"><Sidebar onNavigate={onNavigate} isAdmin={isAdmin} /><main>{children}</main></div></div>
);
