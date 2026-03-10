export type Page = { id: string; title: string; content: string; tags: string[]; visibility: 'private' | 'internal' | 'public'; followUp: boolean; attachments: number; notebookId?: string };
export type Shelf = { id: string; name: string; description: string };
export type Notebook = { id: string; shelfId: string; name: string };

const load = <T,>(key: string, fallback: T): T => {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
};
const save = <T,>(key: string, value: T) => window.localStorage.setItem(key, JSON.stringify(value));

export const db = {
  shelves: () => load<Shelf[]>('shelves', [{ id: 's1', name: 'Home', description: 'Household' }]),
  notebooks: () => load<Notebook[]>('notebooks', [{ id: 'n1', shelfId: 's1', name: 'General' }]),
  pages: () => load<Page[]>('pages', [{ id: 'p1', title: 'Welcome', content: 'Start writing...', tags: ['source:manual'], visibility: 'private', followUp: false, attachments: 0, notebookId: 'n1' }]),
  setPages: (pages: Page[]) => save('pages', pages)
};
