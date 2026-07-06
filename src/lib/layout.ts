/**
 * Deterministic pathway node layout.
 *
 * Source coordinates (from WikiPathways GPML) preserve topology but frequently
 * overlap once auxiliary GPML elements (groups, labels) are dropped. We seed a
 * short, fixed-iteration collision relaxation at the source coordinates so the
 * approximate topology survives while nodes stop colliding. Reactome pathways
 * (no source layout) start from a deterministic phyllotaxis spiral. The result
 * is stable across runs (no randomness) so SVG exports are reproducible.
 */
import { forceSimulation, forceCollide, forceX, forceY, forceManyBody, type SimulationNodeDatum } from 'd3';
import type { Pathway } from '../types/model';

export interface LaidOutNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
}

export interface LayoutBox {
  width: number;
  height: number;
  nodeW: number;
  nodeH: number;
}

/**
 * Computes pixel positions for a pathway's entities within a box.
 * Deterministic: no Math.random; spiral seeding for missing coordinates.
 */
export function layoutPathway(pathway: Pathway, box: LayoutBox): Map<string, { x: number; y: number }> {
  const { width, height, nodeW } = box;
  const pad = 60;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  const n = pathway.entities.length;

  const hasSourceCoords = pathway.entities.some((e) => e.x != null && e.y != null);

  // Count how many earlier entities share each rounded source coordinate so we
  // can deterministically fan out stacks (GPML group members frequently share
  // identical coordinates once auxiliary elements are dropped).
  const seenAt = new Map<string, number>();

  const nodes: LaidOutNode[] = pathway.entities.map((e, i) => {
    let sx: number, sy: number;
    if (hasSourceCoords && e.x != null && e.y != null) {
      sx = pad + e.x * innerW;
      sy = pad + e.y * innerH;
      const key = `${Math.round(e.x * 200)}:${Math.round(e.y * 200)}`;
      const dup = seenAt.get(key) ?? 0;
      seenAt.set(key, dup + 1);
      if (dup > 0) {
        // Deterministic spiral offset for each duplicate at this coordinate.
        const angle = dup * 2.399963229728653;
        const r = Math.sqrt(dup) * (nodeW * 0.9);
        sx += r * Math.cos(angle);
        sy += r * Math.sin(angle);
      }
    } else {
      // Phyllotaxis spiral (deterministic).
      const angle = i * 2.399963229728653; // golden angle
      const r = Math.sqrt(i / Math.max(1, n)) * (Math.min(innerW, innerH) / 2);
      sx = width / 2 + r * Math.cos(angle);
      sy = height / 2 + r * Math.sin(angle);
    }
    return { id: pathway.entities[i].nodeId, x: sx, y: sy };
  });

  // Collision radius covers the full node width plus a gap so rectangles never touch.
  const collideR = nodeW / 2 + 14;
  // Anchor toward source coords, but keep it weak so collision reliably wins.
  const anchorStrength = hasSourceCoords ? 0.02 : 0.01;
  const sim = forceSimulation(nodes)
    .force('collide', forceCollide<LaidOutNode>(collideR).strength(1).iterations(16))
    .force('x', forceX<LaidOutNode>((d) => d.x!).strength(anchorStrength))
    .force('y', forceY<LaidOutNode>((d) => d.y!).strength(anchorStrength))
    .force('charge', forceManyBody<LaidOutNode>().strength(-60).distanceMax(220))
    .stop();

  // Fixed number of ticks → deterministic.
  const iterations = 600;
  for (let i = 0; i < iterations; i++) sim.tick();

  // Fit the relaxed layout into the box by uniform scale + translate. This keeps
  // relative spacing intact (never restacks outliers the way edge-clamping does).
  const margin = nodeW / 2 + 12;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x); maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y); maxY = Math.max(maxY, node.y);
  }
  const spanX = (maxX - minX) || 1;
  const spanY = (maxY - minY) || 1;
  const availW = width - 2 * margin;
  const availH = height - 2 * margin;
  const scale = Math.min(availW / spanX, availH / spanY, 1);
  // Center the scaled cloud in the box.
  const offsetX = margin + (availW - spanX * scale) / 2;
  const offsetY = margin + (availH - spanY * scale) / 2;

  const out = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    out.set(node.id, {
      x: offsetX + (node.x - minX) * scale,
      y: offsetY + (node.y - minY) * scale,
    });
  }
  return out;
}
