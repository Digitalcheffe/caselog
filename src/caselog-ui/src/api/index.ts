import { apiRequest } from "./client";

export type Attachment = { id: string; fileName: string };

type ApiVisibility = "private" | "internal" | "public";

const routes = {
  auth: {
    login: "/api/auth/login",
    me: "/api/auth/me",
  },
  kases: {
    root: "/api/kases",
    byId: (id: string) => `/api/kases/${id}`,
    logs: (kaseId: string) => `/api/kases/${kaseId}/logs`,
  },
  logs: {
    root: "/api/logs",
    byId: (id: string) => `/api/logs/${id}`,
  },
  lists: {
    root: "/api/lists",
    byId: (id: string) => `/api/lists/${id}`,
  },
  mindmaps: {
    root: "/api/mindmaps",
    byId: (id: string) => `/api/mindmaps/${id}`,
  },
  apikeys: {
    root: "/api/apikeys",
    byId: (id: string) => `/api/apikeys/${id}`,
  },
};

export type Log = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  visibility: ApiVisibility;
  followUp: boolean;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  kaseId?: string;
};
export type Kase = {
  id: string;
  name: string;
  description?: string;
};

export type ListFieldType = "text" | "number" | "boolean" | "date" | "select";

export type ListType = {
  id: string;
  name: string;
  description?: string | null;
  visibility: ApiVisibility;
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
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: "admin" | "member";
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

type ApiMindMapDetail = {
  id: string;
  title: string;
  rootNode: ApiMindMapNode;
};

type ApiPage = {

  id: string;
  title: string;
  content?: string;
  tags?: string[];
  visibility?: ApiVisibility;
  followUp?: boolean;
  isFollowUp?: boolean;
  hasFollowUp?: boolean;
  attachments?: Attachment[];
  createdAt?: string;
  updatedAt?: string;
  kaseId?: string;
};

const toPage = (page: ApiPage): Log => {
  const now = new Date().toISOString();
  return {
    id: page.id,
    title: page.title,
    content: page.content ?? "",
    tags: page.tags ?? [],
    visibility: page.visibility ?? "private",
    followUp: page.followUp ?? page.hasFollowUp ?? page.isFollowUp ?? false,
    attachments: page.attachments ?? [],
    createdAt: page.createdAt ?? now,
    updatedAt: page.updatedAt ?? now,
    kaseId: page.kaseId,
  };
};


export const updatePage = async (
  id: string,
  body: Partial<
    Pick<Log, "title" | "content" | "visibility" | "followUp" | "tags">
  >,
): Promise<Log> =>
  toPage(
    await apiRequest<ApiPage>(routes.logs.byId(id), {
      method: "PUT",
      body: JSON.stringify({
        ...(await buildUpdateLogBody(id, body)),
      }),
    }),
  );

export const uploadPageAttachment = async (id: string, file: File): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);
  await apiRequest<unknown>(`/api/logs/${id}/attachments`, {
    method: "POST",
    body: formData,
    headers: {},
  });
};

export const deletePage = async (id: string): Promise<void> => {
  await apiRequest<unknown>(routes.logs.byId(id), { method: "DELETE" });
};


export const getPage = async (id: string): Promise<Log> => toPage(await apiRequest<ApiPage>(routes.logs.byId(id)));

export const searchPages = async (query: string): Promise<Log[]> => {
  const response = await apiRequest<ApiPage[]>(`/api/search?q=${encodeURIComponent(query)}`);
  return response.map(toPage);
};

export const getFollowUpPages = async (): Promise<Log[]> => {
  const response = await apiRequest<PagedResult<ApiPage>>("/api/logs?followUp=true");
  return response.items.map(toPage);
};

export const getRecentPages = async (): Promise<Log[]> => {
  const response = await apiRequest<PagedResult<ApiPage>>("/api/logs?sort=modified&limit=10");
  return response.items.map(toPage);
};

export type ApiMindMapNode = {
  id: string;
  label: string;
  parentNodeId: string | null;
  notes?: string | null;
  sortOrder?: number;
  children?: ApiMindMapNode[];
};

export const toMindMapNode = (node: ApiMindMapNode): MindMapNode => ({
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
  const response = await apiRequest<PagedResult<Omit<MindMap, "nodeCount">>>(`${routes.mindmaps.root}?page=1&pageSize=200`);
  return (response.items ?? []).map((mindMap) => ({ ...mindMap, nodeCount: 0 }));
};

const toMindMapDetail = (response: ApiMindMapDetail): MindMapDetail => {
  const rootNode = toMindMapNode(response.rootNode);
  return {
    id: response.id,
    title: response.title,
    rootNode,
    nodes: flattenMindMapNodes(rootNode),
  };
};

export const getMindMap = async (id: string): Promise<MindMapDetail> => {
  const response = await apiRequest<ApiMindMapDetail>(routes.mindmaps.byId(id));
  return toMindMapDetail(response);
};

export const createMindMap = async (title: string): Promise<MindMapDetail> =>
  toMindMapDetail(await apiRequest<ApiMindMapDetail>(routes.mindmaps.root, {
    method: "POST",
    body: JSON.stringify({ title }),
  }));

export const updateMindMap = async (id: string, data: Pick<MindMapDetail, "title">): Promise<void> => {
  await apiRequest<unknown>(routes.mindmaps.byId(id), {
    method: "PUT",
    body: JSON.stringify({ title: data.title }),
  });
};

export const createMindMapNode = async (
  mindMapId: string,
  data: { label: string; parentId: string | null },
): Promise<MindMapNode> =>
  toMindMapNode(await apiRequest<ApiMindMapNode>(`/api/mindmaps/${mindMapId}/nodes`, {
    method: "POST",
    body: JSON.stringify({ parentNodeId: data.parentId, label: data.label, notes: null, sortOrder: 0 }),
  }));

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
  toMindMapNode(await apiRequest<ApiMindMapNode>(`/api/mindmaps/${mindMapId}/nodes/${nodeId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }));

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

export const getPages = async (query = "page=1&pageSize=200"): Promise<Log[]> => {
  const response = await apiRequest<PagedResult<ApiPage>>(`/api/logs?${query}`);
  return response.items.map(toPage);
};

export const getKases = async (): Promise<Kase[]> => {
  const response = await apiRequest<{ items: Array<{ id: string; name: string; description?: string }> }>(`${routes.kases.root}?page=1&pageSize=200`);
  return response.items.map((k) => ({ id: k.id, name: k.name, description: k.description }));
};

export const createKase = async (body: { name: string; description?: string }): Promise<Kase> =>
  apiRequest<Kase>(routes.kases.root, { method: "POST", body: JSON.stringify(body) });

export const deleteKase = async (id: string): Promise<void> => {
  await apiRequest<unknown>(routes.kases.byId(id), { method: "DELETE" });
};

export const getKase = async (id: string): Promise<Kase> =>
  apiRequest<Kase>(routes.kases.byId(id));

export const getKaseLogs = async (kaseId: string): Promise<Log[]> => {
  const response = await apiRequest<{ items: ApiPage[] }>(`${routes.kases.logs(kaseId)}?page=1&pageSize=200`);
  return response.items.map(toPage);
};

export const createKaseLog = async (kaseId: string, body: { title: string }): Promise<Log> =>
  toPage(await apiRequest<ApiPage>(routes.kases.logs(kaseId), { method: "POST", body: JSON.stringify({ title: body.title, content: "", visibility: "private" }) }));

export const getLooseEnds = async (): Promise<Log[]> => {
  const response = await apiRequest<{ items: ApiPage[] }>(`${routes.logs.root}?unassigned=true&page=1&pageSize=200`);
  return response.items.map(toPage);
};

export const createLooseEndLog = async (): Promise<Log> =>
  toPage(await apiRequest<ApiPage>(routes.logs.root, { method: "POST", body: JSON.stringify({ title: "Untitled" }) }));

export const updateLog = async (id: string, body: Partial<Pick<Log, "title" | "content" | "visibility" | "followUp" | "tags"> & { kaseId?: string | null }>): Promise<Log> =>
  toPage(await apiRequest<ApiPage>(routes.logs.byId(id), { method: "PUT", body: JSON.stringify(await buildUpdateLogBody(id, body)) }));

const buildUpdateLogBody = async (
  id: string,
  body: Partial<Pick<Log, "title" | "content" | "visibility" | "followUp"> & { kaseId?: string | null }>,
) => {
  const current = await getPage(id);
  return {
    kaseId: body.kaseId === undefined ? current.kaseId ?? null : body.kaseId,
    title: body.title ?? current.title,
    content: body.content ?? current.content,
    visibility: body.visibility ?? current.visibility,
    publicSlug: null,
    isFollowUp: body.followUp ?? current.followUp,
    followUpDueAt: null,
  };
};

export const login = async (email: string, password: string): Promise<{ token: string; user?: unknown }> =>
  apiRequest<{ token: string; user?: unknown }>(routes.auth.login, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const getProfile = async (): Promise<ProfileResponse> => apiRequest<ProfileResponse>(routes.auth.me);

export const updateProfileName = async (id: string, firstName: string, lastName: string): Promise<ProfileResponse> =>
  apiRequest<unknown>(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ firstName, lastName }),
  }).then(() => getProfile());

export const updateProfileEmail = async (id: string, email: string): Promise<void> => {
  await apiRequest<unknown>(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ email }),
  });
};

export const updateProfilePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  await apiRequest<unknown>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};

export const getTwoFactorSetup = async (): Promise<{ qrCode: string; secret: string }> => {
  const response = await apiRequest<{ qrCodeDataUri: string; secret: string }>("/api/auth/2fa/setup", { method: "POST" });
  return { qrCode: response.qrCodeDataUri, secret: response.secret };
};

export const enableTwoFactor = async (code: string): Promise<void> => {
  await apiRequest<unknown>("/api/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
};

export const disableTwoFactor = async (): Promise<void> => {
  await apiRequest<unknown>("/api/auth/2fa", {
    method: "DELETE",
  });
};

export const getApiKeys = async (): Promise<Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>> => {
  const keys = await apiRequest<Array<{ id: string; label: string; createdAt: string; lastUsedAt?: string | null }>>(routes.apikeys.root);
  return keys.map((key) => ({
    id: key.id,
    name: key.label,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
  }));
};

export const createApiKey = async (name: string): Promise<{ id: string; name: string; key: string; createdAt: string }> => {
  const created = await apiRequest<{ id: string; label: string; key: string; createdAt: string }>(routes.apikeys.root, {
    method: "POST",
    body: JSON.stringify({ label: name }),
  });

  return {
    id: created.id,
    name: created.label,
    key: created.key,
    createdAt: created.createdAt,
  };
};

export const revokeApiKey = async (id: string): Promise<void> => {
  await apiRequest<unknown>(routes.apikeys.byId(id), {
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
  visibility: ApiVisibility;
  publicSlug?: string;
  createdAt: string;
};

export const getLists = async (): Promise<ListType[]> => {
  const response = await apiRequest<PagedResult<ApiListType>>(`${routes.lists.root}?page=1&pageSize=200`);
  return response.items;
};

export const getList = async (id: string): Promise<ListType> =>
  apiRequest<ListType>(routes.lists.byId(id));

export const createList = async (name: string): Promise<ListType> =>
  apiRequest<ListType>(routes.lists.root, {
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
  return apiRequest<ListType>(routes.lists.byId(id), {
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
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  role: "admin" | "member";
  enabled: boolean;
  lastLoginAt: string | null;
};

export type AdminUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "admin" | "member";
};

export type AdminUserUpdateInput = {
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "member";
  enabled: boolean;
};

type ApiUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  email: string;
  role: "admin" | "member";
  isDisabled: boolean;
  lastLoginAt: string | null;
};

const toAdminUser = (user: ApiUser): AdminUser => {
  const fullNameParts = user.fullName.trim().split(/\s+/).filter(Boolean);
  const fallbackFirstName = fullNameParts[0] ?? "";
  const fallbackLastName = fullNameParts.slice(1).join(" ");
  const firstName = user.firstName?.trim() || fallbackFirstName;
  const lastName = user.lastName?.trim() || fallbackLastName;

  return {
    id: user.id,
    firstName,
    lastName,
    name: user.fullName || `${firstName} ${lastName}`.trim(),
    email: user.email,
    role: user.role,
    enabled: !user.isDisabled,
    lastLoginAt: user.lastLoginAt,
  };
};

export const getAdminUsers = async (): Promise<AdminUser[]> => (await apiRequest<ApiUser[]>("/api/users")).map(toAdminUser);

export const getAdminUser = async (id: string): Promise<AdminUser> =>
  toAdminUser(await apiRequest<ApiUser>(`/api/users/${id}`));

export const createAdminUser = async (payload: AdminUserInput): Promise<AdminUser> =>
  toAdminUser(await apiRequest<ApiUser>("/api/users", {
    method: "POST",
    body: JSON.stringify({ email: payload.email, password: payload.password, firstName: payload.firstName, lastName: payload.lastName, role: payload.role }),
  }));

export const updateAdminUser = async (id: string, payload: AdminUserUpdateInput): Promise<AdminUser> =>
  toAdminUser(await apiRequest<ApiUser>(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ email: payload.email, firstName: payload.firstName, lastName: payload.lastName, role: payload.role, isDisabled: !payload.enabled }),
  }));

export const deleteAdminUser = async (id: string): Promise<void> => {
  await apiRequest<unknown>(`/api/users/${id}`, { method: "DELETE" });
};

export const toggleAdminUserStatus = async (id: string, enabled: boolean): Promise<void> => {
  await apiRequest<unknown>(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ isDisabled: !enabled }),
  });
};
