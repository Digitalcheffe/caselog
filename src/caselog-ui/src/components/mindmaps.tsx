import { useCallback, useEffect, useMemo, useState } from "react";
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

const buildTreePositions = (nodes: MindMapNode[]) => {
  const byParent = new Map<string | null, MindMapNode[]>();
  nodes.forEach((n) => byParent.set(n.parentNodeId, [...(byParent.get(n.parentNodeId) ?? []), n]));
  const root = nodes.find((n) => n.parentNodeId === null);
  if (!root) return new Map<string, { x: number; y: number }>();

  const positions = new Map<string, { x: number; y: number }>();
  const queue: Array<{ id: string; level: number; x: number }> = [{ id: root.id, level: 0, x: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    positions.set(current.id, { x: current.x, y: current.level * 160 });
    const children = byParent.get(current.id) ?? [];
    const span = (children.length - 1) * 250;
    children.forEach((child, index) => {
      queue.push({ id: child.id, level: current.level + 1, x: current.x - span / 2 + index * 250 });
    });
  }

  return positions;
};

const toFlowNodes = (
  nodes: MindMapNode[],
  selectedId: string | null,
  existing?: Node[],
): Node[] => {
  const fallbackPositions = buildTreePositions(nodes);
  const existingMap = new Map((existing ?? []).map((node) => [node.id, node.position]));

  return nodes.map((n) => {
    const isSelected = n.id === selectedId;
    const existingPosition = existingMap.get(n.id);
    return {
      id: n.id,
      position: existingPosition ?? fallbackPositions.get(n.id) ?? { x: 0, y: 0 },
      draggable: true,
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
      {mindMaps.map((m) => <Card key={m.id} className="interactive-card" onClick={() => navigate(`/mindmaps/${m.id}`)}><MetadataLine>{new Date(m.updatedAt).toLocaleDateString()}</MetadataLine><h3>{m.title}</h3><p className="muted">{m.nodeCount} nodes</p></Card>)}
    </div>
    {open ? <div className="dialog-backdrop"><Card className="mindmap-modal"><h3>New Mind Map</h3><Input value={title} onChange={(e) => setTitle(e.target.value)} /><div className="row"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={async () => {
      if (!title.trim()) return;
      try { const created = await createMindMap(title.trim()); navigate(`/mindmaps/${created.id}`); } catch (error) { const apiError = error as ApiError; onToast(apiError.message || "Failed to create mind map"); }
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
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await getMindMap(id);
      setDetail(loaded);
      const root = loaded.rootNode.id;
      const nextSelected = selectedId && loaded.nodes.some((n) => n.id === selectedId) ? selectedId : root;
      setSelectedId(nextSelected);
      const active = loaded.nodes.find((n) => n.id === nextSelected);
      setEditingLabel(active?.label ?? "");
      setFlowNodes((existing) => toFlowNodes(loaded.nodes, nextSelected, existing));
      setFlowEdges(
        loaded.nodes
          .filter((n) => n.parentNodeId)
          .map((n) => ({
            id: `${n.parentNodeId}-${n.id}`,
            source: n.parentNodeId as string,
            target: n.id,
            animated: false,
            style: { stroke: "var(--color-accent)", strokeWidth: 2 },
          })),
      );
    } catch (err) {
      const apiError = err as ApiError;
      onToast(apiError.message || "Failed to load mind map");
    } finally {
      setLoading(false);
    }
  }, [id, onToast, selectedId]);

  useEffect(() => { void load(); }, [load]);

  const nodeMap = useMemo(() => Object.fromEntries((detail?.nodes ?? []).map((n) => [n.id, n])), [detail]);
  const selectedNode = selectedId ? nodeMap[selectedId] : null;

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const persistNodePosition = async (nodeId: string, x: number, y: number) => {
    try {
      const target = nodeMap[nodeId];
      if (!target) return;
      await updateMindMapNode(id, nodeId, {
        label: target.label,
        parentNodeId: target.parentNodeId,
        notes: target.notes ?? null,
        sortOrder: target.sortOrder ?? 0,
        x,
        y,
      });
    } catch (error) {
      const apiError = error as ApiError;
      onToast(apiError.message || "Node position save failed");
    }
  };

  const addChild = async () => {
    if (!selectedId) return;
    try {
      const created = await createMindMapNode(id, { parentId: selectedId, label: "New node" });
      setFlowNodes((current) => [...current, ...toFlowNodes([created], created.id)]);
      await load();
      setSelectedId(created.id);
      setEditingLabel(created.label);
    } catch (error) {
      const apiError = error as ApiError;
      onToast(apiError.message || "Failed to add node");
    }
  };

  const saveSelectedLabel = async () => {
    if (!selectedNode) return;
    try {
      await updateMindMapNode(id, selectedNode.id, { label: editingLabel.trim() || "Untitled", parentNodeId: selectedNode.parentNodeId, notes: selectedNode.notes ?? null, sortOrder: selectedNode.sortOrder ?? 0 });
      await load();
      onToast("Node saved");
    } catch (error) {
      const apiError = error as ApiError;
      onToast(apiError.message || "Failed to save node");
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
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            fitView
            onNodesChange={onNodesChange}
            onNodeDragStop={(_event: unknown, node: Node) => void persistNodePosition(node.id, node.position.x, node.position.y)}
            onNodeClick={(_event: unknown, node: Node) => {
              setSelectedId(node.id);
              setEditingLabel(String(nodeMap[node.id]?.label ?? ""));
            }}
          >
            <Controls />
            <Background />
          </ReactFlow>
          <p className="mindmap-hint">Drag nodes to reposition.</p>
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
              try { await deleteMindMapNode(id, selectedNode.id); await load(); } catch (error) { const apiError = error as ApiError; onToast(apiError.message || "Failed to delete node"); }
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
