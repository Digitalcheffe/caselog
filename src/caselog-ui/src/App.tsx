import { useEffect, useMemo, useState } from 'react';
import { db, type Page } from './api';
import { AppShell } from './components/layout';
import { Badge, Button, Card, CardGrid, Checkbox, ConfirmDialog, EmptyState, Input, MetadataLine, PageHeader, Select, TagList, Textarea, Toast } from './components/ui';
import { useRouter } from './hooks/useRouter';
import { ThemeProvider, useTheme } from './hooks/useTheme';

const routes = ['/', '/shelves', '/shelves/:id', '/notebooks/:id', '/pages/:id', '/search', '/lists', '/lists/:id', '/mindmaps', '/mindmaps/:id', '/followups', '/unorganized', '/settings', '/settings/profile', '/admin/users', '/admin/users/new', '/admin/users/:id', '/dev/components'];
type User = { id: string; name: string; email: string; role: 'admin' | 'member'; disabled?: boolean };

const AppInner = () => {
  const { theme, toggleTheme } = useTheme();
  const { currentRoute, pathname, params, navigate } = useRouter(routes);
  const [search, setSearch] = useState(new URLSearchParams(window.location.search).get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [pages, setPages] = useState<Page[]>(() => db.pages());
  const [toast, setToast] = useState('');
  const [users, setUsers] = useState<User[]>([{ id: 'u1', name: 'Admin', email: 'admin@local', role: 'admin' }, { id: 'u2', name: 'Member', email: 'member@local', role: 'member' }]);
  const isAdmin = true;
  const shelves = db.shelves();
  const notebooks = db.notebooks();

  useEffect(() => { const id = window.setTimeout(() => setDebouncedSearch(search), 300); return () => window.clearTimeout(id); }, [search]);
  useEffect(() => {
    const url = new URL(window.location.href);
    debouncedSearch ? url.searchParams.set('q', debouncedSearch) : url.searchParams.delete('q');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [debouncedSearch]);

  const filtered = useMemo(() => pages.filter((p) => `${p.title} ${p.content} ${p.tags.join(' ')}`.toLowerCase().includes(debouncedSearch.toLowerCase())), [debouncedSearch, pages]);
  const addQuickCapture = (content: string) => {
    const nextItem: Page = { id: crypto.randomUUID(), title: 'Quick note', content, tags: ['quick-capture'], visibility: 'private', followUp: false, attachments: 0 };
    const next = [...pages, nextItem];
    setPages(next);
    db.setPages(next);
    setToast('Quick capture saved');
  };

  let content: JSX.Element;
  switch (currentRoute) {
    case '/':
      content = <Dashboard pages={pages} onQuickCapture={addQuickCapture} />;
      break;
    case '/shelves':
      content = <div><PageHeader title="Shelves" /><CardGrid>{shelves.map((s) => <Card key={s.id}><h3>{s.name}</h3><p>{s.description}</p><Button onClick={() => navigate(`/shelves/${s.id}`)}>Open</Button></Card>)}</CardGrid></div>;
      break;
    case '/shelves/:id':
      content = <div><PageHeader title="Shelf detail" /><CardGrid>{notebooks.filter((n) => n.shelfId === params.id).map((n) => <Card key={n.id}><h3>{n.name}</h3><Button onClick={() => navigate(`/notebooks/${n.id}`)}>Open</Button></Card>)}</CardGrid></div>;
      break;
    case '/notebooks/:id':
      content = <div><PageHeader title="Notebook detail" /><CardGrid>{pages.filter((p) => p.notebookId === params.id).map((p) => <Card key={p.id}><h3>{p.title}</h3><Button onClick={() => navigate(`/pages/${p.id}`)}>Open</Button></Card>)}</CardGrid></div>;
      break;
    case '/pages/:id': {
      const page = pages.find((p) => p.id === params.id);
      content = page ? <PageEditor page={page} pages={pages} setPages={setPages} onSaved={() => setToast('Page auto-saved')} /> : <EmptyState title="Page missing" body="Not found." />;
      break;
    }
    case '/search':
      content = <SearchPage results={filtered} />;
      break;
    case '/followups':
      content = <FollowUps pages={pages} setPages={setPages} />;
      break;
    case '/unorganized':
      content = <div><PageHeader title="Unorganized" />{pages.filter((p) => !p.notebookId).map((p) => <Card key={p.id}>{p.title}</Card>)}</div>;
      break;
    case '/settings':
    case '/settings/profile':
      content = <SettingsPage />;
      break;
    case '/admin/users':
    case '/admin/users/new':
    case '/admin/users/:id':
      content = <AdminUsers users={users} setUsers={setUsers} navigate={navigate} isAdmin={isAdmin} selectedId={params.id} />;
      break;
    case '/dev/components':
      content = import.meta.env.DEV ? <ComponentShowcase /> : <EmptyState title="Unavailable" body="Dev only" />;
      break;
    default:
      content = <Card><PageHeader title={pathname} subtitle="Feature scaffold for CP4" /></Card>;
  }

  return <AppShell onNavigate={navigate} onSearch={setSearch} searchValue={search} onToggleTheme={toggleTheme} isDark={theme === 'dark'} isAdmin={isAdmin}>{content}{toast && <Toast message={toast} />}</AppShell>;
};

const Dashboard = ({ pages, onQuickCapture }: { pages: Page[]; onQuickCapture: (value: string) => void }) => <div><PageHeader title="Dashboard" /><CardGrid>{pages.slice(0, 3).map((p) => <Card key={p.id}><MetadataLine>PAGE</MetadataLine><h3>{p.title}</h3></Card>)}</CardGrid><Card><MetadataLine>Open follow-ups <Badge tone="accent">{pages.filter((p) => p.followUp).length}</Badge></MetadataLine></Card><Card><h3>Quick capture</h3><Textarea onBlur={(e) => e.target.value.trim() && onQuickCapture(e.target.value)} /></Card></div>;
const SearchPage = ({ results }: { results: Page[] }) => <div><PageHeader title="Search" subtitle="Hint: tag:homelab type:list" />{results.length === 0 ? <EmptyState title="No results" body="Try adjusting query." /> : <CardGrid>{results.map((r) => <Card key={r.id}><MetadataLine>{r.notebookId ? 'notebook' : 'unorganized'}</MetadataLine><h3>{r.title}</h3><p>{r.content.slice(0, 90)}</p><TagList tags={r.tags} /></Card>)}</CardGrid>}</div>;

const FollowUps = ({ pages, setPages }: { pages: Page[]; setPages: (v: Page[]) => void }) => {
  const open = pages.filter((p) => p.followUp);
  if (open.length === 0) return <EmptyState title="No follow-ups" body="Everything is clear." />;
  return <div><PageHeader title="Follow-ups" />{open.map((p) => <Card key={p.id}><h3>{p.title}</h3><Button onClick={() => { const next = pages.map((x) => x.id === p.id ? { ...x, followUp: false } : x); setPages(next); db.setPages(next); }}>Clear</Button></Card>)}</div>;
};

const PageEditor = ({ page, pages, setPages, onSaved }: { page: Page; pages: Page[]; setPages: (v: Page[]) => void; onSaved: () => void }) => {
  const [draft, setDraft] = useState(page);
  useEffect(() => setDraft(page), [page]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const next = pages.map((p) => p.id === draft.id ? draft : p);
      setPages(next);
      db.setPages(next);
      onSaved();
    }, 1000);
    return () => window.clearTimeout(id);
  }, [draft, onSaved, pages, setPages]);

  return <div><MetadataLine>Home / Notebook / {page.title}</MetadataLine><PageHeader title={page.title} /><div className="editor-layout"><Card><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /><div className="editor" contentEditable suppressContentEditableWarning onInput={(e) => setDraft({ ...draft, content: (e.target as HTMLDivElement).innerText })}>{draft.content}</div></Card><Card><h3>Metadata</h3><TagList tags={draft.tags} /><Select value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value as Page['visibility'] })}><option value="private">private</option><option value="internal">internal</option><option value="public">public</option></Select><label><Checkbox checked={draft.followUp} onChange={(e) => setDraft({ ...draft, followUp: e.target.checked })} /> Follow-up flag</label><p>Attachments count: {draft.attachments}</p></Card></div></div>;
};

const SettingsPage = () => <div><PageHeader title="Settings" /><Card><h3>API keys</h3><Button>Generate</Button></Card><Card><h3>Profile</h3><Input placeholder="Email" /><Input placeholder="Current password" type="password" /></Card><Card><h3>2FA</h3><p>Enroll via QR code flow placeholder.</p></Card></div>;

const AdminUsers = ({ users, setUsers, navigate, isAdmin, selectedId }: { users: User[]; setUsers: (v: User[]) => void; navigate: (path: string) => void; isAdmin: boolean; selectedId?: string }) => {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!isAdmin) { navigate('/'); return <EmptyState title="Forbidden" body="Admin only" />; }
  if (window.location.pathname === '/admin/users/new') return <Card><PageHeader title="Create user" /><Input placeholder="Display name" /><Input placeholder="Email" /><Select><option>member</option><option>admin</option></Select><Button>Create</Button></Card>;
  if (selectedId) return <Card><PageHeader title="Edit user" /><p>{users.find((u) => u.id === selectedId)?.email}</p></Card>;
  return <div><PageHeader title="User management" />{users.map((u) => <Card key={u.id}><div className="row"><span>{u.name} ({u.role})</span><Button variant="ghost">Impersonate</Button><Button variant="secondary" onClick={() => setUsers(users.map((x) => x.id === u.id ? { ...x, disabled: !x.disabled } : x))}>{u.disabled ? 'Enable' : 'Disable'}</Button><Button variant="danger" onClick={() => setConfirm(u.id)}>Delete</Button></div></Card>)}<ConfirmDialog open={Boolean(confirm)} title="Delete user" body="Delete this account?" onCancel={() => setConfirm(null)} onConfirm={() => { setUsers(users.filter((u) => u.id !== confirm)); setConfirm(null); }} /></div>;
};

const ComponentShowcase = () => <div><PageHeader title="/dev/components" subtitle="Design system showcase" /><CardGrid><Card><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="danger">Danger</Button><Button variant="ghost">Ghost</Button></Card><Card><Input placeholder="Input" /><Textarea placeholder="Textarea" /><Select><option>Option</option></Select><label><Checkbox /> Checkbox</label></Card></CardGrid></div>;

export const App = () => <ThemeProvider><AppInner /></ThemeProvider>;
