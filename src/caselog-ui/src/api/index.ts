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

export type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  twoFactorEnabled: boolean;
  avatarUrl?: string;
};

export type MindMap = {
  id: string;
  title: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MindMapNode = {
  id: string;
  label: string;
  parentId: string | null;
  x: number;
  y: number;
  children: MindMapNode[];
  parentNodeId: string | null;
  notes?: string | null;
  sortOrder?: number;
};

export type MindMapDetail = {
  id: string;
  title: string;
  nodes: MindMapNode[];
  rootNode: MindMapNode;
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


export const updatePage = async (
  id: string,
  body: Partial<
    Pick<Page, "title" | "content" | "visibility" | "followUp" | "tags">
  >,
): Promise<Page> =>
  toPage(
    await apiRequest<ApiPage>(`/api/pages/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  );

export const uploadPageAttachment = async (id: string, file: File): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);
  await apiRequest<unknown>(`/api/pages/${id}/attachments`, {
    method: "POST",
    body: formData,
    headers: {},
  });
};

export const deletePage = async (id: string): Promise<void> => {
  await apiRequest<unknown>(`/api/pages/${id}`, { method: "DELETE" });
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


export const deleteShelf = async (id: string): Promise<void> => {
  await apiRequest<unknown>(`/api/shelves/${id}`, { method: "DELETE" });
};

export const getNotebook = async (id: string): Promise<Notebook> =>
  toNotebook(await apiRequest<ApiNotebook>(`/api/notebooks/${id}`));

export const getPage = async (id: string): Promise<Page> => toPage(await apiRequest<ApiPage>(`/api/pages/${id}`));

export const searchPages = async (query: string): Promise<Page[]> => {
  const response = await apiRequest<ApiPage[]>(`/api/search?q=${encodeURIComponent(query)}`);
  return response.map(toPage);
};

export const getFollowUpPages = async (): Promise<Page[]> => {
  const response = await apiRequest<PagedResult<ApiPage>>("/api/pages?followUp=true");
  return response.items.map(toPage);
};

export const getRecentPages = async (): Promise<Page[]> => {
  const response = await apiRequest<PagedResult<ApiPage>>("/api/pages?sort=modified&limit=10");
  return response.items.map(toPage);
};

type ApiMindMapNode = {
  id: string;
  label: string;
  parentNodeId: string | null;
  notes?: string | null;
  sortOrder?: number;
  children?: ApiMindMapNode[];
};

const toMindMapNode = (node: ApiMindMapNode): MindMapNode => ({
  id: node.id,
  label: node.label,
  parentId: node.parentNodeId,
  parentNodeId: node.parentNodeId,
  x: 0,
  y: 0,
  notes: node.notes,
  sortOrder: node.sortOrder,
  children: (node.children ?? []).map((child) => toMindMapNode(child)),
});

const flattenMindMapNodes = (rootNode: MindMapNode): MindMapNode[] => {
  const queue = [rootNode];
  const nodes: MindMapNode[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    nodes.push(current);
    queue.push(...current.children);
  }
  return nodes;
};

export const getMindMaps = async (): Promise<MindMap[]> => {
  const response = await apiRequest<PagedResult<Omit<MindMap, "nodeCount">>>("/api/mindmaps?page=1&pageSize=200");
  return response.items.map((mindMap) => ({ ...mindMap, nodeCount: 0 }));
};

export const getMindMap = async (id: string): Promise<MindMapDetail> => {
  const response = await apiRequest<{
    id: string;
    title: string;
    rootNode: ApiMindMapNode;
  }>(`/api/mindmaps/${id}`);

  const rootNode = toMindMapNode(response.rootNode);
  return {
    id: response.id,
    title: response.title,
    rootNode,
    nodes: flattenMindMapNodes(rootNode),
  };
};

export const createMindMap = async (title: string): Promise<MindMapDetail> =>
  apiRequest<MindMapDetail>("/api/mindmaps", {
    method: "POST",
    body: JSON.stringify({ title }),
  });

export const updateMindMap = async (id: string, data: Partial<MindMapDetail>): Promise<MindMapDetail> =>
  apiRequest<MindMapDetail>(`/api/mindmaps/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const createMindMapNode = async (
  mindMapId: string,
  data: { label: string; parentId: string | null },
): Promise<MindMapNode> =>
  apiRequest<MindMapNode>(`/api/mindmaps/${mindMapId}/nodes`, {
    method: "POST",
    body: JSON.stringify({ parentNodeId: data.parentId, label: data.label }),
  });

export const updateMindMapNode = async (
  mindMapId: string,
  nodeId: string,
  data: {
    label?: string;
    x?: number;
    y?: number;
    parentNodeId?: string | null;
    notes?: string | null;
    sortOrder?: number;
  },
): Promise<MindMapNode> =>
  apiRequest<MindMapNode>(`/api/mindmaps/${mindMapId}/nodes/${nodeId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteMindMapNode = async (mindMapId: string, nodeId: string): Promise<void> => {
  await apiRequest<unknown>(`/api/mindmaps/${mindMapId}/nodes/${nodeId}`, {
    method: "DELETE",
  });
};

export const attachMindMapToPage = async (mindMapId: string, pageId: string): Promise<void> => {
  await apiRequest<unknown>(`/api/mindmaps/${mindMapId}/attach`, {
    method: "POST",
    body: JSON.stringify({ pageId }),
  });
};

export const getPages = async (query = "page=1&pageSize=200"): Promise<Page[]> => {
  const response = await apiRequest<PagedResult<ApiPage>>(`/api/pages?${query}`);
  return response.items.map(toPage);
};

export const getProfile = async (): Promise<ProfileResponse> => apiRequest<ProfileResponse>("/api/auth/profile");

export const updateProfileName = async (name: string): Promise<ProfileResponse> =>
  apiRequest<ProfileResponse>("/api/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ name }),
  });

export const updateProfileEmail = async (email: string, currentPassword: string): Promise<void> => {
  await apiRequest<unknown>("/api/auth/email", {
    method: "PUT",
    body: JSON.stringify({ email, currentPassword }),
  });
};

export const updateProfilePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  await apiRequest<unknown>("/api/auth/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};

export const getTwoFactorSetup = async (): Promise<{ qrCode: string; secret: string }> =>
  apiRequest<{ qrCode: string; secret: string }>("/api/auth/2fa/setup");

export const enableTwoFactor = async (token: string): Promise<void> => {
  await apiRequest<unknown>("/api/auth/2fa/enable", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
};

export const disableTwoFactor = async (): Promise<void> => {
  await apiRequest<unknown>("/api/auth/2fa/disable", {
    method: "POST",
  });
};

export const getAuthSessions = async (): Promise<
  Array<{ id: string; device: string; browser: string; lastSeenAt: string; isCurrent: boolean }>
> => apiRequest<Array<{ id: string; device: string; browser: string; lastSeenAt: string; isCurrent: boolean }>>("/api/auth/sessions");

export const revokeAuthSession = async (id: string): Promise<void> => {
  await apiRequest<unknown>(`/api/auth/sessions/${id}`, {
    method: "DELETE",
  });
};

export const getApiKeys = async (): Promise<Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>> =>
  apiRequest<Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>>("/api/apikeys");

export const createApiKey = async (name: string): Promise<{ id: string; name: string; key: string; createdAt: string }> =>
  apiRequest<{ id: string; name: string; key: string; createdAt: string }>("/api/apikeys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const revokeApiKey = async (id: string): Promise<void> => {
  await apiRequest<unknown>(`/api/apikeys/${id}`, {
    method: "DELETE",
  });
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
