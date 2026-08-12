// Netlist computation via union-find over wire points + pin positions.
import { SchematicDoc, SchematicWire, pointToSegmentDistance } from "./schematic";
import { SYMBOLS, transformedPins } from "./symbols";

const EPS = 0.45;

interface PinRef { nodeId: string; pinIndex: number; x: number; y: number; }

export interface Net {
  id: number;
  wireIds: Set<string>;
  pins: PinRef[];
}

export interface NetIndex {
  nets: Net[];
  wireNet: Map<string, number>;
  pinNet: Map<string, number>; // key = `${nodeId}:${pinIndex}`
  gridNet: Map<string, number>; // key = `${x*10},${y*10}`
}

class UF {
  parent = new Map<string, string>();
  find(x: string): string {
    const p = this.parent.get(x);
    if (!p || p === x) { this.parent.set(x, x); return x; }
    const r = this.find(p);
    this.parent.set(x, r);
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export function buildNetIndex(doc: SchematicDoc): NetIndex {
  const uf = new UF();
  const wireKey = (id: string) => `W:${id}`;
  const pinKey = (n: string, i: number) => `P:${n}:${i}`;

  // Collect pins
  const pins: PinRef[] = [];
  for (const n of doc.nodes) {
    const sym = SYMBOLS[n.symbol];
    if (!sym) continue;
    transformedPins(sym, n.rotation).forEach((p, i) => {
      pins.push({ nodeId: n.id, pinIndex: i, x: n.x + p.x, y: n.y + p.y });
    });
    for (let i = 0; i < sym.pins.length; i++) uf.find(pinKey(n.id, i));
  }
  for (const w of doc.wires) uf.find(wireKey(w.id));

  // Union wires that share any vertex (endpoints or interior).
  const ptKey = (p: { x: number; y: number }) => `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`;
  const wiresByPt = new Map<string, string[]>();
  for (const w of doc.wires) {
    for (const p of w.points) {
      const k = ptKey(p);
      const arr = wiresByPt.get(k) ?? [];
      arr.push(w.id);
      wiresByPt.set(k, arr);
    }
  }
  for (const arr of wiresByPt.values()) {
    for (let i = 1; i < arr.length; i++) uf.union(wireKey(arr[0]), wireKey(arr[i]));
  }

  // Union wires whose segment passes through another wire's vertex (T-junction)
  for (const w of doc.wires) {
    for (let i = 0; i < w.points.length - 1; i++) {
      const a = w.points[i], b = w.points[i + 1];
      for (const ow of doc.wires) {
        if (ow.id === w.id) continue;
        for (const p of ow.points) {
          if (pointToSegmentDistance(p, a, b) <= EPS) {
            uf.union(wireKey(w.id), wireKey(ow.id));
          }
        }
      }
    }
  }

  // Union pins to wires they touch (endpoint coincidence OR mid-segment).
  for (const pr of pins) {
    for (const w of doc.wires) {
      let touched = false;
      for (const p of w.points) {
        if (Math.hypot(p.x - pr.x, p.y - pr.y) < EPS) { touched = true; break; }
      }
      if (!touched) {
        for (let i = 0; i < w.points.length - 1; i++) {
          if (pointToSegmentDistance(pr, w.points[i], w.points[i + 1]) <= EPS) { touched = true; break; }
        }
      }
      if (touched) uf.union(pinKey(pr.nodeId, pr.pinIndex), wireKey(w.id));
    }
  }

  // Group by root
  const groups = new Map<string, { wires: Set<string>; pins: PinRef[] }>();
  for (const w of doc.wires) {
    const r = uf.find(wireKey(w.id));
    const g = groups.get(r) ?? { wires: new Set(), pins: [] };
    g.wires.add(w.id);
    groups.set(r, g);
  }
  for (const pr of pins) {
    const r = uf.find(pinKey(pr.nodeId, pr.pinIndex));
    const g = groups.get(r) ?? { wires: new Set(), pins: [] };
    g.pins.push(pr);
    groups.set(r, g);
  }

  const nets: Net[] = [];
  const wireNet = new Map<string, number>();
  const pinNet = new Map<string, number>();
  const gridNet = new Map<string, number>();
  let idx = 0;
  for (const g of groups.values()) {
    if (g.wires.size === 0 && g.pins.length === 0) continue;
    const net: Net = { id: idx, wireIds: g.wires, pins: g.pins };
    nets.push(net);
    for (const wid of g.wires) {
      wireNet.set(wid, idx);
      const wire = doc.wires.find(w => w.id === wid);
      if (wire) {
        wire.points.forEach(p => {
          gridNet.set(`${Math.round(p.x * 10)},${Math.round(p.y * 10)}`, idx);
        });
      }
    }
    for (const pr of g.pins) {
      pinNet.set(`${pr.nodeId}:${pr.pinIndex}`, idx);
      gridNet.set(`${Math.round(pr.x * 10)},${Math.round(pr.y * 10)}`, idx);
    }
    idx++;
  }
  return { nets, wireNet, pinNet, gridNet };
}

export function netIdForSelection(
  idx: NetIndex,
  sel: { wireId?: string | null; nodeId?: string | null }
): number | null {
  if (sel.wireId) {
    const n = idx.wireNet.get(sel.wireId);
    return n ?? null;
  }
  if (sel.nodeId) {
    // Return first net touching any pin of the node.
    for (const [k, n] of idx.pinNet) {
      if (k.startsWith(sel.nodeId + ":")) return n;
    }
  }
  return null;
}
