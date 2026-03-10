export type Attachment = { id: string; fileName: string };

export type Page = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  visibility: "private" | "internal" | "public";
  followUp: boolean;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  notebookId?: string;
};
export type Shelf = { id: string; name: string; description: string };
export type Notebook = { id: string; shelfId: string; name: string };

const load = <T>(key: string, fallback: T): T => {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
};
const save = <T>(key: string, value: T) =>
  window.localStorage.setItem(key, JSON.stringify(value));

export const db = {
  shelves: () =>
    load<Shelf[]>("shelves", [
      { id: "s1", name: "Home", description: "Household" },
    ]),
  notebooks: () =>
    load<Notebook[]>("notebooks", [
      { id: "n1", shelfId: "s1", name: "General" },
    ]),
  pages: () => {
    const now = new Date().toISOString();
    const pages = load<
      (Page & {
        attachments?: Attachment[] | number;
        createdAt?: string;
        updatedAt?: string;
      })[]
    >("pages", [
      {
        id: "p1",
        title: "Welcome",
        content: "Start writing...",
        tags: ["source:manual"],
        visibility: "private",
        followUp: false,
        attachments: [],
        createdAt: now,
        updatedAt: now,
        notebookId: "n1",
      },
    ]);
    return pages.map((page) => ({
      ...page,
      attachments: Array.isArray(page.attachments) ? page.attachments : [],
      createdAt: page.createdAt ?? now,
      updatedAt: page.updatedAt ?? now,
    }));
  },
  setPages: (pages: Page[]) => save("pages", pages),
};

export const updatePage = async (
  id: string,
  body: Partial<
    Pick<Page, "title" | "content" | "visibility" | "followUp" | "tags">
  >,
) => {
  const response = await fetch(`/api/pages/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to update page (${response.status})`);
  }
};

export const uploadPageAttachment = async (id: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`/api/pages/${id}/attachments`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload attachment (${response.status})`);
  }
};

export const deletePage = async (id: string) => {
  const response = await fetch(`/api/pages/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete page (${response.status})`);
  }
};
