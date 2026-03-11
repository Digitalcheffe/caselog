import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
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
  type Log,
} from "../api";
import type { ApiError } from "../api/client";
import { Button, Card, EmptyState, Input, MetadataLine, PageHeader, Spinner } from "./ui";

const flatten = (root: MindMapNode): MindMapNode[] => {
  const queue = [root];
  const nodes: MindMapNode[] = [];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    nodes.push(current);
    queue.push(...current.children);
  }
  return nodes;
};

const toFlow = (nodes: MindMapNode[], selectedId: string | null): Node[] => {
  const byParent = new Map<string | null, MindMapNode[]>();
  nodes.forEach((n) => byParent.set(n.parentNodeId, [...(byParent.get(n.parentNodeId) ?? []), n]));
  const root = nodes.find((n) => n.parentNodeId === null);
  if (!root) return [];

  const positions = new Map<string, { x: number; y: number }>();
  const queue: Array<{ id: string; level: number; x: number }> = [{ id: root.id, level: 0, x: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    positions.set(current.id, { x: current.x, y: current.level * 140 });
    const children = byParent.get(current.id) ?? [];
    const span = (children.length - 1) * 220;
    children.forEach((child, index) => {
      queue.push({ id: child.id, level: current.level + 1, x: current.x - span / 2 + index * 220 });
    });
  }

  return nodes.map((n) => {
    const isSelected = n.id === selectedId;

    return {
      id: n.id,
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: {
        label: (
          <div className={`mindmap-node ${isSelected ? "selected" : ""}`}>
            <span>{n.label}</span>
          </div>
        ),
      },
      style: {
        border: "none",
        background: "transparent",
        padding: 0,
      },
    };
  });
};

export const MindMapsIndexPage = ({ navigate, onToast }: { navigate: (path: string) => void; onToast: (value: string) => void }) => {
  const [mindMaps, setMindMaps] = useState<Array<MindMap & { nodeCount: number }>>([]);
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const maps = await getMindMaps();
        const counts = await Promise.all(maps.map(async (map) => ({ ...map, nodeCount: flatten((await getMindMap(map.id)).rootNode).length })));
        setMindMaps(counts);
      } catch (err) {
        const apiError = err as ApiError;
        onToast(apiError.message || "Failed to load mind maps");
      } finally {
        setLoading(false);
      }
    })();
  }, [onToast]);

  return <div>
    <PageHeader title="Mind Maps" actions={<Button onClick={() => setOpen(true)}>New Mind Map</Button>} />
    {loading ? <Card><Spinner /></Card> : null}
    {!loading && mindMaps.length === 0 ? <EmptyState title="No mind maps yet" body="Create one to start mapping ideas." /> : null}
    <div className="index-grid">
      {mindMaps.map((m) => <Card key={m.id}><MetadataLine>{new Date(m.updatedAt).toLocaleDateString()}</MetadataLine><h3>{m.title}</h3><p className="muted">{m.nodeCount} nodes</p><Button onClick={() => navigate(`/mindmaps/${m.id}`)}>Open</Button></Card>)}
    </div>
    {open ? <div className="dialog-backdrop"><Card className="mindmap-modal"><h3>New Mind Map</h3><Input value={title} onChange={(e) => setTitle(e.target.value)} /><div className="row"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => {
      if (!title.trim()) return;
      try { const created = await createMindMap(title.trim()); navigate(`/mindmaps/${created.id}`); } catch { onToast("Failed to create mind map"); }
    }}>Create</Button></div></Card></div> : null}
  </div>;
};

export const MindMapEditorPage = ({ id, onToast }: { id: string; onToast: (value: string) => void }) => {
  const [detail, setDetail] = useState<MindMapDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pageQuery, setPageQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await getMindMap(id);
      setDetail(loaded);
      const root = loaded.rootNode.id;
      setSelectedId((current) => current && loaded.nodes.some((n) => n.id === current) ? current : root);
      const active = loaded.nodes.find((n) => n.id === (selectedId ?? root));
      setEditingLabel(active?.label ?? "");
    } catch (err) {
      const apiError = err as ApiError;
      onToast(apiError.message || "Failed to load mind map");
    } finally {
      setLoading(false);
    }
  }, [id, onToast, selectedId]);

  useEffect(() => { void load(); }, [load]);

  const nodeMap = useMemo(() => Object.fromEntries((detail?.nodes ?? []).map((n) => [n.id, n])), [detail]);
  const flowNodes = useMemo(() => toFlow(detail?.nodes ?? [], selectedId), [detail, selectedId]);
  const edges: Edge[] = useMemo(() => (detail?.nodes ?? []).filter((n) => n.parentNodeId).map((n) => ({ id: `${n.parentNodeId}-${n.id}`, source: n.parentNodeId as string, target: n.id })), [detail]);

  const selectedNode = selectedId ? nodeMap[selectedId] : null;

  const addChild = async () => {
    if (!selectedId) return;
    try {
      const created = await createMindMapNode(id, { parentId: selectedId, label: "New node" });
      await load();
      setSelectedId(created.id);
      setEditingLabel(created.label);
    } catch {
      onToast("Failed to add node");
    }
  };

  const saveSelectedLabel = async () => {
    if (!selectedNode) return;
    try {
      await updateMindMapNode(id, selectedNode.id, { label: editingLabel.trim() || "Untitled", parentNodeId: selectedNode.parentNodeId, notes: selectedNode.notes ?? null, sortOrder: selectedNode.sortOrder ?? 0 });
      await load();
    } catch {
      onToast("Failed to save node");
    }
  };

  if (loading) return <Card><Spinner /></Card>;
  if (!detail) return <EmptyState title="Mind map missing" body="Not found." />;

  return <div className="mindmap-editor-page">
    <PageHeader title={detail.title} subtitle="Interactive KaseLog mind map editor" actions={<div className="row"><Button variant="secondary" onClick={async () => {
      const next = window.prompt("Mind map title", detail.title);
      if (!next || !next.trim()) return;
      await updateMindMap(id, { title: next.trim() });
      await load();
    }}>Rename</Button><Button onClick={() => void addChild()} disabled={!selectedId}>Add child node</Button></div>} />
    <div className="mindmap-editor-layout">
      <Card>
        <div className="mindmap-canvas">
          <ReactFlow nodes={flowNodes} edges={edges} fitView onNodeClick={(_, n) => {
            setSelectedId(n.id);
            setEditingLabel(String(nodeMap[n.id]?.label ?? ""));
          }}>
            <Controls />
            <Background />
          </ReactFlow>
        </div>
      </Card>
      <Card>
        <h3>Node details</h3>
        {selectedNode ? <>
          <MetadataLine>Selected node</MetadataLine>
          <Input value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} onBlur={() => void saveSelectedLabel()} />
          <div className="row" style={{ marginTop: 10 }}>
            <Button variant="secondary" onClick={() => void saveSelectedLabel()}>Save label</Button>
            <Button variant="danger" disabled={selectedNode.parentNodeId === null} onClick={async () => {
              try { await deleteMindMapNode(id, selectedNode.id); await load(); } catch { onToast("Failed to delete node"); }
            }}>Delete node</Button>
          </div>
        </> : <p className="muted">Select a node to edit.</p>}

        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" onClick={async () => { setLogs(await getPages()); setAttachOpen(true); }}>Attach to Log</Button>
        </div>
      </Card>
    </div>
    {attachOpen ? (
      <div className="dialog-backdrop">
        <Card className="mindmap-modal">
          <h3>Attach to Log</h3>
          <Input value={pageQuery} onChange={(event) => setPageQuery(event.target.value)} placeholder="Search logs" />
          <div className="mindmap-attach-list">
            {logs.filter((page) => page.title.toLowerCase().includes(pageQuery.toLowerCase())).map((page) => (
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
  </div>;
};
