import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { PropsWithChildren } from "react";

export type Node = {
  id: string;
  data: { label: ReactNode };
  position: { x: number; y: number };
  selected?: boolean;
  style?: CSSProperties;
};

export type Edge = { id: string; source: string; target: string };
export type NodeChange = { id: string; type: "select" | "position" };
export type OnNodeDrag = (event: MouseEvent, node: Node) => void;

export const applyNodeChanges = (_changes: NodeChange[], nodes: Node[]) => nodes;

const ReactFlow = ({ nodes, children, onNodeClick, onNodeDoubleClick, onNodeContextMenu }: PropsWithChildren<{
  nodes: Node[];
  edges: Edge[];
  fitView?: boolean;
  onNodesChange?: (changes: NodeChange[]) => void;
  onNodeClick?: (event: MouseEvent, node: Node) => void;
  onNodeDoubleClick?: (event: MouseEvent, node: Node) => void;
  onNodeContextMenu?: (event: MouseEvent, node: Node) => void;
  onNodeDragStop?: OnNodeDrag;
}>) => (
  <div style={{ width: "100%", height: "100%", position: "relative", overflow: "auto" }}>
    {nodes.map((node) => (
      <button
        key={node.id}
        type="button"
        style={{ position: "absolute", left: node.position.x + 400, top: node.position.y + 40, ...node.style }}
        onClick={(event) => onNodeClick?.(event, node)}
        onDoubleClick={(event) => onNodeDoubleClick?.(event, node)}
        onContextMenu={(event) => onNodeContextMenu?.(event, node)}
      >
        {node.data.label}
      </button>
    ))}
    {children}
  </div>
);

export const Controls = () => null;
export const Background = () => null;
export default ReactFlow;
