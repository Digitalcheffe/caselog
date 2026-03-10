import { apiRequest } from "./client";

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
export type Notebook = {
  id: string;
  shelfId: string;
  name: string;
  description?: string;
  pageCount?: number;
};

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

type ApiPage = {
  id: string;
  title: string;
  content?: string;
  tags?: string[];
  visibility?: "private" | "internal" | "public";
  followUp?: boolean;
  hasFollowUp?: boolean;
  attachments?: Attachment[];
  createdAt?: string;
  updatedAt?: string;
  notebookId?: string;
};

const toPage = (page: ApiPage): Page => {
  const now = new Date().toISOString();
  return {
    id: page.id,
    title: page.title,
    content: page.content ?? "",
    tags: page.tags ?? [],
    visibility: page.visibility ?? "private",
    followUp: page.followUp ?? page.hasFollowUp ?? false,
    attachments: page.attachments ?? [],
    createdAt: page.createdAt ?? now,
    updatedAt: page.updatedAt ?? now,
    notebookId: page.notebookId,
  };
};

export const getNotebookPages = async (notebookId: string): Promise<Page[]> => {
  const response = await apiRequest<ApiPage[]>(`/api/notebooks/${notebookId}/pages`);
  return response.map(toPage);
};

export const createNotebookPage = async (
  notebookId: string,
  body: { title: string },
): Promise<Page> => {
  const response = await apiRequest<ApiPage>(`/api/notebooks/${notebookId}/pages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return toPage(response);
};

type ApiNotebook = {
  id: string;
  shelfId: string;
  name?: string;
  title?: string;
  description?: string;
  pageCount?: number;
};

const toNotebook = (notebook: ApiNotebook): Notebook => ({
  id: notebook.id,
  shelfId: notebook.shelfId,
  name: notebook.name ?? notebook.title ?? "Untitled Notebook",
  description: notebook.description,
  pageCount: notebook.pageCount,
});

export const getShelfNotebooks = async (shelfId: string): Promise<Notebook[]> => {
  const response = await apiRequest<ApiNotebook[]>(`/api/shelves/${shelfId}/notebooks`);
  return response.map(toNotebook);
};

export const createShelfNotebook = async (
  shelfId: string,
  body: { title: string },
): Promise<Notebook> => {
  const response = await apiRequest<ApiNotebook>(`/api/shelves/${shelfId}/notebooks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return toNotebook(response);
};

type ApiShelf = {
  id: string;
  name: string;
  description?: string;
  notebookCount?: number;
};

export const getShelves = async (): Promise<(Shelf & { notebookCount?: number })[]> => {
  const response = await apiRequest<ApiShelf[]>("/api/shelves");
  return response.map((shelf) => ({
    id: shelf.id,
    name: shelf.name,
    description: shelf.description ?? "",
    notebookCount: shelf.notebookCount,
  }));
};

export const createShelf = async (body: {
  name: string;
  description: string;
}): Promise<Shelf> => {
  const response = await apiRequest<ApiShelf>("/api/shelves", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    id: response.id,
    name: response.name,
    description: response.description ?? "",
  };
};
