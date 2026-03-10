import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  applyNodeChanges,
} from "@xyflow/react";
import {
  attachMindMapToPage,
  createMindMap,
  createMindMapNode,
  deleteMindMapNode,
  getMindMap,
  getMindMaps,
  getPages,
  updateMindMap,
  updateMindMapNode,
  type MindMap,
  type MindMapDetail,
  type MindMapNode,
  type Page,
} from "../api";
import { Button, Card, CardGrid, EmptyState, Input, MetadataLine, PageHeader } from "./ui";

const posKey = (id: string) => `mindmap-positions:${id}`;

const flattenNodes = (root: MindMapNode): MindMapNode[] => {
  const stack = [root];
  const nodes: MindMapNode[] = [];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    nodes.push(current);
    for (let index = current.children.length - 1; index >= 0; index -= 1) stack.push(current.children[index]);
  }
  return nodes;
};

const countNodes = (node: MindMapNode): number =>
  1 + node.children.reduce((sum: number, child: MindMapNode) => sum + countNodes(child), 0);

const buildInitialPositions = (nodes: MindMapNode[]) => {
  const byParent = new Map<string | null, MindMapNode[]>();
  nodes.forEach((node) => byParent.set(node.parentNodeId, [...(byParent.get(node.parentNodeId) ?? []), node]));
  const root = nodes.find((node) => node.parentNodeId === null);
  if (!root) return new Map<string, { x: number; y: number }>();

  const result = new Map<string, { x: number; y: number }>();
  const queue: Array<{ nodeId: string; level: number; x: number }> = [{ nodeId: root.id, level: 0, x: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    result.set(current.nodeId, { x: current.x, y: current.level * 100 });
    const children = byParent.get(current.nodeId) ?? [];
    const totalWidth = (children.length - 1) * 160;
    children.forEach((child, index) => {
      queue.push({ nodeId: child.id, level: current.level + 1, x: current.x - totalWidth / 2 + index * 160 });
    });
  }
  return result;
};

export const MindMapsIndexPage = ({ navigate, onToast }: { navigate: (path: string) => void; onToast: (value: string) => void }) => {
  const [mindMaps, setMindMaps] = useState<Array<MindMap & { nodeCount: number }>>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const maps = await getMindMaps();
        const withCounts = await Promise.all(
          maps.map(async (map: MindMap) => {
            const detail = await getMindMap(map.id);
            return { ...map, nodeCount: countNodes(detail.rootNode) };
          }),
        );
        setMindMaps(withCounts);
      } catch {
        onToast("Failed to load mind maps");
      }
    })();
  }, [onToast]);

  return (
    <div>
      <PageHeader title="Mind Maps" actions={<Button onClick={() => setOpen(true)}>New Mind Map</Button>} />
      {mindMaps.length === 0 ? (
        <EmptyState title="No mind maps yet" body="Create one to start mapping ideas." />
      ) : (
        <CardGrid>
          {mindMaps.map((map) => (
            <Card key={map.id}>
              <MetadataLine>{new Date(map.updatedAt).toLocaleDateString()}</MetadataLine>
              <h3>{map.title}</h3>
              <p className="muted">{map.nodeCount} nodes</p>
              <Button variant="secondary" onClick={() => navigate(`/mindmaps/${map.id}`)}>Open</Button>
            </Card>
          ))}
        </CardGrid>
      )}
      {open ? (
        <div className="dialog-backdrop">
          <Card className="mindmap-modal">
            <h3>New Mind Map</h3>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={async () => {
                if (!title.trim()) return;
                try {
                  const created = await createMindMap(title.trim());
                  navigate(`/mindmaps/${created.id}`);
                } catch {
                  onToast("Failed to create mind map");
                }
              }}>Create</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

export const MindMapEditorPage = ({ id, onToast }: { id: string; onToast: (value: string) => void }) => {
  const [detail, setDetail] = useState<MindMapDetail | null>(null);
  const [nodeMap, setNodeMap] = useState<Record<string, MindMapNode>>({});
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pageQuery, setPageQuery] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const saveTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const loaded = await getMindMap(id);
      setDetail(loaded);
      const flatNodes = flattenNodes(loaded.rootNode);
      const map = Object.fromEntries(flatNodes.map((node) => [node.id, node]));
      setNodeMap(map);
      const stored = JSON.parse(window.localStorage.getItem(posKey(id)) ?? "{}") as Record<string, { x: number; y: number }>;
      const computed = Object.keys(stored).length > 0 ? null : buildInitialPositions(flatNodes);
      setFlowNodes(flatNodes.map((node) => ({
        id: node.id,
        data: { label: node.label },
        position: stored[node.id] ?? computed?.get(node.id) ?? { x: 0, y: 0 },
        style: {
          borderRadius: 8,
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          color: "white",
          padding: 10,
        },
      })));
    } catch {
      onToast("Failed to load mind map");
    }
  }, [id, onToast]);

  useEffect(() => { void load(); }, [load]);


  useEffect(() => {
    if (!detail) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void updateMindMap(id, { title: detail.title });
    }, 1000);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [detail, flowNodes, id]);

  const persistPositions = (nodes: Node[]) => {
    const values = Object.fromEntries(nodes.map((node) => [node.id, node.position]));
    window.localStorage.setItem(posKey(id), JSON.stringify(values));
  };

  const edges: Edge[] = useMemo(
    () => Object.values(nodeMap).filter((node) => node.parentNodeId).map((node) => ({ id: `${node.parentNodeId}-${node.id}`, source: node.parentNodeId as string, target: node.id })),
    [nodeMap],
  );

  const updateNode = async (nodeId: string, patch: Partial<Pick<MindMapNode, "label">>) => {
    const current = nodeMap[nodeId];
    if (!current) return;
    await updateMindMapNode(id, nodeId, {
      parentNodeId: current.parentNodeId,
      label: patch.label ?? current.label,
      notes: current.notes,
      sortOrder: current.sortOrder,
    });
  };

  return (
    <div className="mindmap-editor-page" onClick={() => setContextMenu(null)}>
      <div className="mindmap-toolbar">
        <Button variant="secondary" disabled={!selectedId} onClick={() => selectedId && void createMindMapNode(id, { parentId: selectedId, label: "New node" }).then(load)}>Add child</Button>
        <Button variant="danger" disabled={!selectedId} onClick={() => selectedId && void deleteMindMapNode(id, selectedId).then(load)}>Delete node</Button>
        <Button variant="secondary" onClick={async () => { setPages(await getPages()); setAttachOpen(true); }}>Attach to Page</Button>
      </div>
      <div className="mindmap-canvas">
        <ReactFlow
          nodes={flowNodes.map((node) => ({
            ...node,
            style: { ...node.style, border: selectedId === node.id ? "1px solid var(--color-accent)" : "1px solid var(--color-border)" },
            data: {
              ...node.data,
              label: editingId === node.id ? (
                <Input
                  autoFocus
                  defaultValue={String(node.data.label)}
                  onBlur={(event) => void updateNode(node.id, { label: event.target.value }).then(() => { setEditingId(null); void load(); })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void updateNode(node.id, { label: (event.currentTarget as HTMLInputElement).value }).then(() => { setEditingId(null); void load(); });
                    }
                  }}
                />
              ) : (
                <span>{String(node.data.label)}</span>
              ),
            },
          }))}
          edges={edges}
          fitView
          onNodesChange={(changes: NodeChange[]) => {
            setFlowNodes((current) => {
              const next = applyNodeChanges(changes, current);
              persistPositions(next);
              return next;
            });
          }}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onNodeDoubleClick={(_, node) => setEditingId(node.id)}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            setSelectedId(node.id);
            setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
          }}
          onNodeDragStop={(_, node) => persistPositions(flowNodes.map((item) => (item.id === node.id ? { ...item, position: node.position } : item)))}
        >
          <Controls />
          <Background />
        </ReactFlow>
      </div>
      {contextMenu ? (
        <div className="mindmap-context" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button type="button" onClick={() => void createMindMapNode(id, { parentId: contextMenu.nodeId, label: "New node" }).then(load)}>Add child</button>
          <button type="button" onClick={() => void deleteMindMapNode(id, contextMenu.nodeId).then(load)}>Delete node and subtree</button>
        </div>
      ) : null}
      {attachOpen ? (
        <div className="dialog-backdrop">
          <Card className="mindmap-modal">
            <h3>Attach to Page</h3>
            <Input value={pageQuery} onChange={(event) => setPageQuery(event.target.value)} placeholder="Search pages" />
            <div className="mindmap-attach-list">
              {pages.filter((page) => page.title.toLowerCase().includes(pageQuery.toLowerCase())).map((page) => (
                <button key={page.id} type="button" onClick={async () => {
                  await attachMindMapToPage(id, page.id);
                  setAttachOpen(false);
                  onToast("Attached");
                }}>{page.title}</button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="secondary" onClick={() => setAttachOpen(false)}>Close</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};
