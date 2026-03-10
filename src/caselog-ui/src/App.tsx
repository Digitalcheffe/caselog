import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  attachListToPage,
  createList,
  createListEntry,
  createListField,
  createNotebookPage,
  createShelf,
  createShelfNotebook,
  db,
  deleteEntry,
  deleteListField,
  deletePage,
  getList,
  getListEntries,
  getListFields,
  getLists,
  getNotebookPages,
  getShelfNotebooks,
  getShelves,
  type ListEntry,
  type ListFieldType,
  type ListType,
  type ListTypeField,
  type Notebook,
  type Page,
  type Shelf,
  updateEntry,
  updateList,
  updatePage,
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
type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  disabled?: boolean;
};

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
  const [users, setUsers] = useState<User[]>([
    { id: "u1", name: "Admin", email: "admin@local", role: "admin" },
    { id: "u2", name: "Member", email: "member@local", role: "member" },
  ]);
  const isAdmin = true;

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(id);
  }, [toast]);

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
          users={users}
          setUsers={setUsers}
          navigate={navigate}
          isAdmin={isAdmin}
          selectedId={params.id}
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

const SettingsPage = () => (
  <div>
    <PageHeader title="Settings" />
    <Card>
      <h3>API keys</h3>
      <Button>Generate</Button>
    </Card>
    <Card>
      <h3>Profile</h3>
      <Input placeholder="Email" />
      <Input placeholder="Current password" type="password" />
    </Card>
    <Card>
      <h3>2FA</h3>
      <p>Enroll via QR code flow placeholder.</p>
    </Card>
  </div>
);

const AdminUsers = ({
  users,
  setUsers,
  navigate,
  isAdmin,
  selectedId,
}: {
  users: User[];
  setUsers: (v: User[]) => void;
  navigate: (path: string) => void;
  isAdmin: boolean;
  selectedId?: string;
}) => {
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!isAdmin) {
    navigate("/");
    return <EmptyState title="Forbidden" body="Admin only" />;
  }
  if (window.location.pathname === "/admin/users/new")
    return (
      <Card>
        <PageHeader title="Create user" />
        <Input placeholder="Display name" />
        <Input placeholder="Email" />
        <Select>
          <option>member</option>
          <option>admin</option>
        </Select>
        <Button>Create</Button>
      </Card>
    );
  if (selectedId)
    return (
      <Card>
        <PageHeader title="Edit user" />
        <p>{users.find((u) => u.id === selectedId)?.email}</p>
      </Card>
    );
  return (
    <div>
      <PageHeader title="User management" />
      {users.map((u) => (
        <Card key={u.id}>
          <div className="row">
            <span>
              {u.name} ({u.role})
            </span>
            <Button variant="ghost">Impersonate</Button>
            <Button
              variant="secondary"
              onClick={() =>
                setUsers(
                  users.map((x) =>
                    x.id === u.id ? { ...x, disabled: !x.disabled } : x,
                  ),
                )
              }
            >
              {u.disabled ? "Enable" : "Disable"}
            </Button>
            <Button variant="danger" onClick={() => setConfirm(u.id)}>
              Delete
            </Button>
          </div>
        </Card>
      ))}
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete user"
        body="Delete this account?"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setUsers(users.filter((u) => u.id !== confirm));
          setConfirm(null);
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
