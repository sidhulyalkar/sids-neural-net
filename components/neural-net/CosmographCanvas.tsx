'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { NeuralNode } from '@/lib/data/schemas';
import type { CosmographLink, CosmographNode } from './NeuralGraph';

interface CosmographCanvasProps {
  nodes: CosmographNode[];
  links: CosmographLink[];
  selectedNodeId: string | null;
  onNodeSelect: (node: NeuralNode | null) => void;
}

type Point = { x: number; y: number };
type PositionedNode = CosmographNode & Point;
type View = { x: number; y: number; scale: number };

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startViewX: number;
  startViewY: number;
  moved: boolean;
};

const WORLD_RADIUS = 620;
const MIN_SCALE = 0.2;
const MAX_SCALE = 3.2;

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function unitFromHash(input: string, salt: string): number {
  return hash(`${salt}:${input}`) / 0xffffffff;
}

function buildLayout(nodes: CosmographNode[]): PositionedNode[] {
  const groups = new Map<string, CosmographNode[]>();
  for (const node of nodes) {
    const group = node.domain || 'Unclustered';
    const bucket = groups.get(group) ?? [];
    bucket.push(node);
    groups.set(group, bucket);
  }

  const orderedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const result: PositionedNode[] = [];
  const clusterRadius = orderedGroups.length <= 1 ? 0 : WORLD_RADIUS * 0.58;

  orderedGroups.forEach(([group, groupNodes], groupIndex) => {
    const clusterAngle = -Math.PI / 2 + (groupIndex / Math.max(1, orderedGroups.length)) * Math.PI * 2;
    const centerX = Math.cos(clusterAngle) * clusterRadius;
    const centerY = Math.sin(clusterAngle) * clusterRadius;
    const sorted = [...groupNodes].sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id));

    sorted.forEach((node, nodeIndex) => {
      const rank = nodeIndex + 1;
      const spiralAngle = rank * 2.399963229728653 + unitFromHash(node.id, 'angle') * 0.7;
      const radial = Math.min(245, 18 + Math.sqrt(rank) * 34 + unitFromHash(node.id, 'radius') * 22);
      const importancePull = Math.max(0.52, 1 - node.importance / 180);
      result.push({
        ...node,
        x: centerX + Math.cos(spiralAngle) * radial * importancePull,
        y: centerY + Math.sin(spiralAngle) * radial * importancePull,
      });
    });
  });

  return result;
}

function screenToWorld(point: Point, view: View, width: number, height: number): Point {
  return {
    x: (point.x - width / 2 - view.x) / view.scale,
    y: (point.y - height / 2 - view.y) / view.scale,
  };
}

function nodeRadius(node: CosmographNode, selected: boolean): number {
  return Math.max(3.5, Math.min(20, node.size * (selected ? 1.35 : 1)));
}

function nearestNode(nodes: PositionedNode[], world: Point, viewScale: number): PositionedNode | null {
  let best: PositionedNode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const distance = Math.hypot(node.x - world.x, node.y - world.y);
    const hitRadius = Math.max(nodeRadius(node, false) + 6 / viewScale, 11 / viewScale);
    if (distance <= hitRadius && distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}

function drawLabel(
  context: CanvasRenderingContext2D,
  node: PositionedNode,
  view: View,
  width: number,
  height: number,
  selected: boolean,
) {
  const x = width / 2 + view.x + node.x * view.scale;
  const y = height / 2 + view.y + node.y * view.scale;
  const text = node.label;
  const fontSize = selected ? 13 : 11;
  context.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const metrics = context.measureText(text);
  const paddingX = 7;
  const boxWidth = metrics.width + paddingX * 2;
  const boxHeight = fontSize + 10;
  const boxX = x + nodeRadius(node, selected) * view.scale + 7;
  const boxY = y - boxHeight / 2;
  context.fillStyle = 'rgba(2, 3, 6, 0.88)';
  context.strokeStyle = selected ? 'rgba(248, 251, 255, 0.5)' : 'rgba(102, 227, 255, 0.35)';
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(boxX, boxY, boxWidth, boxHeight, 5);
  context.fill();
  context.stroke();
  context.fillStyle = selected ? '#f8fbff' : '#d9f7ff';
  context.fillText(text, boxX + paddingX, boxY + fontSize + 3);
}

export function CosmographCanvas({ nodes, links, selectedNodeId, onNodeSelect }: CosmographCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 0.7 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const positionedNodes = useMemo(() => buildLayout(nodes), [nodes]);
  const positionById = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setDimensions({ width: rect.width, height: rect.height });
      const fitScale = Math.min(rect.width, rect.height) / (WORLD_RADIUS * 2.35);
      setView((current) => ({ ...current, scale: Math.max(MIN_SCALE, Math.min(1.15, fitScale)) }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = dimensions;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    context.save();
    context.translate(width / 2 + view.x, height / 2 + view.y);
    context.scale(view.scale, view.scale);
    context.lineCap = 'round';

    for (const link of links) {
      const source = positionById.get(link.source);
      const target = positionById.get(link.target);
      if (!source || !target) continue;
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.lineTo(target.x, target.y);
      context.strokeStyle = link.color;
      context.globalAlpha = selectedNodeId && source.id !== selectedNodeId && target.id !== selectedNodeId ? 0.38 : 1;
      context.lineWidth = Math.max(0.55, Math.min(2.8, link.weight / 5));
      context.stroke();
    }
    context.globalAlpha = 1;

    const drawOrder = [...positionedNodes].sort((a, b) => a.importance - b.importance);
    for (const node of drawOrder) {
      const selected = node.id === selectedNodeId;
      const hovered = node.id === hoveredNodeId;
      const radius = nodeRadius(node, selected);
      if (selected || hovered) {
        context.beginPath();
        context.arc(node.x, node.y, radius + (selected ? 5 : 3), 0, Math.PI * 2);
        context.strokeStyle = selected ? '#f8fbff' : '#66e3ff';
        context.lineWidth = selected ? 2 : 1.4;
        context.globalAlpha = 0.82;
        context.stroke();
      }
      context.beginPath();
      context.arc(node.x, node.y, radius, 0, Math.PI * 2);
      context.fillStyle = selected ? '#f8fbff' : node.color;
      context.globalAlpha = selectedNodeId && !selected ? 0.68 : 0.92;
      context.fill();
    }
    context.restore();
    context.globalAlpha = 1;

    const selected = selectedNodeId ? positionById.get(selectedNodeId) : undefined;
    const hovered = hoveredNodeId && hoveredNodeId !== selectedNodeId ? positionById.get(hoveredNodeId) : undefined;
    if (selected) drawLabel(context, selected, view, width, height, true);
    if (hovered) drawLabel(context, hovered, view, width, height, false);
  }, [dimensions, hoveredNodeId, links, positionById, positionedNodes, selectedNodeId, view]);

  const eventPoint = useCallback((clientX: number, clientY: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: 0, y: 0 };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewX: view.x,
      startViewY: view.y,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      setView((current) => ({ ...current, x: drag.startViewX + dx, y: drag.startViewY + dy }));
      return;
    }
    const point = eventPoint(event.clientX, event.clientY);
    const world = screenToWorld(point, view, dimensions.width, dimensions.height);
    setHoveredNodeId(nearestNode(positionedNodes, world, view.scale)?.id ?? null);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved) {
      const point = eventPoint(event.clientX, event.clientY);
      const world = screenToWorld(point, view, dimensions.width, dimensions.height);
      const hit = nearestNode(positionedNodes, world, view.scale);
      onNodeSelect(hit?.neuralNode ?? null);
    }
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = eventPoint(event.clientX, event.clientY);
    const before = screenToWorld(point, view, dimensions.width, dimensions.height);
    const factor = Math.exp(-event.deltaY * 0.0014);
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * factor));
    const nextX = point.x - dimensions.width / 2 - before.x * nextScale;
    const nextY = point.y - dimensions.height / 2 - before.y * nextScale;
    setView({ x: nextX, y: nextY, scale: nextScale });
  };

  const resetView = () => {
    const fitScale = Math.min(dimensions.width, dimensions.height) / (WORLD_RADIUS * 2.35);
    setView({ x: 0, y: 0, scale: Math.max(MIN_SCALE, Math.min(1.15, fitScale)) });
  };

  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden bg-bg-deep">
      <div className="pointer-events-none absolute right-4 top-4 z-10 hidden flex-wrap gap-2 lg:flex">
        <span className="border border-white/10 bg-black/[0.28] px-3 py-1 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-cyan/80 backdrop-blur-md">{nodes.length} neurons</span>
        <span className="border border-white/10 bg-black/[0.28] px-3 py-1 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-violet/70 backdrop-blur-md">{links.length} synapses</span>
        <span className="border border-white/10 bg-black/[0.28] px-3 py-1 font-mono text-[0.64rem] uppercase tracking-[0.16em] text-text-muted backdrop-blur-md">drag · zoom · inspect</span>
      </div>

      <button type="button" onClick={resetView} className="absolute bottom-4 right-4 z-10 border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-white/55 backdrop-blur transition hover:border-cyan/30 hover:text-cyan">fit graph</button>

      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Interactive neural atlas with ${nodes.length} nodes and ${links.length} connections. Drag to pan, scroll to zoom, and click a node to inspect it.`}
        tabIndex={0}
        className="h-full w-full cursor-grab touch-none outline-none focus:ring-1 focus:ring-inset focus:ring-cyan/40 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => { if (!dragRef.current) setHoveredNodeId(null); }}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; }}
        onWheel={onWheel}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onNodeSelect(null);
          if (event.key === '0') resetView();
          if (event.key === '+' || event.key === '=') setView((current) => ({ ...current, scale: Math.min(MAX_SCALE, current.scale * 1.15) }));
          if (event.key === '-') setView((current) => ({ ...current, scale: Math.max(MIN_SCALE, current.scale / 1.15) }));
        }}
      />

      <p className="sr-only">The visual graph is supplemented by the site search and project lists for keyboard and screen-reader navigation.</p>
    </div>
  );
}
