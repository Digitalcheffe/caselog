import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  createAdminUser,
  attachListToPage,
  createApiKey,
  createList,
  createListEntry,
  createListField,
  createKase,
  createKaseLog,
  disableTwoFactor,
  enableTwoFactor,
  getApiKeys,
  getProfile,
  getTwoFactorSetup,
  revokeApiKey,
  deleteAdminUser,
  deleteEntry,
  deleteListField,
  deletePage,
  getAdminUser,
  getAdminUsers,
  getList,
  getListEntries,
  login,
  getListFields,
  getLists,
  getKaseLogs,
  getKases,
  getPages,
  getRecentPages,
  getFollowUpPages,
  searchPages,
  type ListEntry,
  type AdminUser,
  type ListFieldType,
  type ListType,
  type ListTypeField,
  type Kase,
  type Log,
  type ProfileResponse,
  toggleAdminUserStatus,
  updateAdminUser,
  updateEntry,
  updateList,
  updatePage,
  updateProfileEmail,
  updateProfileName,
  updateProfilePassword,
  uploadPageAttachment,
} from "./api";
import { authStorage, type ApiError } from "./api/client";
import { AppShell } from "./components/layout";
import {
  Badge,
  Button,
  Card,
  CardGrid,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Input,
  MetadataLine,
  PageHeader,
  Select,
  TagList,
  Textarea,
  Toast,
  Spinner,
} from "./components/ui";
import { useRouter } from "./hooks/useRouter";
import { ThemeProvider, useTheme } from "./hooks/useTheme";
import { MindMapEditorPage, MindMapsIndexPage } from "./components/mindmaps";
import LooseEnds from "./pages/loose-ends";

const routes = [
  "/",
  "/dashboard",
  "/kases",
  "/kases/:id",
  "/logs/:id",
  "/search",
  "/lists",
  "/lists/:id",
  "/mindmaps",
  "/mindmaps/:id",
  "/followups",
  "/loose-ends",
  "/settings",
  "/settings/profile",
  "/admin/users",
  "/admin/users/new",
  "/admin/users/:id",
  "/dev/components",
  "/login",
  "/logout",
];
const AppInner = () => {
  const { theme, toggleTheme } = useTheme();
  const { currentRoute, pathname, params, navigate } = useRouter(routes);
  const initialSearch = new URLSearchParams(window.location.search).get("q") ?? "";
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [logs, setLogs] = useState<Log[]>([]);
  const [kases, setKases] = useState<Kase[]>([]);
  const [lists, setLists] = useState<ListType[]>([]);
  const [listFields, setListFields] = useState<ListTypeField[]>([]);
  const [listEntries, setListEntries] = useState<ListEntry[]>([]);
  const [toast, setToast] = useState("");
  const [currentUserRole] = useState<"admin" | "member">("admin");
  const isAdmin = currentUserRole === "admin";

  const token = authStorage.getToken();
  const isAuthenticated = Boolean(token);

  useEffect(() => {
    if (!isAuthenticated && pathname !== "/login") {
      navigate("/login");
    }
    if (isAuthenticated && pathname === "/login") {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate, pathname]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);


  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q") ?? "";
    if (q !== search) {
      setSearch(q);
      setDebouncedSearch(q);
    }
  }, [pathname]);


  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const url = new URL(window.location.href);
    debouncedSearch
      ? url.searchParams.set("q", debouncedSearch)
      : url.searchParams.delete("q");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadKases = async () => {
      try {
        const fetchedKases = await getKases();
        setKases(fetchedKases);
      } catch (error) {
        const apiError = error as ApiError;
        setToast(`Error ${apiError.status}: ${apiError.message}`);
      }
    };

    void loadKases();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void getPages().then(setLogs).catch((error: ApiError) => setToast(`Error ${error.status}: ${error.message}`));
  }, [isAuthenticated]);

  useEffect(() => {
    if (currentRoute !== "/kases/:id" || !params.id) return;
    void getKaseLogs(params.id)
      .then((items) => setLogs((prev) => {
        const others = prev.filter((p) => p.kaseId !== params.id);
        return [...others, ...items];
      }))
      .catch((error: ApiError) => setToast(`Error ${error.status}: ${error.message}`));
  }, [currentRoute, params.id]);
  useEffect(() => {
    if (currentRoute !== "/lists") return;

    const loadListTypes = async () => {
      try {
        setLists(await getLists());
      } catch {
        setLists([]);
      }
    };

    void loadListTypes();
  }, [currentRoute]);

  useEffect(() => {
    if (currentRoute !== "/lists/:id" || !params.id) return;

    const loadListData = async () => {
      try {
        const [listType, fields, entries] = await Promise.all([
          getList(params.id),
          getListFields(params.id),
          getListEntries(params.id),
        ]);
        setLists((previous) => {
          const remaining = previous.filter((item) => item.id !== listType.id);
          return [...remaining, listType];
        });
        setListFields(fields);
        setListEntries(entries);
      } catch {
        setToast("Failed to load list");
      }
    };

    void loadListData();
  }, [currentRoute, params.id]);

  const addQuickCapture = (content: string) => {
    const now = new Date().toISOString();
    const nextItem: Log = {
      id: crypto.randomUUID(),
      title: "Quick note",
      content,
      tags: ["quick-capture"],
      visibility: "private",
      followUp: false,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    const next = [...logs, nextItem];
    setLogs(next);
    setToast("Quick capture saved");
  };

  let content: JSX.Element;
  switch (currentRoute) {
    case "/login":
      content = <LoginPage navigate={navigate} onToast={setToast} />;
      break;
    case "/logout":
      authStorage.clearSession();
      navigate("/login");
      content = <EmptyState title="Signing out" body="Redirecting to login..." />;
      break;
    case "/":
    case "/dashboard":
      content = <Dashboard onQuickCapture={addQuickCapture} />;
      break;
    case "/kases":
      content = (
        <KasesPage
          kases={kases}
          navigate={navigate}
          onKasesChange={setKases}
          onToast={setToast}
        />
      );
      break;
    case "/kases/:id": {
      const kase = kases.find((item) => item.id === params.id);
      const kaseLogs = logs.filter((p) => p.kaseId === params.id);
      content = kase ? (
        <KaseDetailPage
          kase={kase}
          logs={kaseLogs}
          navigate={navigate}
          onLogCreated={(log) =>
            setLogs((prev) => [...prev.filter((p) => p.id !== log.id), log])
          }
          onToast={setToast}
        />
      ) : (
        <EmptyState title="Kase missing" body="Not found." />
      );
      break;
    }
    case "/logs/:id": {
      const page = logs.find((p) => p.id === params.id);
      content = page ? (
        <PageEditor
          page={page}
          logs={logs}
          setPages={setLogs}
          navigate={navigate}
          onToast={setToast}
        />
      ) : (
        <EmptyState title="Log missing" body="Not found." />
      );
      break;
    }
    case "/lists":
      content = (
        <ListsIndexPage
          lists={lists}
          navigate={navigate}
          onListsChange={setLists}
          onToast={setToast}
        />
      );
      break;
    case "/lists/:id": {
      const list = lists.find((item) => item.id === params.id);
      content = list ? (
        <ListDetailPage
          list={list}
          fields={listFields}
          entries={listEntries}
          logs={logs}
          onListChange={(nextList) =>
            setLists((previous) =>
              previous.map((item) => (item.id === nextList.id ? nextList : item)),
            )
          }
          onFieldsChange={setListFields}
          onEntriesChange={setListEntries}
          onToast={setToast}
        />
      ) : (
        <EmptyState title="List missing" body="Not found." />
      );
      break;
    }
    case "/search":
      content = <SearchPage query={debouncedSearch} navigate={navigate} />;
      break;
    case "/mindmaps":
      content = <MindMapsIndexPage navigate={navigate} onToast={setToast} />;
      break;
    case "/mindmaps/:id":
      content = params.id ? <MindMapEditorPage id={params.id} onToast={setToast} /> : <EmptyState title="Mind map missing" body="Not found." />;
      break;
    case "/followups":
      content = <FollowUps />;
      break;
    case "/loose-ends":
      content = <LooseEnds navigate={navigate} />;
      break;
    case "/settings":
    case "/settings/profile":
      content = <SettingsPage />;
      break;
    case "/admin/users":
    case "/admin/users/new":
    case "/admin/users/:id":
      content = (
        <AdminUsers
          navigate={navigate}
          isAdmin={isAdmin}
          selectedId={params.id}
          currentRoute={currentRoute}
          onToast={setToast}
        />
      );
      break;
    case "/dev/components":
      content = import.meta.env.DEV ? (
        <ComponentShowcase />
      ) : (
        <EmptyState title="Unavailable" body="Dev only" />
      );
      break;
    default:
      content = (
        <Card>
          <PageHeader title={pathname} subtitle="Feature scaffold for CP4" />
        </Card>
      );
  }

  if (pathname === "/login") {
    return <>
      {content}
      {toast && <Toast message={toast} />}
    </>;
  }

  return (
    <>
      <AppShell
        onNavigate={navigate}
        onSearch={setSearch}
        searchValue={search}
        onToggleTheme={toggleTheme}
        isDark={theme === "dark"}
        isAdmin={isAdmin}
        currentPath={pathname}
      >
        {content}
        {toast && <Toast message={toast} />}
      </AppShell>
    </>
  );
};

const LoginPage = ({ navigate, onToast }: { navigate: (path: string) => void; onToast: (message: string) => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await login(email, password);
      authStorage.setSession(response.token, response.user ?? { email });
      onToast("Logged in");
      navigate("/dashboard");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Card>
        <PageHeader title="Login" subtitle="Sign in to KaseLog" />
        <form onSubmit={(event) => void handleSubmit(event)}>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          {error ? <p className="muted">{error}</p> : null}
          <Button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
        </form>
      </Card>
    </div>
  );
};

const Dashboard = ({
  onQuickCapture,
}: {
  onQuickCapture: (value: string) => void;
}) => {
  const [recentPages, setRecentPages] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickCaptureDraft, setQuickCaptureDraft] = useState("");

  useEffect(() => {
    void getRecentPages()
      .then((items) => setRecentPages(items))
      .catch((err: ApiError) => setError(err.status ? `Error ${err.status}: ${err.message}` : "Network error — check connection"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" />
      {loading ? <Card><Spinner /></Card> : null}
      {error ? <Card><p>{error}</p></Card> : null}
      {!loading && !error ? (
        <CardGrid>
          {recentPages.slice(0, 3).map((p) => (
            <Card key={p.id}>
              <MetadataLine>PAGE</MetadataLine>
              <h3>{p.title}</h3>
            </Card>
          ))}
        </CardGrid>
      ) : null}
      <Card>
        <MetadataLine>
          Open follow-ups <Badge tone="accent">{recentPages.filter((p) => p.followUp).length}</Badge>
        </MetadataLine>
      </Card>
      <Card>
        <h3>Quick capture</h3>
        <Textarea
          className="quick-capture-input"
          placeholder="Capture a thought, link, or note..."
          value={quickCaptureDraft}
          onChange={(event) => setQuickCaptureDraft(event.target.value)}
        />
        <div className="quick-capture-actions">
          <Button
            onClick={() => {
              const next = quickCaptureDraft.trim();
              if (!next) return;
              onQuickCapture(next);
              setQuickCaptureDraft("");
            }}
          >
            Capture
          </Button>
        </div>
      </Card>
    </div>
  );
};

const FollowUps = () => {
  const [open, setOpen] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getFollowUpPages()
      .then(setOpen)
      .catch((err: ApiError) => setError(err.status ? `Error ${err.status}: ${err.message}` : "Network error — check connection"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Card><Spinner /></Card>;
  if (error) return <Card><p>{error}</p></Card>;
  if (open.length === 0) {
    return (
      <Card className="followups-empty">
        <div className="followups-empty-check" aria-hidden="true">✓</div>
        <p className="followups-empty-title">No follow-ups</p>
        <p className="followups-empty-body">Everything is clear.</p>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Follow-ups" />
      {open.map((p) => (
        <Card key={p.id}>
          <h3>{p.title}</h3>
        </Card>
      ))}
    </div>
  );
};

const SearchPage = ({ query, navigate }: { query: string; navigate: (path: string) => void }) => {
  const [results, setResults] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    void searchPages(query)
      .then(setResults)
      .catch((err: ApiError) => setError(err.status ? `Error ${err.status}: ${err.message}` : "Network error — check connection"))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div>
      <PageHeader title="Search" subtitle={query ? `Results for "${query}"` : "Type a query above and press Search."} />
      {loading ? <Card><Spinner /></Card> : null}
      {error ? <Card><p>{error}</p></Card> : null}
      {!loading && !error && query && results.length === 0 ? <EmptyState title="No matches" body="Try a different search." /> : null}
      {!loading && !error && results.length > 0 ? (
        <CardGrid>
          {results.map((r) => (
            <Card key={r.id}>
              <MetadataLine>{r.kaseId ? "kase" : "loose end"}</MetadataLine>
              <h3>{r.title}</h3>
              <Button variant="ghost" onClick={() => navigate(`/logs/${r.id}`)}>Open</Button>
              <p>{r.content.slice(0, 90)}</p>
              <TagList tags={r.tags} />
            </Card>
          ))}
        </CardGrid>
      ) : null}
    </div>
  );
};

const fieldTypeOptions: ListFieldType[] = ["text", "number", "boolean", "date", "select"];

const ListsIndexPage = ({
  lists,
  navigate,
  onListsChange,
  onToast,
}: {
  lists: ListType[];
  navigate: (path: string) => void;
  onListsChange: (value: ListType[]) => void;
  onToast: (message: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [counts, setCounts] = useState<Record<string, { fields: number; entries: number }>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const items = await Promise.all(
        lists.map(async (list) => {
          try {
            const [fields, entries] = await Promise.all([getListFields(list.id), getListEntries(list.id)]);
            return [list.id, { fields: fields.length, entries: entries.length }] as const;
          } catch {
            return [list.id, { fields: 0, entries: 0 }] as const;
          }
        }),
      );
      if (!cancelled) {
        setCounts(Object.fromEntries(items));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lists]);

  const handleCreate = async () => {
    const nextName = name.trim();
    if (!nextName) return;
    try {
      const created = await createList(nextName);
      onListsChange([...lists, created]);
      setOpen(false);
      setName("");
      navigate(`/lists/${created.id}`);
    } catch {
      onToast("Failed to create list");
    }
  };

  return (
    <div>
      <PageHeader
        title="Lists"
        actions={<Button onClick={() => void createList("Untitled List").then((created) => { onListsChange([...lists, created]); navigate(`/lists/${created.id}`); }).catch(() => onToast("Failed to create list"))}>New List</Button>}
      />
      {lists.length === 0 ? (
        <EmptyState title="No lists yet" body="Create your first list to start tracking structured data." />
      ) : (
        <div className="index-grid">
          {lists.map((list) => (
            <Card key={list.id}>
              <h3>{list.name}</h3>
              <MetadataLine className={!list.description ? "fallback-description" : undefined}>{list.description || "No description"}</MetadataLine>
              <p className="muted">Fields: {counts[list.id]?.fields ?? 0}</p>
              <p className="muted">Entries: {counts[list.id]?.entries ?? 0}</p>
              <Button onClick={() => navigate(`/lists/${list.id}`)}>Open</Button>
            </Card>
          ))}
        </div>
      )}
      {open ? (
        <div className="dialog-backdrop">
          <Card className="modal-card">
            <h3>New List</h3>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="List name" />
            <div className="kase-create-row">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleCreate()}>Create</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

const ListDetailPage = ({
  list,
  fields,
  entries,
  logs,
  onListChange,
  onFieldsChange,
  onEntriesChange,
  onToast,
}: {
  list: ListType;
  fields: ListTypeField[];
  entries: ListEntry[];
  logs: Log[];
  onListChange: (value: ListType) => void;
  onFieldsChange: (value: ListTypeField[]) => void;
  onEntriesChange: (value: ListEntry[]) => void;
  onToast: (message: string) => void;
}) => {
  const [draftName, setDraftName] = useState(list.name);
  const [addingName, setAddingName] = useState("");
  const [addingType, setAddingType] = useState<ListFieldType>("text");
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState<string>("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const [selectOptions, setSelectOptions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setDraftName(list.name);
  }, [list.name]);

  const saveName = async () => {
    if (!draftName.trim() || draftName === list.name) return;
    try {
      onListChange(await updateList(list.id, { name: draftName.trim() }));
      onToast("List renamed");
    } catch {
      setDraftName(list.name);
      onToast("Failed to rename list");
    }
  };

  const persistSelectOptions = (next: Record<string, string[]>) => {
    setSelectOptions(next);
  };

  const addField = async () => {
    const fieldName = addingName.trim();
    if (!fieldName) return;
    try {
      const created = await createListField(list.id, {
        fieldName,
        fieldType: addingType,
        sortOrder: fields.length,
      });
      onFieldsChange([...fields, created]);
      setAddingName("");
      onToast("Field added");
    } catch {
      onToast("Failed to add field");
    }
  };

  const updateEntryCell = async (
    entryId: string,
    fieldId: string,
    value: string | number | boolean | null,
  ) => {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;

    const payload: Record<string, string | number | boolean | null> = {};
    for (const field of fields) {
      const existing = entry.values.find((item) => item.fieldId === field.id)?.value ?? null;
      payload[field.id] = existing;
    }
    payload[fieldId] = value;

    try {
      const updated = await updateEntry(entryId, payload);
      onEntriesChange(entries.map((item) => (item.id === entryId ? updated : item)));
    } catch {
      onToast("Failed to save cell");
    }
  };

  const addEntry = async () => {
    try {
      const created = await createListEntry(list.id);
      onEntriesChange([created, ...entries]);
      if (fields[0]) {
        setEditingCell(`${created.id}:${fields[0].id}`);
        setCellValue("");
      }
    } catch {
      onToast("Failed to create entry");
    }
  };

  const attachToPage = async (pageId: string) => {
    try {
      await attachListToPage(list.id, pageId);
      setAttachOpen(false);
      onToast("List attached to page");
    } catch {
      onToast("Failed to attach list");
    }
  };

  const matchingPages = logs.filter((page) => page.title.toLowerCase().includes(pageSearch.toLowerCase()));

  return (
    <div>
      <PageHeader
        title={list.name}
        actions={<div className="row"><Button variant="secondary" onClick={() => setAttachOpen(true)}>Attach to Log</Button><Button onClick={() => void addEntry()}>New Entry</Button></div>}
      />
      <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} onBlur={() => void saveName()} onKeyDown={(event) => event.key === "Enter" && void saveName()} />
      <div className="list-detail-layout">
        <Card className="list-fields-panel">
          <h3>Field Definitions</h3>
          {fields.map((field) => (
            <div key={field.id} className="list-field-row">
              <div>
                <strong>{field.fieldName}</strong>
                <div><Badge tone="accent">{field.fieldType}</Badge></div>
                {field.fieldType === "select" ? (
                  <SelectOptionManager
                    options={selectOptions[field.id] ?? []}
                    onChange={(options) => persistSelectOptions({ ...selectOptions, [field.id]: options })}
                  />
                ) : null}
              </div>
              <Button variant="danger" onClick={() => setDeleteFieldId(field.id)}>Delete</Button>
            </div>
          ))}
          <div className="list-add-field-form">
            <Input value={addingName} onChange={(event) => setAddingName(event.target.value)} placeholder="Field name" />
            <Select value={addingType} onChange={(event) => setAddingType(event.target.value as ListFieldType)}>
              {fieldTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </Select>
            <Button onClick={() => void addField()}>Add</Button>
          </div>
        </Card>
        <Card>
          <div className="list-table-wrap">
            <table className="list-table">
              <thead>
                <tr>
                  {fields.map((field) => <th key={field.id}>{field.fieldName}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    {fields.map((field) => {
                      const key = `${entry.id}:${field.id}`;
                      const isEditing = editingCell === key;
                      const currentValue = entry.values.find((value) => value.fieldId === field.id)?.value;
                      return (
                        <td key={field.id} onClick={() => { setEditingCell(key); setCellValue(currentValue == null ? "" : String(currentValue)); }}>
                          {isEditing ? (
                            <CellEditor
                              field={field}
                              value={cellValue}
                              options={selectOptions[field.id] ?? []}
                              onChange={setCellValue}
                              onBlur={() => {
                                setEditingCell(null);
                                const nextValue = field.fieldType === "number" ? (cellValue === "" ? null : Number(cellValue)) : field.fieldType === "boolean" ? cellValue === "true" : (cellValue || null);
                                void updateEntryCell(entry.id, field.id, nextValue);
                              }}
                              onEnter={() => {
                                setEditingCell(null);
                                const nextValue = field.fieldType === "number" ? (cellValue === "" ? null : Number(cellValue)) : field.fieldType === "boolean" ? cellValue === "true" : (cellValue || null);
                                void updateEntryCell(entry.id, field.id, nextValue);
                              }}
                            />
                          ) : (
                            <span>{String(currentValue ?? "")}</span>
                          )}
                        </td>
                      );
                    })}
                    <td><Button variant="danger" onClick={() => setDeleteEntryId(entry.id)}>Delete</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <ConfirmDialog
        open={Boolean(deleteFieldId)}
        title="Delete field"
        body="Delete this field definition?"
        onCancel={() => setDeleteFieldId(null)}
        onConfirm={() => {
          const fieldId = deleteFieldId;
          setDeleteFieldId(null);
          if (!fieldId) return;
          void (async () => {
            try {
              await deleteListField(list.id, fieldId);
              onFieldsChange(fields.filter((field) => field.id !== fieldId));
            } catch {
              onToast("Failed to delete field");
            }
          })();
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteEntryId)}
        title="Delete entry"
        body="Delete this entry?"
        onCancel={() => setDeleteEntryId(null)}
        onConfirm={() => {
          const entryId = deleteEntryId;
          setDeleteEntryId(null);
          if (!entryId) return;
          void (async () => {
            try {
              await deleteEntry(entryId);
              onEntriesChange(entries.filter((entry) => entry.id !== entryId));
            } catch {
              onToast("Failed to delete entry");
            }
          })();
        }}
      />
      {attachOpen ? (
        <div className="dialog-backdrop">
          <Card className="modal-card">
            <h3>Attach to Log</h3>
            <Input placeholder="Search logs" value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} />
            <div className="attach-page-results">
              {matchingPages.map((page) => (
                <div key={page.id} className="row">
                  <span>{page.title}</span>
                  <Button onClick={() => void attachToPage(page.id)}>Attach</Button>
                </div>
              ))}
            </div>
            <Button variant="secondary" onClick={() => setAttachOpen(false)}>Close</Button>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

const SelectOptionManager = ({
  options,
  onChange,
}: {
  options: string[];
  onChange: (value: string[]) => void;
}) => {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="chip-list">
        {options.map((option) => (
          <span key={option} className="tag-chip">
            {option}
            <button type="button" onClick={() => onChange(options.filter((item) => item !== option))}>✕</button>
          </span>
        ))}
      </div>
      <div className="row">
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add option" />
        <Button
          variant="secondary"
          onClick={() => {
            const value = draft.trim();
            if (!value || options.includes(value)) return;
            onChange([...options, value]);
            setDraft("");
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
};

const CellEditor = ({
  field,
  value,
  options,
  onChange,
  onBlur,
  onEnter,
}: {
  field: ListTypeField;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onBlur: () => void;
  onEnter: () => void;
}) => {
  if (field.fieldType === "boolean") {
    return (
      <Checkbox
        checked={value === "true"}
        onChange={(event) => {
          onChange(String(event.target.checked));
          onEnter();
        }}
      />
    );
  }

  if (field.fieldType === "select") {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur}>
        <option value="">--</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </Select>
    );
  }

  return (
    <Input
      autoFocus
      type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={(event) => event.key === "Enter" && onEnter()}
    />
  );
};
const KasesPage = ({
  kases,
  navigate,
  onKasesChange,
  onToast,
}: {
  kases: Kase[];
  navigate: (path: string) => void;
  onKasesChange: (value: Kase[]) => void;
  onToast: (message: string) => void;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createNewKase = async () => {
    const shelfName = name.trim() || "Untitled Kase";
    const shelfDescription = description.trim();

    try {
      const created = await createKase({ name: shelfName, description: shelfDescription });
      onKasesChange([...kases, created]);
      setName("");
      setDescription("");
      onToast("Kase created");
    } catch {
      onToast("Failed to create kase");
    }
  };

  return (
    <div>
      <PageHeader
        title="Kases"
        actions={
          <div className="kase-create-row">
            <Input
              placeholder="Kase name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              placeholder="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Button onClick={() => void createNewKase()}>New Kase</Button>
          </div>
        }
      />
      <CardGrid>
        {kases.map((kase) => (
          <Card key={kase.id}>
            <h3>{kase.name}</h3>
            <p>{kase.description || "No description"}</p>
            <Button onClick={() => navigate(`/kases/${kase.id}`)}>Open</Button>
          </Card>
        ))}
      </CardGrid>
    </div>
  );
};

const KaseDetailPage = ({
  kase,
  logs,
  navigate,
  onLogCreated,
  onToast,
}: {
  kase: Kase;
  logs: Log[];
  navigate: (path: string) => void;
  onLogCreated: (log: Log) => void;
  onToast: (message: string) => void;
}) => {
  const [creating, setCreating] = useState(false);

  const createNewPage = async () => {
    setCreating(true);
    try {
      const created = await createKaseLog(kase.id, { title: "Untitled" });
      onLogCreated(created);
      onToast("Log created");
      navigate(`/logs/${created.id}`);
    } catch (error) {
      const apiError = error as ApiError;
      onToast(apiError.message || "Failed to create log");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={kase.name}
        actions={<Button disabled={creating} onClick={() => void createNewPage()}>{creating ? "Creating..." : "New Log"}</Button>}
      />
      {logs.length === 0 ? (
        <Card className="empty-state-card">
          <div className="empty-state-icon" aria-hidden>📄</div>
          <h3>No logs yet</h3>
          <p className="muted">Create your first log</p>
          <Button onClick={() => void createNewPage()}>Create your first log</Button>
        </Card>
      ) : (
        <CardGrid>
          {logs.map((page) => {
            const overflow = Math.max(page.tags.length - 3, 0);
            return (
              <Card key={page.id}>
                <button
                  type="button"
                  className="card-link-title"
                  onClick={() => navigate(`/logs/${page.id}`)}
                >
                  <h3>{page.title}</h3>
                </button>
                <MetadataLine>Updated {formatDate(page.updatedAt)}</MetadataLine>
                <div className="row">
                  <Badge tone={page.visibility === "public" ? "accent" : "neutral"}>
                    {page.visibility === "public" ? "Public" : "Private"}
                  </Badge>
                  {page.followUp ? <Badge tone="warning">Follow-up</Badge> : null}
                </div>
                <div className="tag-list">
                  {page.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="tag-chip">{tag}</span>
                  ))}
                  {overflow > 0 ? <span className="tag-chip">+{overflow} more</span> : null}
                </div>
              </Card>
            );
          })}
        </CardGrid>
      )}
    </div>
  );
};

const formatDate = (isoDate: string) => new Date(isoDate).toLocaleString();

const PageEditor = ({
  page,
  logs,
  setPages,
  navigate,
  onToast,
}: {
  page: Log;
  logs: Log[];
  setPages: (v: Log[]) => void;
  navigate: (path: string) => void;
  onToast: (message: string) => void;
}) => {
  const [draft, setDraft] = useState(page);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [lastSavedDraft, setLastSavedDraft] = useState(page);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [visibilitySaved, setVisibilitySaved] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(page), [page]);
  useEffect(() => setLastSavedDraft(page), [page]);
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== draft.content) {
      editorRef.current.innerHTML = draft.content;
    }
  }, [draft.content]);

  useEffect(() => {
    if (!visibilitySaved) return;
    const id = window.setTimeout(() => setVisibilitySaved(false), 1000);
    return () => window.clearTimeout(id);
  }, [visibilitySaved]);

  const savePageAndStore = (nextDraft: Log) => {
    const nextPages = logs.map((p) => (p.id === nextDraft.id ? nextDraft : p));
    setPages(nextPages);
    setLastSavedDraft(nextDraft);
  };

  const persistDraft = async (nextDraft: Log) => {
    setSaveState("saving");
    try {
      await updatePage(nextDraft.id, { content: nextDraft.content });
      savePageAndStore(nextDraft);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  useEffect(() => {
    if (draft.content === lastSavedDraft.content) return;
    const id = window.setTimeout(() => {
      void persistDraft(draft);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [draft.content, draft, lastSavedDraft.content]);

  const saveSingleField = async (changes: Partial<Log>) => {
    const nextDraft = {
      ...draft,
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    setDraft(nextDraft);
    try {
      await updatePage(nextDraft.id, changes);
      savePageAndStore(nextDraft);
      return true;
    } catch {
      return false;
    }
  };

  const commitTitle = async () => {
    if (draft.title === lastSavedDraft.title) {
      setIsTitleEditing(false);
      return;
    }
    const saved = await saveSingleField({
      title: draft.title.trim() || "Untitled",
    });
    if (saved) setIsTitleEditing(false);
  };

  const upsertTags = async (nextTags: string[]) => {
    const normalized = [
      ...new Set(
        nextTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    await saveSingleField({ tags: normalized });
  };

  const consumeTagInput = async () => {
    if (!tagInput.trim()) return;
    const pendingTags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    setTagInput("");
    await upsertTags([...draft.tags, ...pendingTags]);
  };

  const handleTagKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      await consumeTagInput();
    }
  };

  const handleVisibilityChange = async (nextVisibility: Log["visibility"]) => {
    const saved = await saveSingleField({ visibility: nextVisibility });
    if (saved) setVisibilitySaved(true);
  };

  const handleFollowUpChange = async (checked: boolean) => {
    await saveSingleField({ followUp: checked });
  };

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await uploadPageAttachment(draft.id, file);
      const nextDraft = {
        ...draft,
        attachments: [
          ...draft.attachments,
          { id: crypto.randomUUID(), fileName: file.name },
        ],
        updatedAt: new Date().toISOString(),
      };
      setDraft(nextDraft);
      savePageAndStore(nextDraft);
      onToast("Attachment uploaded");
    } catch {
      onToast("Attachment upload failed");
    } finally {
      event.target.value = "";
    }
  };

  const removeAttachment = (attachmentId: string) => {
    const nextDraft = {
      ...draft,
      attachments: draft.attachments.filter(
        (attachment) => attachment.id !== attachmentId,
      ),
      updatedAt: new Date().toISOString(),
    };
    setDraft(nextDraft);
    savePageAndStore(nextDraft);
  };

  const confirmDelete = async () => {
    try {
      await deletePage(draft.id);
      const nextPages = logs.filter((p) => p.id !== draft.id);
      setPages(nextPages);
      setConfirmDeleteOpen(false);
      navigate(
        draft.kaseId ? `/kases/${draft.kaseId}` : "/loose-ends",
      );
    } catch {
      onToast("Delete failed");
      setConfirmDeleteOpen(false);
    }
  };

  const runCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    const html = editorRef.current?.innerHTML ?? "";
    setDraft((previous) => ({ ...previous, content: html }));
  };

  const parseInlineMarkdown = (line: string): string => {
    let out = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/__(.+?)__/g, "<strong>$1</strong>");
    out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
    out = out.replace(/_(.+?)_/g, "<em>$1</em>");
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return out;
  };

  const markdownToHtml = (value: string): string => {
    const lines = value.split(/\r?\n/);
    const html: string[] = [];
    let inUl = false;
    let inOl = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (inUl) {
          html.push("</ul>");
          inUl = false;
        }
        if (inOl) {
          html.push("</ol>");
          inOl = false;
        }
        continue;
      }

      const heading = line.match(/^(#{1,3})\s+(.+)/);
      if (heading) {
        if (inUl) {
          html.push("</ul>");
          inUl = false;
        }
        if (inOl) {
          html.push("</ol>");
          inOl = false;
        }
        const level = heading[1].length;
        html.push(`<h${level}>${parseInlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      const listItem = line.match(/^[-*]\s+(.+)/);
      if (listItem) {
        if (inOl) {
          html.push("</ol>");
          inOl = false;
        }
        if (!inUl) {
          html.push("<ul>");
          inUl = true;
        }
        html.push(`<li>${parseInlineMarkdown(listItem[1])}</li>`);
        continue;
      }

      const ordered = line.match(/^\d+\.\s+(.+)/);
      if (ordered) {
        if (inUl) {
          html.push("</ul>");
          inUl = false;
        }
        if (!inOl) {
          html.push("<ol>");
          inOl = true;
        }
        html.push(`<li>${parseInlineMarkdown(ordered[1])}</li>`);
        continue;
      }

      if (line.startsWith("> ")) {
        if (inUl) {
          html.push("</ul>");
          inUl = false;
        }
        if (inOl) {
          html.push("</ol>");
          inOl = false;
        }
        html.push(`<blockquote>${parseInlineMarkdown(line.slice(2))}</blockquote>`);
        continue;
      }

      html.push(`<p>${parseInlineMarkdown(line)}</p>`);
    }

    if (inUl) html.push("</ul>");
    if (inOl) html.push("</ol>");
    return html.join("");
  };

  const handlePasteMarkdown = (event: ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text || !/^(#{1,6}|[-*]\s|\d+\.\s|>\s|\*\*|`)/m.test(text)) {
      return;
    }

    event.preventDefault();
    const html = markdownToHtml(text);
    document.execCommand("insertHTML", false, html);
    const next = editorRef.current?.innerHTML ?? "";
    setDraft((previous) => ({ ...previous, content: next }));
  };

  return (
    <div>
      <MetadataLine>Home / Kase / {page.title}</MetadataLine>
      <PageHeader
        title={page.title}
        actions={
          <div className="row">
            <span className="save-indicator">
              {saveState === "saving"
                ? "Saving..."
                : saveState === "error"
                  ? "Save failed"
                  : "Saved"}
            </span>
            <Button onClick={() => void persistDraft(draft)}>Save</Button>
            <Button
              variant="secondary"
              onClick={() => setDraft(lastSavedDraft)}
            >
              Cancel
            </Button>
          </div>
        }
      />
      <div className="editor-layout">
        <Card>
          <div className="editor-shell">
            <div className="editor-toolbar">
              <div className="toolbar-group">
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("bold")}
                >
                  B
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("italic")}
                >
                  I
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("underline")}
                >
                  U
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("strikeThrough")}
                >
                  S
                </button>
              </div>
              <div className="toolbar-divider" />
              <div className="toolbar-group">
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("formatBlock", "<h1>")}
                >
                  H1
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("formatBlock", "<h2>")}
                >
                  H2
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("formatBlock", "<h3>")}
                >
                  H3
                </button>
              </div>
              <div className="toolbar-divider" />
              <div className="toolbar-group">
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("insertUnorderedList")}
                >
                  • List
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("insertOrderedList")}
                >
                  1. List
                </button>
              </div>
              <div className="toolbar-divider" />
              <div className="toolbar-group">
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("formatBlock", "<blockquote>")}
                >
                  ❝
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("formatBlock", "<pre>")}
                >
                  Code
                </button>
              </div>
              <div className="toolbar-divider" />
              <div className="toolbar-group">
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("justifyLeft")}
                >
                  L
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("justifyCenter")}
                >
                  C
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("justifyRight")}
                >
                  R
                </button>
              </div>
              <div className="toolbar-divider" />
              <div className="toolbar-group">
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => {
                    const link = window.prompt("Enter URL", "https://");
                    if (link) runCommand("createLink", link);
                  }}
                >
                  Link
                </button>
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={() => runCommand("removeFormat")}
                >
                  Clear
                </button>
              </div>
            </div>
            <div
              ref={editorRef}
              className="editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Start writing..."
              onInput={(e) =>
                setDraft({
                  ...draft,
                  content: (e.target as HTMLDivElement).innerHTML,
                })
              }
              onPaste={handlePasteMarkdown}
            >
              {draft.content}
            </div>
          </div>
        </Card>
        <div className="page-meta-panel">
          <Card>
            <h3>Metadata</h3>
            {isTitleEditing ? (
              <Input
                value={draft.title}
                autoFocus
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                onBlur={() => void commitTitle()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitTitle();
                  }
                  if (e.key === "Escape") {
                    setDraft({ ...draft, title: lastSavedDraft.title });
                    setIsTitleEditing(false);
                  }
                }}
              />
            ) : (
              <h1
                className="editable-title"
                role="button"
                tabIndex={0}
                onClick={() => setIsTitleEditing(true)}
                onKeyDown={(e) => e.key === "Enter" && setIsTitleEditing(true)}
              >
                {draft.title}
              </h1>
            )}
            <MetadataLine>Created: {formatDate(draft.createdAt)}</MetadataLine>
            <MetadataLine>Modified: {formatDate(draft.updatedAt)}</MetadataLine>
            <label className="meta-label">Tags</label>
            <div className="chip-list">
              {draft.tags.map((tag) => (
                <span className="tag-chip" key={tag}>
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove ${tag}`}
                    onClick={() =>
                      void upsertTags(draft.tags.filter((item) => item !== tag))
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <Input
              value={tagInput}
              placeholder="Add tags (comma separated)"
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={() => void consumeTagInput()}
              onKeyDown={(e) => void handleTagKeyDown(e)}
            />
            <label className="meta-label">Visibility</label>
            <div className="row">
              <Select
                value={draft.visibility}
                onChange={(e) =>
                  void handleVisibilityChange(
                    e.target.value as Log["visibility"],
                  )
                }
              >
                <option value="private">private</option>
                <option value="internal">internal</option>
                <option value="public">public</option>
              </Select>
              {visibilitySaved ? (
                <span className="save-indicator">Saved</span>
              ) : null}
            </div>
            <label>
              <Checkbox
                checked={draft.followUp}
                onChange={(e) => void handleFollowUpChange(e.target.checked)}
              />{" "}
              Follow-up flag
            </label>
            <div className="meta-attachments">
              <p>Attachments count: {draft.attachments.length}</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden-file-input"
                onChange={(e) => void handleFilePick(e)}
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                + Attach file
              </Button>
              <div className="attachment-list">
                {draft.attachments.map((attachment) => (
                  <div className="attachment-row" key={attachment.id}>
                    <span>{attachment.fileName}</span>
                    <Button
                      variant="ghost"
                      onClick={() => removeAttachment(attachment.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
              Delete page
            </Button>
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this page?"
        body="This cannot be undone."
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "apikeys">("profile");
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [isEmailEditing, setIsEmailEditing] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailPassword, setEmailPassword] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ qrCode: string; secret: string } | null>(null);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [disableTwoFactorConfirmOpen, setDisableTwoFactorConfirmOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>>([]);
  const [apiKeyToRevoke, setApiKeyToRevoke] = useState<string | null>(null);
  const [isCreateKeyModalOpen, setIsCreateKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<{ id: string; name: string; key: string; createdAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const initials = (profile?.fullName ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

  const formatDate = (value?: string | null) => {
    if (!value) return "Never";
    return new Date(value).toLocaleString();
  };

  const setTabFromPath = () => {
    const path = window.location.pathname;
    if (path.startsWith("/settings/security")) {
      setActiveTab("security");
      return;
    }
    if (path.startsWith("/settings/apikeys")) {
      setActiveTab("apikeys");
      return;
    }
    setActiveTab("profile");
  };

  useEffect(() => {
    setTabFromPath();

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [profileResponse, keyResponse] = await Promise.all([
          getProfile(),
          getApiKeys(),
        ]);
        setProfile(profileResponse);
        setFirstName(profileResponse.firstName ?? "");
        setLastName(profileResponse.lastName ?? "");
        setEmailDraft(profileResponse.email ?? "");
        setApiKeys(keyResponse);
      } catch {
        setError("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(id);
  }, [notice]);

  const saveName = async () => {
    if (!profile) return;
    try {
      const updated = await updateProfileName(profile.id, firstName.trim(), lastName.trim());
      setProfile(updated);
      setNotice("Name updated");
    } catch {
      setError("Unable to save name.");
    }
  };

  const saveEmail = async () => {
    if (!profile) return;
    try {
      await updateProfileEmail(profile.id, emailDraft.trim());
      setProfile((current: ProfileResponse | null) => (current ? { ...current, email: emailDraft.trim() } : current));
      setIsEmailEditing(false);
      setIsEmailModalOpen(false);
      setEmailPassword("");
      setNotice("Email updated");
    } catch {
      setError("Unable to update email. Check your password.");
    }
  };

  const savePassword = async () => {
    const nextErrors: Record<string, string> = {};
    if (!passwordForm.currentPassword) nextErrors.currentPassword = "Current password is required.";
    if (!passwordForm.newPassword) nextErrors.newPassword = "New password is required.";
    if (passwordForm.newPassword.length < 8) nextErrors.newPassword = "Minimum length is 8 characters.";
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await updateProfilePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setNotice("Password updated");
    } catch {
      setError("Unable to update password.");
    }
  };

  const startTwoFactorEnrollment = async () => {
    try {
      const response = await getTwoFactorSetup();
      setTwoFactorSetup(response);
    } catch {
      setError("Unable to start 2FA setup.");
    }
  };

  const completeTwoFactorEnrollment = async () => {
    try {
      await enableTwoFactor(twoFactorToken);
      setProfile((current: ProfileResponse | null) => (current ? { ...current, twoFactorEnabled: true } : current));
      setTwoFactorSetup(null);
      setTwoFactorToken("");
      setNotice("2FA enabled");
    } catch {
      setError("Invalid 2FA token.");
    }
  };

  const disable2fa = async () => {
    try {
      await disableTwoFactor();
      setProfile((current: ProfileResponse | null) => (current ? { ...current, twoFactorEnabled: false } : current));
      setNotice("2FA disabled");
    } catch {
      setError("Unable to disable 2FA.");
    }
  };


  const revokeKey = async () => {
    if (!apiKeyToRevoke) return;
    try {
      await revokeApiKey(apiKeyToRevoke);
      setApiKeys((current) => current.filter((item) => item.id !== apiKeyToRevoke));
      setApiKeyToRevoke(null);
      setNotice("API key revoked");
    } catch {
      setError("Unable to revoke API key.");
    }
  };

  const generateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const nextKey = await createApiKey(newKeyName.trim());
      setCreatedKey(nextKey);
      setIsCreateKeyModalOpen(false);
      setNewKeyName("");
      setApiKeys((current) => [...current, { id: nextKey.id, name: nextKey.name, createdAt: nextKey.createdAt, lastUsedAt: null }]);
    } catch {
      setError("Unable to create API key.");
    }
  };

  const copyCreatedKey = async () => {
    if (!createdKey?.key) return;
    await navigator.clipboard.writeText(createdKey.key);
    setNotice("API key copied");
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, account security, and API keys." />
      <div className="settings-tabs" role="tablist" aria-label="Settings tabs">
        <button
          className={`settings-tab ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
          role="tab"
          type="button"
        >
          Profile
        </button>
        <button
          className={`settings-tab ${activeTab === "security" ? "active" : ""}`}
          onClick={() => setActiveTab("security")}
          role="tab"
          type="button"
        >
          Security
        </button>
        <button
          className={`settings-tab ${activeTab === "apikeys" ? "active" : ""}`}
          onClick={() => setActiveTab("apikeys")}
          role="tab"
          type="button"
        >
          API Keys
        </button>
      </div>
      {error ? <Card className="settings-error">{error}</Card> : null}
      {loading ? <Card>Loading settings…</Card> : null}
      {!loading && profile && activeTab === "profile" ? (
        <Card>
          <div className="settings-profile-head">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Profile avatar" className="profile-avatar-image" />
            ) : (
              <div className="profile-avatar-initials">{initials}</div>
            )}
            <div>
              <h3>Profile</h3>
              <p className="muted">Update your name and email address.</p>
            </div>
          </div>
          <div className="settings-form-grid">
            <label>
              <span className="meta-line">First name</span>
              <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </label>
            <label>
              <span className="meta-line">Last name</span>
              <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </label>
            <div className="row settings-actions">
              <Button onClick={() => void saveName()}>Save</Button>
            </div>
            <label>
              <span className="meta-line">Email</span>
              <Input
                value={emailDraft}
                readOnly={!isEmailEditing}
                onChange={(event) => setEmailDraft(event.target.value)}
              />
            </label>
            <p className="muted">Requires password confirmation.</p>
            <div className="row settings-actions">
              {!isEmailEditing ? (
                <Button variant="secondary" onClick={() => setIsEmailEditing(true)}>Edit</Button>
              ) : (
                <Button onClick={() => setIsEmailModalOpen(true)}>Save email</Button>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {!loading && activeTab === "security" ? (
        <div>
          <Card>
            <h3>Change password</h3>
            <div className="settings-form-grid">
              <label>
                <span className="meta-line">Current password</span>
                <Input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                  }
                />
                {passwordErrors.currentPassword ? <p className="field-error">{passwordErrors.currentPassword}</p> : null}
              </label>
              <label>
                <span className="meta-line">New password</span>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                  }
                />
                {passwordErrors.newPassword ? <p className="field-error">{passwordErrors.newPassword}</p> : null}
              </label>
              <label>
                <span className="meta-line">Confirm new password</span>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                />
                {passwordErrors.confirmPassword ? <p className="field-error">{passwordErrors.confirmPassword}</p> : null}
              </label>
              <div>
                <Button onClick={() => void savePassword()}>Save password</Button>
              </div>
            </div>
          </Card>
          <Card>
            <h3>Two-factor authentication</h3>
            {profile?.twoFactorEnabled ? (
              <div>
                <p>2FA is active ✓</p>
                <Button variant="danger" onClick={() => setDisableTwoFactorConfirmOpen(true)}>Disable 2FA</Button>
              </div>
            ) : (
              <div>
                <Button onClick={() => void startTwoFactorEnrollment()}>Enroll in 2FA</Button>
                {twoFactorSetup ? (
                  <div className="twofa-setup">
                    <img src={twoFactorSetup.qrCode} alt="2FA QR code" className="twofa-qr" />
                    <p>Manual key: <code>{twoFactorSetup.secret}</code></p>
                    <Input
                      placeholder="Enter TOTP code"
                      value={twoFactorToken}
                      onChange={(event) => setTwoFactorToken(event.target.value)}
                    />
                    <Button onClick={() => void completeTwoFactorEnrollment()}>Enable 2FA</Button>
                  </div>
                ) : null}
              </div>
            )}
          </Card>
          <Card>
            <h3>Active sessions</h3>
            <p className="muted">Session management coming soon.</p>
          </Card>
        </div>
      ) : null}

      {!loading && activeTab === "apikeys" ? (
        <Card>
          <div className="row settings-keys-header">
            <h3>API keys</h3>
            <Button onClick={() => setIsCreateKeyModalOpen(true)}>Generate New Key</Button>
          </div>
          {apiKeys.length === 0 ? (
            <p className="muted">No API keys yet. Generate one to begin authenticating with the API.</p>
          ) : (
            apiKeys.map((key) => (
              <div className="settings-list-row" key={key.id}>
                <div>
                  <p>{key.name}</p>
                  <p className="muted">Created {formatDate(key.createdAt)} · Last used {formatDate(key.lastUsedAt)}</p>
                </div>
                <Button variant="danger" onClick={() => setApiKeyToRevoke(key.id)}>Revoke</Button>
              </div>
            ))
          )}
        </Card>
      ) : null}

      {notice ? <Toast message={notice} /> : null}

      <ConfirmDialog
        open={Boolean(apiKeyToRevoke)}
        title="Revoke API key"
        body="This key will stop working immediately."
        onCancel={() => setApiKeyToRevoke(null)}
        onConfirm={() => void revokeKey()}
      />
      <ConfirmDialog
        open={disableTwoFactorConfirmOpen}
        title="Disable 2FA"
        body="Are you sure you want to disable two-factor authentication?"
        onCancel={() => setDisableTwoFactorConfirmOpen(false)}
        onConfirm={() => {
          setDisableTwoFactorConfirmOpen(false);
          void disable2fa();
        }}
      />

      {isEmailModalOpen ? (
        <div className="dialog-backdrop">
          <div className="card settings-modal">
            <h3>Confirm your password</h3>
            <p className="muted">Enter your current password to update email.</p>
            <Input
              type="password"
              value={emailPassword}
              onChange={(event) => setEmailPassword(event.target.value)}
              placeholder="Current password"
            />
            <div className="row">
              <Button variant="secondary" onClick={() => setIsEmailModalOpen(false)}>Cancel</Button>
              <Button onClick={() => void saveEmail()}>Confirm</Button>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateKeyModalOpen ? (
        <div className="dialog-backdrop">
          <div className="card settings-modal">
            <h3>Generate API key</h3>
            <Input
              value={newKeyName}
              onChange={(event) => setNewKeyName(event.target.value)}
              placeholder="Key name"
            />
            <div className="row">
              <Button variant="secondary" onClick={() => setIsCreateKeyModalOpen(false)}>Cancel</Button>
              <Button onClick={() => void generateKey()}>Create key</Button>
            </div>
          </div>
        </div>
      ) : null}

      {createdKey ? (
        <div className="dialog-backdrop">
          <div className="card settings-modal">
            <h3>New API key created</h3>
            <p className="muted">This key will not be shown again.</p>
            <pre className="key-preview">{createdKey.key}</pre>
            <div className="row">
              <Button variant="secondary" onClick={() => void copyCreatedKey()}>Copy</Button>
              <Button onClick={() => setCreatedKey(null)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};


const AdminUsers = ({
  navigate,
  isAdmin,
  selectedId,
  currentRoute,
  onToast,
}: {
  navigate: (path: string) => void;
  isAdmin: boolean;
  selectedId?: string;
  currentRoute: string;
  onToast: (value: string) => void;
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const [newForm, setNewForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "member" as "admin" | "member",
  });
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "member" as "admin" | "member",
    enabled: true,
  });
  const [editUserName, setEditUserName] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin || currentRoute !== "/admin/users") {
      return;
    }

    const loadUsers = async () => {
      setLoading(true);
      setError("");
      try {
        setUsers(await getAdminUsers());
      } catch {
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    void loadUsers();
  }, [currentRoute, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !selectedId || currentRoute !== "/admin/users/:id") {
      return;
    }

    const loadUser = async () => {
      setLoading(true);
      setError("");
      try {
        const user = await getAdminUser(selectedId);
        setEditUserName(user.name || `${user.firstName} ${user.lastName}`.trim());
        setEditForm({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          enabled: user.enabled,
        });
      } catch {
        setError("Failed to load user");
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, [currentRoute, isAdmin, selectedId]);

  if (!isAdmin) {
    return <EmptyState title="Forbidden" body="Admin only" />;
  }

  const validateUserForm = (input: { firstName: string; lastName: string; email: string; password?: string }) => {
    if (!input.firstName.trim() || !input.lastName.trim() || !input.email.trim()) {
      return "All fields are required";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      return "Please provide a valid email address";
    }

    if (typeof input.password === "string" && input.password.length < 8) {
      return "Password must be at least 8 characters";
    }

    return "";
  };

  const formatLastLogin = (value: string | null) => (value ? new Date(value).toLocaleString() : "Never");

  if (currentRoute === "/admin/users/new") {
    return (
      <div>
        <PageHeader title="New user" />
        <Card className="admin-form-card">
          <label className="meta-label" htmlFor="new-user-name">
            First name
          </label>
          <Input
            id="new-user-first-name"
            value={newForm.firstName}
            onChange={(event) => setNewForm((previous) => ({ ...previous, firstName: event.target.value }))}
          />

          <label className="meta-label" htmlFor="new-user-last-name">
            Last name
          </label>
          <Input
            id="new-user-last-name"
            value={newForm.lastName}
            onChange={(event) => setNewForm((previous) => ({ ...previous, lastName: event.target.value }))}
          />

          <label className="meta-label" htmlFor="new-user-email">
            Email
          </label>
          <Input
            id="new-user-email"
            type="email"
            value={newForm.email}
            onChange={(event) => setNewForm((previous) => ({ ...previous, email: event.target.value }))}
          />

          <label className="meta-label" htmlFor="new-user-password">
            Password
          </label>
          <Input
            id="new-user-password"
            type="password"
            value={newForm.password}
            onChange={(event) =>
              setNewForm((previous) => ({ ...previous, password: event.target.value }))
            }
          />

          <label className="meta-label" htmlFor="new-user-role">
            Role
          </label>
          <Select
            id="new-user-role"
            value={newForm.role}
            onChange={(event) =>
              setNewForm((previous) => ({
                ...previous,
                role: event.target.value as "admin" | "member",
              }))
            }
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </Select>

          <div className="row">
            <Button
              onClick={() => {
                void (async () => {
                  const validationError = validateUserForm(newForm);
                  if (validationError) {
                    onToast(validationError);
                    return;
                  }

                  try {
                    await createAdminUser({
                      firstName: newForm.firstName.trim(),
                      lastName: newForm.lastName.trim(),
                      email: newForm.email.trim(),
                      password: newForm.password,
                      role: newForm.role,
                    });
                    onToast("User created");
                    navigate("/admin/users");
                  } catch {
                    onToast("Failed to create user");
                  }
                })();
              }}
            >
              Create user
            </Button>
            <Button variant="secondary" onClick={() => navigate("/admin/users")}>
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (currentRoute === "/admin/users/:id" && selectedId) {
    return (
      <div>
        <PageHeader title="Edit user" />
        <Card className="admin-form-card">
          {loading ? <p className="muted">Loading user…</p> : null}
          {error ? <p className="muted">{error}</p> : null}

          <label className="meta-label" htmlFor="edit-user-name">
            First name
          </label>
          <Input
            id="edit-user-first-name"
            value={editForm.firstName}
            onChange={(event) => setEditForm((previous) => ({ ...previous, firstName: event.target.value }))}
          />

          <label className="meta-label" htmlFor="edit-user-last-name">
            Last name
          </label>
          <Input
            id="edit-user-last-name"
            value={editForm.lastName}
            onChange={(event) => setEditForm((previous) => ({ ...previous, lastName: event.target.value }))}
          />

          <label className="meta-label" htmlFor="edit-user-email">
            Email
          </label>
          <Input
            id="edit-user-email"
            type="email"
            value={editForm.email}
            onChange={(event) =>
              setEditForm((previous) => ({ ...previous, email: event.target.value }))
            }
          />

          <label className="meta-label" htmlFor="edit-user-role">
            Role
          </label>
          <Select
            id="edit-user-role"
            value={editForm.role}
            onChange={(event) =>
              setEditForm((previous) => ({
                ...previous,
                role: event.target.value as "admin" | "member",
              }))
            }
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </Select>

          <label className="row admin-enabled-toggle">
            <Checkbox
              checked={editForm.enabled}
              onChange={(event) =>
                setEditForm((previous) => ({ ...previous, enabled: event.target.checked }))
              }
            />
            Enabled
          </label>

          <div className="row admin-actions-row">
            <Button
              onClick={() => {
                void (async () => {
                  const validationError = validateUserForm(editForm);
                  if (validationError) {
                    onToast(validationError);
                    return;
                  }

                  try {
                    await updateAdminUser(selectedId, {
                      firstName: editForm.firstName.trim(),
                      lastName: editForm.lastName.trim(),
                      email: editForm.email.trim(),
                      role: editForm.role,
                      enabled: editForm.enabled,
                    });
                    onToast("User saved");
                    navigate("/admin/users");
                  } catch {
                    onToast("Failed to save user");
                  }
                })();
              }}
            >
              Save
            </Button>
            <Button variant="secondary" onClick={() => navigate("/admin/users")}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirmDelete({ id: selectedId, firstName: editForm.firstName.trim(), lastName: editForm.lastName.trim(), name: editUserName, email: editForm.email, role: editForm.role, enabled: editForm.enabled, lastLoginAt: null })}
            >
              Delete
            </Button>
          </div>
        </Card>
        <ConfirmDialog
          open={Boolean(confirmDelete)}
          title={confirmDelete ? `Delete user ${confirmDelete.name}?` : "Delete user"}
          body="This cannot be undone."
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            void (async () => {
              if (!confirmDelete) {
                return;
              }

              try {
                await deleteAdminUser(confirmDelete.id);
                onToast("User deleted");
                navigate("/admin/users");
              } catch {
                onToast("Cannot delete the last admin account");
              } finally {
                setConfirmDelete(null);
              }
            })();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="User management"
        actions={<Button onClick={() => navigate("/admin/users/new")}>New User</Button>}
      />
      {loading ? <p className="muted">Loading users…</p> : null}
      {error ? <p className="muted">{error}</p> : null}

      <Card className="admin-users-table-wrap">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <Badge tone={user.role === "admin" ? "accent" : "neutral"}>{user.role}</Badge>
                </td>
                <td>
                  <Badge tone={user.enabled ? "success" : "warning"}>
                    {user.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </td>
                <td>{formatLastLogin(user.lastLoginAt)}</td>
                <td>
                  <div className="row admin-table-actions">
                    <Button variant="ghost" onClick={() => navigate(`/admin/users/${user.id}`)}>
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void (async () => {
                          try {
                            await toggleAdminUserStatus(user.id, !user.enabled);
                            setUsers((previous) =>
                              previous.map((item) =>
                                item.id === user.id ? { ...item, enabled: !item.enabled } : item,
                              ),
                            );
                          } catch {
                            onToast("Failed to update user status");
                          }
                        })();
                      }}
                    >
                      {user.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="danger" onClick={() => setConfirmDelete(user)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={confirmDelete ? `Delete user ${confirmDelete.name}?` : "Delete user"}
        body="This cannot be undone."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          void (async () => {
            if (!confirmDelete) {
              return;
            }

            try {
              await deleteAdminUser(confirmDelete.id);
              setUsers((previous) => previous.filter((item) => item.id !== confirmDelete.id));
              onToast("User deleted");
            } catch {
              onToast("Cannot delete the last admin account");
            } finally {
              setConfirmDelete(null);
            }
          })();
        }}
      />
    </div>
  );
};

const ComponentShowcase = () => (
  <div>
    <PageHeader title="/dev/components" subtitle="Design system showcase" />
    <CardGrid>
      <Card>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
      </Card>
      <Card>
        <Input placeholder="Input" />
        <Textarea placeholder="Textarea" />
        <Select>
          <option>Option</option>
        </Select>
        <label>
          <Checkbox /> Checkbox
        </label>
      </Card>
    </CardGrid>
  </div>
);

export const App = () => (
  <ThemeProvider>
    <AppInner />
  </ThemeProvider>
);
