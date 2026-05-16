import { useCallback, useEffect } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TableNode } from './TableNode';
import { layoutSchema, type TableNodeData } from './layout';
import type { Schema } from './types';

const nodeTypes: NodeTypes = {
  tableNode: TableNode as unknown as NodeTypes[string],
};

export interface ERDiagramProps {
  schema: Schema;
  /** Filter to a single schema name (e.g. "public"). Default: all schemas. */
  schemaFilter?: string;
  /** Layout direction. Default: left-to-right. */
  direction?: 'LR' | 'TB';
  /** Called when the user clicks a table. */
  onTableClick?: (schema: string, table: string) => void;
}

export function ERDiagram(props: ERDiagramProps) {
  // Wrap with provider so the inner view can call useReactFlow() (needed for
  // the "Re-layout" control to fit-view after the snap).
  return (
    <ReactFlowProvider>
      <ERDiagramInner {...props} />
    </ReactFlowProvider>
  );
}

function ERDiagramInner({ schema, schemaFilter, direction, onTableClick }: ERDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  // Re-run Dagre layout whenever the schema (or filter/direction) changes.
  // While the user drags nodes, the schema reference is stable, so positions
  // are preserved.
  useEffect(() => {
    const laid = layoutSchema(schema, { schemaFilter, direction });
    setNodes(laid.nodes);
    setEdges(laid.edges);
  }, [schema, schemaFilter, direction, setNodes, setEdges]);

  const relayout = useCallback(() => {
    const laid = layoutSchema(schema, { schemaFilter, direction });
    setNodes(laid.nodes);
    setEdges(laid.edges);
    // Defer fitView so React Flow has time to apply the new positions.
    requestAnimationFrame(() => fitView({ duration: 300 }));
  }, [schema, schemaFilter, direction, setNodes, setEdges, fitView]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_event, node) => {
          const data = node.data as TableNodeData;
          if (onTableClick && data?.table) {
            onTableClick(data.table.schema, data.table.name);
          }
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <MiniMap pannable zoomable className="!bg-card !border" />
        <Controls className="!bg-card !border">
          <ControlButton onClick={relayout} title="Auto-layout">
            <RelayoutIcon />
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
  );
}

function RelayoutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3h7v7H3z" />
      <path d="M14 3h7v7h-7z" />
      <path d="M14 14h7v7h-7z" />
      <path d="M3 14h7v7H3z" />
    </svg>
  );
}
