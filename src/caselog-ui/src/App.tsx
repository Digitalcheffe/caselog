import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { useRouter } from './hooks/useRouter';
import { useTheme } from './hooks/useTheme';
import { NotFoundPage } from './pages/NotFoundPage';
import { RoutePlaceholderPage } from './pages/RoutePlaceholderPage';
import { SettingsPage } from './pages/SettingsPage';

const routes = [
  '/',
  '/shelves',
  '/shelves/:id',
  '/notebooks/:id',
  '/pages/:id',
  '/lists',
  '/lists/:id',
  '/entries/:id',
  '/mindmaps',
  '/mindmaps/:id',
  '/notes',
  '/search',
  '/followups',
  '/unorganized',
  '/settings',
  '/settings/profile',
  '/admin/users',
  '/admin/users/new',
  '/admin/users/:id',
  '/public/:slug'
];

const routeContent: Record<string, { title: string; description: string }> = {
  '/': { title: 'Dashboard', description: 'Recent items, follow-ups, and quick capture.' },
  '/shelves': { title: 'Shelves', description: 'Browse all shelves.' },
  '/shelves/:id': { title: 'Shelf detail', description: 'View notebooks in a shelf.' },
  '/notebooks/:id': { title: 'Notebook detail', description: 'View notebook pages.' },
  '/pages/:id': { title: 'Page', description: 'View and edit page content.' },
  '/lists': { title: 'List types', description: 'Browse all list definitions.' },
  '/lists/:id': { title: 'List detail', description: 'View entries in a list type.' },
  '/entries/:id': { title: 'Entry detail', description: 'View list entry fields and notes.' },
  '/mindmaps': { title: 'Mind maps', description: 'Browse all mind maps.' },
  '/mindmaps/:id': { title: 'Mind map editor', description: 'Edit a specific mind map.' },
  '/notes': { title: 'Notes', description: 'Standalone notes list.' },
  '/search': { title: 'Search', description: 'Search all indexed entities.' },
  '/followups': { title: 'Follow-ups', description: 'Open follow-up reminders.' },
  '/unorganized': { title: 'Unorganized', description: 'Items without a parent container.' },
  '/settings': { title: 'Settings', description: 'API keys, profile, 2FA, and SMTP configuration.' },
  '/settings/profile': { title: 'Profile', description: 'Manage user profile details and credentials.' },
  '/admin/users': { title: 'User management', description: 'Admin-only users list.' },
  '/admin/users/new': { title: 'Create user', description: 'Create a new member or admin account.' },
  '/admin/users/:id': { title: 'Edit user', description: 'Edit a managed user account.' },
  '/public/:slug': { title: 'Public page', description: 'Public, read-only content view.' }
};

export const App = () => {
  const { theme, toggleTheme } = useTheme();
  const { currentRoute, pathname, params, navigate } = useRouter(routes);

  useEffect(() => {
    if (pathname === '/home') {
      navigate('/');
    }
  }, [navigate, pathname]);

  const matched = routeContent[currentRoute];
  const page = !matched ? (
    <NotFoundPage />
  ) : currentRoute === '/settings' ? (
    <SettingsPage />
  ) : (
    <RoutePlaceholderPage title={matched.title} description={matched.description} params={params} />
  );

  if (currentRoute === '/public/:slug') {
    return page;
  }

  return (
    <AppShell theme={theme} onToggleTheme={toggleTheme} currentPath={pathname} onNavigate={navigate}>
      {page}
    </AppShell>
  );
};
