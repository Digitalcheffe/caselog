import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  createAdminUser,
  attachListToPage,
  createApiKey,
  createList,
  createListEntry,
  createListField,
  createNotebookPage,
  createShelf,
  createShelfNotebook,
  disableTwoFactor,
  enableTwoFactor,
  getApiKeys,
  getAuthSessions,
  getProfile,
  getTwoFactorSetup,
  revokeApiKey,
  revokeAuthSession,
  db,
  deleteAdminUser,
  deleteEntry,
  deleteListField,
  deletePage,
  exitAdminImpersonation,
  forceAdminUserResetPassword,
  getAdminUser,
  getAdminUsers,
  getList,
  getListEntries,
  getListFields,
  getLists,
  getNotebookPages,
  getShelfNotebooks,
  getShelves,
  type ListEntry,
  type AdminUser,
  type ListFieldType,
  type ListType,
  type ListTypeField,
  type Notebook,
  type Page,
  type ProfileResponse,
  type Shelf,
  impersonateAdminUser,
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
} from "./components/ui";
import { useRouter } from "./hooks/useRouter";
import { ThemeProvider, useTheme } from "./hooks/useTheme";
import { MindMapEditorPage, MindMapsIndexPage } from "./components/mindmaps";

const routes = [
  "/",
  "/dashboard",
  "/shelves",
  "/shelves/:id",
  "/notebooks/:id",
  "/pages/:id",
  "/search",
  "/lists",
  "/lists/:id",
  "/mindmaps",
  "/mindmaps/:id",
  "/followups",
  "/unorganized",
  "/settings",
  "/settings/profile",
  "/admin/users",
  "/admin/users/new",
  "/admin/users/:id",
  "/dev/components",
];
const AppInner = () => {
  const { theme, toggleTheme } = useTheme();
  const { currentRoute, pathname, params, navigate } = useRouter(routes);
  const [search, setSearch] = useState(
    new URLSearchParams(window.location.search).get("q") ?? "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [pages, setPages] = useState<Page[]>(() => db.pages());
  const [shelves, setShelves] = useState<(Shelf & { notebookCount?: number })[]>(() =>
    db.shelves().map((shelf) => ({ ...shelf, notebookCount: undefined })),
  );
  const [notebooks, setNotebooks] = useState<Notebook[]>(() => db.notebooks());
  const [lists, setLists] = useState<ListType[]>([]);
  const [listFields, setListFields] = useState<ListTypeField[]>([]);
  const [listEntries, setListEntries] = useState<ListEntry[]>([]);
  const [toast, setToast] = useState("");
  const [currentUserRole] = useState<"admin" | "member">("admin");
  const [impersonatingUser, setImpersonatingUser] = useState<{ id: string; name: string } | null>(() => {
    const token = window.localStorage.getItem("caselog-impersonate-token");
    const name = window.localStorage.getItem("caselog-impersonate-name");
    const id = window.localStorage.getItem("caselog-impersonate-user-id");
    if (!token || !name || !id) {
      return null;
    }

    return { id, name };
  });
  const isAdmin = currentUserRole === "admin";

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--impersonation-banner-height",
      impersonatingUser ? "42px" : "0px",
    );

    return () => {
      document.documentElement.style.setProperty("--impersonation-banner-height", "0px");
    };
  }, [impersonatingUser]);

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
    const loadShelves = async () => {
      try {
        const fetchedShelves = await getShelves();
        setShelves(fetchedShelves);
      } catch {
        setShelves(db.shelves().map((shelf) => ({ ...shelf, notebookCount: undefined })));
      }
    };

    void loadShelves();
  }, []);

  useEffect(() => {
    if (currentRoute !== "/shelves/:id" || !params.id) return;

    const loadNotebooks = async () => {
      try {
        setNotebooks(await getShelfNotebooks(params.id));
      } catch {
        setNotebooks(db.notebooks().filter((notebook) => notebook.shelfId === params.id));
      }
    };

    void loadNotebooks();
  }, [currentRoute, params.id]);

  useEffect(() => {
    if (currentRoute !== "/notebooks/:id" || !params.id) return;

    const loadPages = async () => {
      try {
        const notebookPages = await getNotebookPages(params.id);
        setPages((previous) => {
          const remaining = previous.filter((page) => page.notebookId !== params.id);
          return [...remaining, ...notebookPages];
        });
      } catch {
        setPages(db.pages());
      }
    };

    void loadPages();
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

  const filtered = useMemo(
    () =>
      pages.filter((p) =>
        `${p.title} ${p.content} ${p.tags.join(" ")}`
          .toLowerCase()
          .includes(debouncedSearch.toLowerCase()),
      ),
    [debouncedSearch, pages],
  );

  const addQuickCapture = (content: string) => {
    const now = new Date().toISOString();
    const nextItem: Page = {
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
    const next = [...pages, nextItem];
    setPages(next);
    db.setPages(next);
    setToast("Quick capture saved");
  };

  let content: JSX.Element;
  switch (currentRoute) {
    case "/":
    case "/dashboard":
      content = <Dashboard pages={pages} onQuickCapture={addQuickCapture} />;
      break;
    case "/shelves":
      content = (
        <ShelvesPage
          shelves={shelves}
          notebooks={notebooks}
          navigate={navigate}
          onShelvesChange={setShelves}
          onToast={setToast}
        />
      );
      break;
    case "/shelves/:id": {
      const shelf = shelves.find((item) => item.id === params.id);
      const shelfNotebooks = notebooks.filter((item) => item.shelfId === params.id);
      content = shelf ? (
        <ShelfDetailPage
          shelf={shelf}
          notebooks={shelfNotebooks}
          pages={pages}
          navigate={navigate}
          onNotebookCreated={(notebook) =>
            setNotebooks((previous) => [...previous.filter((item) => item.id !== notebook.id), notebook])
          }
          onToast={setToast}
        />
      ) : (
        <EmptyState title="Shelf missing" body="Not found." />
      );
      break;
    }
    case "/notebooks/:id": {
      const notebook = notebooks.find((item) => item.id === params.id);
      const notebookPages = pages.filter((page) => page.notebookId === params.id);
      const shelf = shelves.find((item) => item.id === notebook?.shelfId);
      content = notebook ? (
        <NotebookDetailPage
          notebook={notebook}
          shelf={shelf}
          pages={notebookPages}
          navigate={navigate}
          onPageCreated={(page) =>
            setPages((previous) => [...previous.filter((item) => item.id !== page.id), page])
          }
          onToast={setToast}
        />
      ) : (
        <EmptyState title="Notebook missing" body="Not found." />
      );
      break;
    }
    case "/pages/:id": {
      const page = pages.find((p) => p.id === params.id);
      content = page ? (
        <PageEditor
          page={page}
          pages={pages}
          setPages={setPages}
          navigate={navigate}
          onToast={setToast}
        />
      ) : (
        <EmptyState title="Page missing" body="Not found." />
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
          pages={pages}
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
      content = <SearchPage results={filtered} />;
      break;
    case "/mindmaps":
      content = <MindMapsIndexPage navigate={navigate} onToast={setToast} />;
      break;
    case "/mindmaps/:id":
      content = params.id ? <MindMapEditorPage id={params.id} onToast={setToast} /> : <EmptyState title="Mind map missing" body="Not found." />;
      break;
    case "/followups":
      content = <FollowUps pages={pages} setPages={setPages} />;
      break;
    case "/unorganized":
      content = (
        <div>
          <PageHeader title="Unorganized" />
          {pages
            .filter((p) => !p.notebookId)
            .map((p) => (
              <Card key={p.id}>{p.title}</Card>
            ))}
        </div>
      );
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
          onImpersonatingChange={setImpersonatingUser}
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

  return (
    <>
      {impersonatingUser ? (
        <div className="impersonation-banner">
          ⚠ Impersonating {impersonatingUser.name} — {" "}
          <button
            type="button"
            className="impersonation-exit"
            onClick={() => {
              void (async () => {
                try {
                  await exitAdminImpersonation();
                } catch {
                  // noop
                } finally {
                  window.localStorage.removeItem("caselog-impersonate-token");
                  window.localStorage.removeItem("caselog-impersonate-name");
                  window.localStorage.removeItem("caselog-impersonate-user-id");
                  setImpersonatingUser(null);
                  window.location.reload();
                }
              })();
            }}
          >
            Exit Impersonation
          </button>
        </div>
      ) : null}
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

const Dashboard = ({
  pages,
  onQuickCapture,
}: {
  pages: Page[];
  onQuickCapture: (value: string) => void;
}) => (
  <div>
    <PageHeader title="Dashboard" />
    <CardGrid>
      {pages.slice(0, 3).map((p) => (
        <Card key={p.id}>
          <MetadataLine>PAGE</MetadataLine>
          <h3>{p.title}</h3>
        </Card>
      ))}
    </CardGrid>
    <Card>
      <MetadataLine>
        Open follow-ups{" "}
        <Badge tone="accent">{pages.filter((p) => p.followUp).length}</Badge>
      </MetadataLine>
    </Card>
    <Card>
      <h3>Quick capture</h3>
      <Textarea
        onBlur={(e) => e.target.value.trim() && onQuickCapture(e.target.value)}
      />
    </Card>
  </div>
);
const SearchPage = ({ results }: { results: Page[] }) => (
  <div>
    <PageHeader title="Search" subtitle="Hint: tag:homelab type:list" />
    {results.length === 0 ? (
      <EmptyState title="No results" body="Try adjusting query." />
    ) : (
      <CardGrid>
        {results.map((r) => (
          <Card key={r.id}>
            <MetadataLine>
              {r.notebookId ? "notebook" : "unorganized"}
            </MetadataLine>
            <h3>{r.title}</h3>
            <p>{r.content.slice(0, 90)}</p>
            <TagList tags={r.tags} />
          </Card>
        ))}
      </CardGrid>
    )}
  </div>
);

const FollowUps = ({
  pages,
  setPages,
}: {
  pages: Page[];
  setPages: (v: Page[]) => void;
}) => {
  const open = pages.filter((p) => p.followUp);
  if (open.length === 0)
    return <EmptyState title="No follow-ups" body="Everything is clear." />;
  return (
    <div>
      <PageHeader title="Follow-ups" />
      {open.map((p) => (
        <Card key={p.id}>
          <h3>{p.title}</h3>
          <Button
            onClick={() => {
              const next = pages.map((x) =>
                x.id === p.id ? { ...x, followUp: false } : x,
              );
              setPages(next);
              db.setPages(next);
            }}
          >
            Clear
          </Button>
        </Card>
      ))}
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
        actions={<Button onClick={() => setOpen(true)}>New List</Button>}
      />
      {lists.length === 0 ? (
        <EmptyState title="No lists yet" body="Create your first list to start tracking structured data." />
      ) : (
        <CardGrid>
          {lists.map((list) => (
            <Card key={list.id}>
              <h3>{list.name}</h3>
              <MetadataLine>{list.description || "No description"}</MetadataLine>
              <p className="muted">Fields: {counts[list.id]?.fields ?? 0}</p>
              <p className="muted">Entries: {counts[list.id]?.entries ?? 0}</p>
              <Button onClick={() => navigate(`/lists/${list.id}`)}>Open</Button>
            </Card>
          ))}
        </CardGrid>
      )}
      {open ? (
        <div className="dialog-backdrop">
          <Card className="modal-card">
            <h3>New List</h3>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="List name" />
            <div className="row">
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
  pages,
  onListChange,
  onFieldsChange,
  onEntriesChange,
  onToast,
}: {
  list: ListType;
  fields: ListTypeField[];
  entries: ListEntry[];
  pages: Page[];
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
  const [selectOptions, setSelectOptions] = useState<Record<string, string[]>>(() => {
    const raw = window.localStorage.getItem(`list-select-options:${list.id}`);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  });

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
    window.localStorage.setItem(`list-select-options:${list.id}`, JSON.stringify(next));
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

  const matchingPages = pages.filter((page) => page.title.toLowerCase().includes(pageSearch.toLowerCase()));

  return (
    <div>
      <PageHeader
        title={list.name}
        actions={<div className="row"><Button variant="secondary" onClick={() => setAttachOpen(true)}>Attach to Page</Button><Button onClick={() => void addEntry()}>New Entry</Button></div>}
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
            <h3>Attach to Page</h3>
            <Input placeholder="Search pages" value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} />
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
const ShelvesPage = ({
  shelves,
  notebooks,
  navigate,
  onShelvesChange,
  onToast,
}: {
  shelves: (Shelf & { notebookCount?: number })[];
  notebooks: Notebook[];
  navigate: (path: string) => void;
  onShelvesChange: (value: (Shelf & { notebookCount?: number })[]) => void;
  onToast: (message: string) => void;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createNewShelf = async () => {
    const shelfName = name.trim() || "Untitled Shelf";
    const shelfDescription = description.trim();

    try {
      const created = await createShelf({ name: shelfName, description: shelfDescription });
      onShelvesChange([...shelves, { ...created, notebookCount: 0 }]);
      setName("");
      setDescription("");
      onToast("Shelf created");
    } catch {
      onToast("Failed to create shelf");
    }
  };

  return (
    <div>
      <PageHeader
        title="Shelves"
        actions={
          <div className="row">
            <Input
              placeholder="Shelf name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              placeholder="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Button onClick={() => void createNewShelf()}>New Shelf</Button>
          </div>
        }
      />
      <CardGrid>
        {shelves.map((shelf) => (
          <Card key={shelf.id}>
            <h3>{shelf.name}</h3>
            <p>{shelf.description || "No description"}</p>
            <MetadataLine>
              {(shelf.notebookCount ?? notebooks.filter((item) => item.shelfId === shelf.id).length).toString()} notebooks
            </MetadataLine>
            <Button onClick={() => navigate(`/shelves/${shelf.id}`)}>Open</Button>
          </Card>
        ))}
      </CardGrid>
    </div>
  );
};

const ShelfDetailPage = ({
  shelf,
  notebooks,
  pages,
  navigate,
  onNotebookCreated,
  onToast,
}: {
  shelf: Shelf;
  notebooks: Notebook[];
  pages: Page[];
  navigate: (path: string) => void;
  onNotebookCreated: (notebook: Notebook) => void;
  onToast: (message: string) => void;
}) => {
  const createNewNotebook = async () => {
    try {
      const created = await createShelfNotebook(shelf.id, { title: "Untitled Notebook" });
      onNotebookCreated(created);
      onToast("Notebook created");
    } catch {
      onToast("Failed to create notebook");
    }
  };

  return (
    <div>
      <PageHeader
        title={shelf.name}
        subtitle={shelf.description}
        actions={<Button onClick={() => void createNewNotebook()}>New Notebook</Button>}
      />
      <CardGrid>
        {notebooks.map((notebook) => {
          const pageCount = notebook.pageCount ?? pages.filter((page) => page.notebookId === notebook.id).length;
          return (
            <Card key={notebook.id}>
              <h3>{notebook.name}</h3>
              <p>{notebook.description || "No description"}</p>
              <MetadataLine>Notebook</MetadataLine>
              <div className="row">
                <Badge>{pageCount} pages</Badge>
              </div>
              <Button onClick={() => navigate(`/notebooks/${notebook.id}`)}>Open</Button>
            </Card>
          );
        })}
      </CardGrid>
    </div>
  );
};

const NotebookDetailPage = ({
  notebook,
  shelf,
  pages,
  navigate,
  onPageCreated,
  onToast,
}: {
  notebook: Notebook;
  shelf?: Shelf & { notebookCount?: number };
  pages: Page[];
  navigate: (path: string) => void;
  onPageCreated: (page: Page) => void;
  onToast: (message: string) => void;
}) => {
  const createNewPage = async () => {
    try {
      const created = await createNotebookPage(notebook.id, { title: "Untitled" });
      onPageCreated(created);
      navigate(`/pages/${created.id}`);
    } catch {
      onToast("Failed to create page");
    }
  };

  return (
    <div>
      <MetadataLine>
        {shelf ? (
          <button className="inline-link" type="button" onClick={() => navigate(`/shelves/${shelf.id}`)}>
            {shelf.name}
          </button>
        ) : (
          "Shelf"
        )}{" "}
        &gt;
        <button className="inline-link" type="button" onClick={() => navigate(`/notebooks/${notebook.id}`)}>
          {notebook.name}
        </button>
      </MetadataLine>
      <PageHeader
        title={notebook.name}
        actions={<Button onClick={() => void createNewPage()}>New Page</Button>}
      />
      {pages.length === 0 ? (
        <Card className="empty-state-card">
          <div className="empty-state-icon" aria-hidden>📄</div>
          <h3>No pages yet</h3>
          <p className="muted">Create your first page</p>
          <Button onClick={() => void createNewPage()}>Create your first page</Button>
        </Card>
      ) : (
        <CardGrid>
          {pages.map((page) => {
            const overflow = Math.max(page.tags.length - 3, 0);
            return (
              <Card key={page.id}>
                <button
                  type="button"
                  className="card-link-title"
                  onClick={() => navigate(`/pages/${page.id}`)}
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
  pages,
  setPages,
  navigate,
  onToast,
}: {
  page: Page;
  pages: Page[];
  setPages: (v: Page[]) => void;
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

  const savePageAndStore = (nextDraft: Page) => {
    const nextPages = pages.map((p) => (p.id === nextDraft.id ? nextDraft : p));
    setPages(nextPages);
    db.setPages(nextPages);
    setLastSavedDraft(nextDraft);
  };

  const persistDraft = async (nextDraft: Page) => {
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

  const saveSingleField = async (changes: Partial<Page>) => {
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

  const handleVisibilityChange = async (nextVisibility: Page["visibility"]) => {
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
      const nextPages = pages.filter((p) => p.id !== draft.id);
      setPages(nextPages);
      db.setPages(nextPages);
      setConfirmDeleteOpen(false);
      navigate(
        draft.notebookId ? `/notebooks/${draft.notebookId}` : "/unorganized",
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

  return (
    <div>
      <MetadataLine>Home / Notebook / {page.title}</MetadataLine>
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
                    e.target.value as Page["visibility"],
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
  const [profileName, setProfileName] = useState("");
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
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ qrCodeImageUrl: string; manualKey: string } | null>(null);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [sessions, setSessions] = useState<
    Array<{ id: string; device: string; browser: string; lastSeenAt: string; isCurrent: boolean }>
  >([]);
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Array<{ id: string; name: string; createdAt: string; lastUsedAt?: string | null }>>([]);
  const [apiKeyToRevoke, setApiKeyToRevoke] = useState<string | null>(null);
  const [isCreateKeyModalOpen, setIsCreateKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<{ id: string; name: string; key: string; createdAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const initials = (profile?.name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
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
        const [profileResponse, sessionResponse, keyResponse] = await Promise.all([
          getProfile(),
          getAuthSessions(),
          getApiKeys(),
        ]);
        setProfile(profileResponse);
        setProfileName(profileResponse.name ?? "");
        setEmailDraft(profileResponse.email ?? "");
        setSessions(sessionResponse);
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
    if (!profileName.trim()) return;
    try {
      const updated = await updateProfileName(profileName.trim());
      setProfile(updated);
      setNotice("Name updated");
    } catch {
      setError("Unable to save name.");
    }
  };

  const saveEmail = async () => {
    try {
      await updateProfileEmail(emailDraft.trim(), emailPassword);
      setProfile((current) => (current ? { ...current, email: emailDraft.trim() } : current));
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
      setProfile((current) => (current ? { ...current, twoFactorEnabled: true } : current));
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
      setProfile((current) => (current ? { ...current, twoFactorEnabled: false } : current));
      setNotice("2FA disabled");
    } catch {
      setError("Unable to disable 2FA.");
    }
  };

  const revokeSession = async () => {
    if (!sessionToRevoke) return;
    try {
      await revokeAuthSession(sessionToRevoke);
      setSessions((current) => current.filter((session) => session.id !== sessionToRevoke));
      setSessionToRevoke(null);
      setNotice("Session revoked");
    } catch {
      setError("Unable to revoke session.");
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
              <span className="meta-line">Name</span>
              <Input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
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
                <Button variant="danger" onClick={() => setSessionToRevoke("disable-2fa")}>Disable 2FA</Button>
              </div>
            ) : (
              <div>
                <Button onClick={() => void startTwoFactorEnrollment()}>Enroll in 2FA</Button>
                {twoFactorSetup ? (
                  <div className="twofa-setup">
                    <img src={twoFactorSetup.qrCodeImageUrl} alt="2FA QR code" className="twofa-qr" />
                    <p>Manual key: <code>{twoFactorSetup.manualKey}</code></p>
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
            {sessions.length === 0 ? <p className="muted">No active sessions found.</p> : null}
            {sessions.map((session) => (
              <div key={session.id} className="settings-list-row">
                <div>
                  <p>
                    {session.device} · {session.browser} {session.isCurrent ? "(this session)" : ""}
                  </p>
                  <p className="muted">Last seen {formatDate(session.lastSeenAt)}</p>
                </div>
                {!session.isCurrent ? (
                  <Button variant="secondary" onClick={() => setSessionToRevoke(session.id)}>Revoke</Button>
                ) : null}
              </div>
            ))}
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
        open={sessionToRevoke === "disable-2fa"}
        title="Disable 2FA"
        body="Are you sure you want to disable two-factor authentication?"
        onCancel={() => setSessionToRevoke(null)}
        onConfirm={() => {
          setSessionToRevoke(null);
          void disable2fa();
        }}
      />
      <ConfirmDialog
        open={Boolean(sessionToRevoke && sessionToRevoke !== "disable-2fa")}
        title="Revoke session"
        body="This device will be signed out immediately."
        onCancel={() => setSessionToRevoke(null)}
        onConfirm={() => void revokeSession()}
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
  onImpersonatingChange,
}: {
  navigate: (path: string) => void;
  isAdmin: boolean;
  selectedId?: string;
  currentRoute: string;
  onToast: (value: string) => void;
  onImpersonatingChange: (value: { id: string; name: string } | null) => void;
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const [newForm, setNewForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "member" as "admin" | "member",
  });
  const [editForm, setEditForm] = useState({
    name: "",
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
        setEditUserName(user.name);
        setEditForm({
          name: user.name,
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

  const validateUserForm = (input: { name: string; email: string; password?: string }) => {
    if (!input.name.trim() || !input.email.trim()) {
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
            Full name
          </label>
          <Input
            id="new-user-name"
            value={newForm.name}
            onChange={(event) => setNewForm((previous) => ({ ...previous, name: event.target.value }))}
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
                      name: newForm.name.trim(),
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
            Full name
          </label>
          <Input
            id="edit-user-name"
            value={editForm.name}
            onChange={(event) => setEditForm((previous) => ({ ...previous, name: event.target.value }))}
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
                      name: editForm.name.trim(),
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
            <Button
              variant="secondary"
              onClick={() => {
                void (async () => {
                  try {
                    await forceAdminUserResetPassword(selectedId);
                    onToast("Password reset triggered");
                  } catch {
                    onToast("Failed to trigger password reset");
                  }
                })();
              }}
            >
              Force password reset
            </Button>
            <Button variant="secondary" onClick={() => navigate("/admin/users")}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirmDelete({ id: selectedId, name: editUserName, email: editForm.email, role: editForm.role, enabled: editForm.enabled, lastLoginAt: null })}
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
                            const result = await impersonateAdminUser(user.id);
                            window.localStorage.setItem("caselog-impersonate-token", result.token);
                            window.localStorage.setItem("caselog-impersonate-name", user.name);
                            window.localStorage.setItem("caselog-impersonate-user-id", user.id);
                            onImpersonatingChange({ id: user.id, name: user.name });
                            window.location.reload();
                          } catch {
                            onToast("Failed to impersonate user");
                          }
                        })();
                      }}
                    >
                      Impersonate
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
