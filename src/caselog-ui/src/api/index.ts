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

export type ListFieldType = "text" | "number" | "boolean" | "date" | "select";

export type ListType = {
  id: string;
  name: string;
  description?: string | null;
  visibility: "private" | "internal" | "public";
  publicSlug?: string | null;
  createdAt: string;
};

export type ListTypeField = {
  id: string;
  listTypeId: string;
  fieldName: string;
  fieldType: ListFieldType;
  required: boolean;
  sortOrder: number;
};

export type ListEntry = {
  id: string;
  listTypeId: string;
  createdAt: string;
  updatedAt: string;
  values: Array<{
    fieldId: string;
    fieldName: string;
    fieldType: ListFieldType;
    required: boolean;
    sortOrder: number;
    value: string | number | boolean | null;
  }>;
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

type PagedResult<T> = {
  items: T[];
};

type ApiListType = {
  id: string;
  name: string;
  description?: string;
  visibility: "private" | "internal" | "public";
  publicSlug?: string;
  createdAt: string;
};

export const getLists = async (): Promise<ListType[]> => {
  const response = await apiRequest<PagedResult<ApiListType>>("/api/lists?page=1&pageSize=200");
  return response.items;
};

export const getList = async (id: string): Promise<ListType> =>
  apiRequest<ListType>(`/api/lists/${id}`);

export const createList = async (name: string): Promise<ListType> =>
  apiRequest<ListType>("/api/lists", {
    method: "POST",
    body: JSON.stringify({
      name,
      description: null,
      visibility: "private",
      publicSlug: null,
    }),
  });

export const updateList = async (
  id: string,
  body: Partial<Pick<ListType, "name" | "description" | "visibility" | "publicSlug">>,
): Promise<ListType> => {
  const current = await getList(id);
  return apiRequest<ListType>(`/api/lists/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: body.name ?? current.name,
      description: body.description ?? current.description ?? null,
      visibility: body.visibility ?? current.visibility,
      publicSlug: body.publicSlug ?? current.publicSlug ?? null,
    }),
  });
};

export const getListFields = async (id: string): Promise<ListTypeField[]> =>
  apiRequest<ListTypeField[]>(`/api/lists/${id}/fields`);

export const createListField = async (
  id: string,
  body: { fieldName: string; fieldType: ListFieldType; required?: boolean; sortOrder: number },
): Promise<ListTypeField> =>
  apiRequest<ListTypeField>(`/api/lists/${id}/fields`, {
    method: "POST",
    body: JSON.stringify({ ...body, required: body.required ?? false }),
  });

export const deleteListField = async (id: string, fieldId: string): Promise<void> => {
  await apiRequest<{ deleted: boolean }>(`/api/lists/${id}/fields/${fieldId}`, { method: "DELETE" });
};

type ApiListEntry = Omit<ListEntry, "values"> & {
  values: Array<Omit<ListEntry["values"][number], "value"> & { value: unknown }>;
};

export const getListEntries = async (id: string): Promise<ListEntry[]> => {
  const response = await apiRequest<PagedResult<ApiListEntry>>(`/api/lists/${id}/entries?page=1&pageSize=200`);
  return response.items.map((entry) => ({
    ...entry,
    values: entry.values.map((value) => ({
      ...value,
      value:
        typeof value.value === "string" ||
        typeof value.value === "number" ||
        typeof value.value === "boolean" ||
        value.value === null
          ? value.value
          : null,
    })),
  }));
};

export const createListEntry = async (id: string): Promise<ListEntry> =>
  apiRequest<ListEntry>(`/api/lists/${id}/entries`, {
    method: "POST",
    body: JSON.stringify({ values: {} }),
  });

export const updateEntry = async (
  entryId: string,
  values: Record<string, string | number | boolean | null>,
): Promise<ListEntry> =>
  apiRequest<ListEntry>(`/api/entries/${entryId}`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });

export const deleteEntry = async (entryId: string): Promise<void> => {
  await apiRequest<{ deleted: boolean }>(`/api/entries/${entryId}`, { method: "DELETE" });
};

export const attachListToPage = async (listId: string, pageId: string): Promise<void> => {
  await apiRequest<unknown>(`/api/lists/${listId}/attach`, {
    method: "POST",
    body: JSON.stringify({ pageId }),
  });
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  enabled: boolean;
  lastLoginAt: string | null;
};

export type AdminUserInput = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "member";
};

export type AdminUserUpdateInput = {
  name: string;
  email: string;
  role: "admin" | "member";
  enabled: boolean;
};

export const getAdminUsers = async (): Promise<AdminUser[]> => apiRequest<AdminUser[]>("/api/admin/users");

export const getAdminUser = async (id: string): Promise<AdminUser> =>
  apiRequest<AdminUser>(`/api/admin/users/${id}`);

export const createAdminUser = async (payload: AdminUserInput): Promise<AdminUser> =>
  apiRequest<AdminUser>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateAdminUser = async (id: string, payload: AdminUserUpdateInput): Promise<AdminUser> =>
  apiRequest<AdminUser>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteAdminUser = async (id: string): Promise<void> => {
  await apiRequest<unknown>(`/api/admin/users/${id}`, { method: "DELETE" });
};

export const toggleAdminUserStatus = async (id: string, enabled: boolean): Promise<void> => {
  await apiRequest<unknown>(`/api/admin/users/${id}/${enabled ? "enable" : "disable"}`, {
    method: "POST",
  });
};

export const forceAdminUserResetPassword = async (id: string): Promise<void> => {
  await apiRequest<unknown>(`/api/admin/users/${id}/reset-password`, { method: "POST" });
};

export const impersonateAdminUser = async (id: string): Promise<{ token: string }> =>
  apiRequest<{ token: string }>(`/api/admin/users/${id}/impersonate`, {
    method: "POST",
  });

export const exitAdminImpersonation = async (): Promise<void> => {
  await apiRequest<unknown>("/api/admin/impersonate/exit", { method: "POST" });
};
