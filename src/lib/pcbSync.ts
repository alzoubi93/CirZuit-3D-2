// Sync layer: keep PCB footprints + ratsnest in step with the schematic.
import { SchematicDoc } from "./schematic";
import { SYMBOLS, transformedPins } from "./symbols";
import { PcbDoc, PcbFootprint, PcbFootprintPad, emptyPcbDoc } from "./pcb";
import { buildNetIndex } from "./netlist";
import { getPackagesForSymbol, ComponentPackage } from "./electronicsLibrary";
import { getElectrolyticSize } from "../components/editor/ThreeDRealModels";

/** Convert schematic grid units → millimetres. 2.54 mm = 100 mil = standard. */
export const SCH_TO_MM = 2.54;

export function makePadsForSymbol(symId: string, node?: any, pkgId?: string): PcbFootprintPad[] {
  const sym = SYMBOLS[symId];
  if (!sym) return [];

  const pkgs = getPackagesForSymbol(symId);
  const pkg = pkgs.find(p => p.id === pkgId) || pkgs[0]; // Use selected or first (default)

  if (symId.startsWith("CONN_")) {
    const meta = node?.metadata;
    if (meta?.type === "SCREW_TERMINAL" || symId.startsWith("CONN_SCREW_")) {
      const parts = symId.split("_");
      const poles = meta?.poles || parseInt(parts[2]?.replace("P", ""), 10) || sym.pins.length || 2;
      const pitch = meta?.pitch || parseFloat(parts[3]?.replace("MM", "")) || 5.08;
      
      let drillHole = meta?.drillHole;
      let padDiameter = meta?.padDiameter;

      if (!drillHole || !padDiameter) {
        if (pitch >= 5.0) {
          drillHole = 1.30;
          padDiameter = 2.40;
        } else {
          drillHole = 1.10;
          padDiameter = 1.90;
        }
      }

      return sym.pins.map((p, i) => {
        const x = (i - (poles - 1) / 2) * pitch;
        const y = 0;
        return {
          pinIndex: i,
          number: p.name,
          name: p.name,
          x,
          y,
          width: padDiameter,
          height: padDiameter,
          shape: i === 0 ? "rect" : "circle",
          layer: "multi_layer",
          drill: drillHole,
        };
      });
    }

    const parts = symId.split("_");
    const r_p = parts[2].split("x");
    const rows = parseInt(r_p[0], 10) || 1;
    const cols = parseInt(r_p[1], 10) || 1;
    const pitch = parseFloat(parts[3]) || 2.54;
    
    let drillHole = 1.00;
    let padDiameter = 1.70;
    
    if (Math.abs(pitch - 1.27) < 0.01) {
      drillHole = 0.65;
      padDiameter = 1.00;
    } else if (Math.abs(pitch - 2.00) < 0.01) {
      drillHole = 0.80;
      padDiameter = 1.30;
    } else {
      drillHole = 1.00;
      padDiameter = 1.70;
    }

    return sym.pins.map((p, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = (c - (cols - 1) / 2) * pitch;
      const y = (r - (rows - 1) / 2) * pitch;

      return {
        pinIndex: i,
        number: p.name,
        name: p.name,
        x,
        y,
        width: padDiameter,
        height: padDiameter,
        shape: i === 0 ? "rect" : "circle",
        layer: "multi_layer",
        drill: drillHole,
      };
    });
  }


  const actualPkgId = pkg.id;
  const idLower = symId.toLowerCase();

  const isPolarCap = 
    idLower.includes("capacitor_polar") || 
    idLower.includes("cpol") || 
    idLower.includes("cap_pol") ||
    idLower.includes("cp") ||
    idLower.includes("elko") ||
    (node?.reference && node.reference.toLowerCase().startsWith("c") && idLower.includes("polar"));
  if (isPolarCap && sym.pins.length >= 2) {
    const capVal = node?.value || node?.val || "10uF";
    const capSize = getElectrolyticSize(capVal);
    const pitch = capSize.pitch;
    return sym.pins.slice(0, 2).map((p, i) => {
      const padNumber = p.name && /^\d+$/.test(p.name) ? p.name : String(i + 1);
      return {
        pinIndex: i,
        number: padNumber,
        name: i === 0 ? "+" : "-",
        x: i === 0 ? -pitch / 2 : pitch / 2,
        y: 0,
        width: capSize.padDia,
        height: capSize.padDia,
        shape: i === 0 ? "rect" : "circle",
        layer: "multi_layer",
        drill: capSize.drill,
      };
    });
  }
  const isTransistorOrRegulator =
    idLower.includes("npn") ||
    idLower.includes("pnp") ||
    idLower.includes("transistor") ||
    idLower.includes("mosfet") ||
    idLower.includes("bjt") ||
    idLower.includes("2n2222") ||
    idLower.includes("bc547") ||
    idLower.includes("irf540") ||
    idLower.includes("regulator") ||
    idLower.includes("7805") ||
    idLower.includes("7812") ||
    idLower.includes("lm317") ||
    idLower.includes("ams1117");

  // TO-92 Footprint (IPC-7351 Standard: 3 inline pins with 2.54mm pitch)
  if (actualPkgId === "to92" || (isTransistorOrRegulator && pkg.type === "DIP" && !actualPkgId.includes("to220") && !idLower.includes("to220") && !idLower.includes("irf") && !idLower.includes("7805") && !idLower.includes("7812") && !idLower.includes("lm317"))) {
    const pitch = 2.54; // 100 mil standard IPC pitch
    return sym.pins.slice(0, 3).map((p, i) => {
      const padNumber = p.name && /^\d+$/.test(p.name) ? p.name : String(i + 1);
      return {
        pinIndex: i,
        number: padNumber,
        name: p.name,
        x: (i - 1) * pitch, // Pin 1: -2.54, Pin 2: 0, Pin 3: 2.54
        y: 0,
        width: pkg.padW || 1.5,
        height: pkg.padH || 1.5,
        shape: "circle",
        layer: "multi_layer",
        drill: pkg.drill || 0.8,
      };
    });
  }

  // TO-220 Footprint (IPC-7351 Standard: 3 power pins inline with 2.54mm pitch, 1.0mm drill)
  if (actualPkgId === "to220" || (isTransistorOrRegulator && pkg.type === "DIP" && (actualPkgId.includes("to220") || idLower.includes("to220") || idLower.includes("irf") || idLower.includes("7805") || idLower.includes("7812") || idLower.includes("lm317")))) {
    const pitch = 2.54;
    return sym.pins.slice(0, 3).map((p, i) => {
      const padNumber = p.name && /^\d+$/.test(p.name) ? p.name : String(i + 1);
      return {
        pinIndex: i,
        number: padNumber,
        name: p.name,
        x: (i - 1) * pitch, // Pin 1: -2.54, Pin 2: 0, Pin 3: 2.54
        y: 0,
        width: pkg.padW || 2.0,
        height: pkg.padH || 2.0,
        shape: "circle",
        layer: "multi_layer",
        drill: pkg.drill || 1.0,
      };
    });
  }

  // SOT-23 Footprint (IPC-7351 Standard SOT-23-3)
  if (actualPkgId === "sot23") {
    const sot23Pads = [
      { x: -0.95, y: -1.0, w: 0.8, h: 1.0 },
      { x: 0.95, y: -1.0, w: 0.8, h: 1.0 },
      { x: 0, y: 1.0, w: 0.8, h: 1.0 },
    ];
    return sym.pins.slice(0, 3).map((p, i) => {
      const padNumber = p.name && /^\d+$/.test(p.name) ? p.name : String(i + 1);
      const pos = sot23Pads[i] || { x: (i - 1) * 0.95, y: i === 2 ? 1.0 : -1.0, w: 0.8, h: 1.0 };
      return {
        pinIndex: i,
        number: padNumber,
        name: p.name,
        x: pos.x,
        y: pos.y,
        width: pos.w,
        height: pos.h,
        shape: "rect",
        layer: "top_copper",
        drill: 0,
      };
    });
  }

  // SOT-223 Footprint (IPC-7351 Standard)
  if (actualPkgId === "sot223") {
    const sot223Pads = [
      { x: -2.3, y: -3.1, w: 1.2, h: 1.6 },
      { x: 0, y: -3.1, w: 1.2, h: 1.6 },
      { x: 2.3, y: -3.1, w: 1.2, h: 1.6 },
      { x: 0, y: 3.1, w: 3.3, h: 1.8 },
    ];
    return sym.pins.map((p, i) => {
      const padNumber = p.name && /^\d+$/.test(p.name) ? p.name : String(i + 1);
      const pos = sot223Pads[i] || { x: (i - 1) * 2.3, y: -3.1, w: 1.2, h: 1.6 };
      return {
        pinIndex: i,
        number: padNumber,
        name: p.name,
        x: pos.x,
        y: pos.y,
        width: pos.w,
        height: pos.h,
        shape: "rect",
        layer: "top_copper",
        drill: 0,
      };
    });
  }

  // DPAK / TO-252 Footprint (IPC-7351 Standard)
  if (actualPkgId === "dpak") {
    const dpakPads = [
      { x: -2.28, y: -3.8, w: 1.4, h: 2.2 },
      { x: 2.28, y: -3.8, w: 1.4, h: 2.2 },
      { x: 0, y: 2.5, w: 6.2, h: 6.2 },
    ];
    return sym.pins.slice(0, 3).map((p, i) => {
      const padNumber = p.name && /^\d+$/.test(p.name) ? p.name : String(i + 1);
      const pos = dpakPads[i] || { x: 0, y: 0, w: 1.4, h: 2.2 };
      return {
        pinIndex: i,
        number: padNumber,
        name: p.name,
        x: pos.x,
        y: pos.y,
        width: pos.w,
        height: pos.h,
        shape: "rect",
        layer: "top_copper",
        drill: 0,
      };
    });
  }

  if (actualPkgId === "dip_300" || actualPkgId === "soic" || actualPkgId === "tssop") {
    const half = sym.pins.length / 2;
    let pitch = 2.54;
    let rowSpacing = 7.62;
    if (actualPkgId === "soic") {
      pitch = 1.27;
      rowSpacing = 5.90;
    } else if (actualPkgId === "tssop") {
      pitch = 0.65;
      rowSpacing = 5.70;
    }

    const padW = pkg.padW;
    const padH = pkg.padH;
    const drill = pkg.drill;

    return sym.pins.map((p, i) => {
      const padNumber = p.name && /^\d+$/.test(p.name) ? p.name : String(i + 1);
      const isLeft = p.x < sym.width / 2;
      const rowIdx = isLeft ? Math.round(p.y) - 1 : half - Math.round(p.y);

      const px = isLeft ? 0 : rowSpacing;
      const py = (rowIdx + 1) * pitch;

      return {
        pinIndex: i,
        number: padNumber,
        name: p.name,
        x: px,
        y: py,
        width: padW,
        height: padH,
        shape: pkg.type === "DIP" ? "circle" : "rect",
        layer: pkg.type === "DIP" ? "multi_layer" : "top_copper",
        drill: drill,
      };
    });
  }

  let scaleX = pkg.scaleX;
  const scaleY = pkg.scaleY;

  if (idLower.includes("esp32")) {
    scaleX = 25.4 / (6 * SCH_TO_MM); // standard 1.0 inch (25.4 mm) row spacing
  } else if (idLower.includes("esp8266") || idLower.includes("nodemcu")) {
    scaleX = 22.86 / (6 * SCH_TO_MM); // standard 0.9 inch (22.86 mm) row spacing
  } else if (idLower.includes("pico") || idLower.includes("rp2040")) {
    scaleX = 17.78 / (6 * SCH_TO_MM); // standard 0.7 inch (17.78 mm) row spacing
  } else if (idLower.includes("uno") || idLower.includes("mega")) {
    scaleX = 45.72 / (6 * SCH_TO_MM); // standard 1.8 inch (45.72 mm) row spacing
  } else if (idLower.includes("nano") || idLower.includes("mini")) {
    scaleX = 15.24 / (6 * SCH_TO_MM); // standard 0.6 inch (15.24 mm) row spacing
  } else if (idLower.includes("bluepill")) {
    scaleX = 15.24 / (6 * SCH_TO_MM); // standard 0.6 inch (15.24 mm) row spacing
  }

  const padW = pkg.padW;
  const padH = pkg.padH;
  const drill = pkg.drill;

  return sym.pins.map((p, i) => {
    // Use pin name if it's a number (common for ICs), otherwise fallback to index+1
    const padNumber = p.name && /^\d+$/.test(p.name) ? p.name : String(i + 1);
    
    return {
      pinIndex: i,
      number: padNumber,
      name: p.name,
      x: p.x * SCH_TO_MM * scaleX,
      y: p.y * SCH_TO_MM * scaleY,
      width: padW,
      height: padH,
      shape: pkg.type === "DIP" ? "circle" : "rect",
      layer: pkg.type === "DIP" ? "multi_layer" : "top_copper",
      drill: drill,
    };
  });
}

/** Lay out a brand-new footprint in a free spot inside the board. */
function pickInitialPosition(pcb: PcbDoc, index: number): { x: number; y: number } {
  const cols = Math.max(2, Math.floor(pcb.width / 10));
  const c = index % cols;
  const r = Math.floor(index / cols);
  return { x: 6 + c * 10, y: 6 + r * 10 };
}

/**
 * Reconcile pcb.footprints with the current schematic.
 */
export function syncPcbWithSchematic(schematic: SchematicDoc, pcbIn: PcbDoc, packageOptions?: Record<string, string>): PcbDoc {
  const pcb: PcbDoc = {
    ...pcbIn,
    footprints: pcbIn.footprints ?? [],
    ratsnestVisible: pcbIn.ratsnestVisible ?? true,
    tracks: pcbIn.tracks ?? [],
    vias: pcbIn.vias ?? [],
    pads: pcbIn.pads ?? [],
    measures: pcbIn.measures ?? [],
  };
  const byId = new Map(pcb.footprints.map((f) => [f.id, f]));
  let changed = pcb !== pcbIn;

  let nextIndex = pcb.footprints.length;
  const nextFps: PcbFootprint[] = [];

  for (const node of schematic.nodes) {
    const prev = byId.get(node.id);
    const pkgId = packageOptions?.[node.id];
    const pads = makePadsForSymbol(node.symbol, node, pkgId);
    if (!prev) {
      const pos = pickInitialPosition(pcb, nextIndex++);
      nextFps.push({
        id: node.id,
        reference: node.reference,
        value: node.value,
        symbol: node.symbol,
        x: pos.x,
        y: pos.y,
        rotation: 0,
        pads,
      });
      changed = true;
    } else {
      const same =
        prev.reference === node.reference &&
        prev.value === node.value &&
        prev.symbol === node.symbol &&
        (!pkgId || prev.packageId === pkgId); // Force update if package changed
      
      const padsChanged = JSON.stringify(prev.pads) !== JSON.stringify(pads);
      if (same && !padsChanged) {
        nextFps.push(prev);
      } else {
        nextFps.push({
          ...prev,
          reference: node.reference,
          value: node.value,
          symbol: node.symbol,
          packageId: pkgId,
          pads: pads, // Always update pads if something changed, forced, or pads coordinates/count changed
        });
        changed = true;
      }
    }
  }

  // Preserve manually added custom footprints (which do not correspond to any schematic node)
  for (const fp of pcb.footprints) {
    const isCustom = !schematic.nodes.some((node) => node.id === fp.id);
    if (isCustom) {
      if (fp.id.startsWith("custom-fp-")) {
        nextFps.push(fp);
      } else {
        changed = true;
      }
    }
  }

  // Skip expensive track connectivity grouping for imported boards or huge track counts
  if (pcb.isImportedGerber || pcb.tracks.length > 800) {
    if (!changed && nextFps.length === pcb.footprints.length) return pcb;
    return { ...pcb, footprints: nextFps };
  }

  // 1. Group the PCB tracks into electrically connected components (track groups)
  const trackGroups: any[][] = [];
  const visited = new Set<string>();
  
  for (const track of pcb.tracks) {
    if (visited.has(track.id)) continue;
    const group: any[] = [];
    const queue = [track];
    visited.add(track.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      group.push(current);
      for (const other of pcb.tracks) {
        if (visited.has(other.id)) continue;
        let touches = false;
        for (const p1 of current.points) {
          if (!p1) continue;
          for (const p2 of other.points) {
            if (!p2) continue;
            if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 0.4) {
              touches = true;
              break;
            }
          }
          if (touches) break;
        }
        if (touches) {
          visited.add(other.id);
          queue.push(other);
        }
      }
    }
    trackGroups.push(group);
  }

  // 2. Map all pads of the soon-to-be-reconciled standard footprints
  const allPads: {
    fpId: string;
    pinIndex: number;
    worldX: number;
    worldY: number;
    pinKey: string;
  }[] = [];

  nextFps.forEach(fp => {
    if (fp.id.startsWith("custom-fp-")) return;
    
    const rad = (fp.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    fp.pads.forEach(pad => {
      if (!pad) return;
      const worldX = fp.x + (pad.x * cos - pad.y * sin);
      const worldY = fp.y + (pad.x * sin + pad.y * cos);
      const pinKey = `${fp.id}:${pad.pinIndex}`;
      allPads.push({
        fpId: fp.id,
        pinIndex: pad.pinIndex,
        worldX,
        worldY,
        pinKey
      });
    });
  });

  // 3. Build net index of the new schematic
  const netIndex = buildNetIndex(schematic);

  // 4. Filter tracks
  const nextTracks = pcb.tracks.filter((track) => {
    // Find the group this track belongs to
    const group = trackGroups.find(g => g.some(t => t.id === track.id)) || [track];
    
    // Find which standard pads are touched by this group
    const touchedPads = allPads.filter(ap => {
      return group.some(t => {
        return t.points.some(pt => Math.hypot(pt.x - ap.worldX, pt.y - ap.worldY) < 0.6);
      });
    });

    if (touchedPads.length > 0) {
      const padNets = touchedPads.map(p => netIndex.pinNet.get(p.pinKey));
      const uniqueNets = Array.from(new Set(padNets.filter(id => id !== undefined)));
      const hasUnconnected = padNets.some(netId => netId === undefined);

      if (hasUnconnected || uniqueNets.length > 1) {
        changed = true;
        return false;
      }
    } else {
      // Orphaned track (doesn't touch any schematic pads)
      // We'll remove it if it's not a custom footprint pad or manually added top-level pad
      // This ensures that when a component or connection is removed in schematic, 
      // the associated traces also get cleaned up if they are no longer linked.
      const touchesAnyPad = pcb.pads.some(p => {
        return track.points.some(pt => Math.hypot(pt.x - p.x, pt.y - p.y) < 0.6);
      });
      
      if (!touchesAnyPad) {
        changed = true;
        return false;
      }
    }
    return true;
  });

  if (nextFps.length !== pcb.footprints.length || nextTracks.length !== pcb.tracks.length) changed = true;
  if (!changed) return pcb;
  return { ...pcb, footprints: nextFps, tracks: nextTracks };
}

/* ------------------------------ Ratsnest ------------------------------ */

export interface RatsnestPad {
  nodeId: string;
  pinIndex: number;
  x: number; y: number; // absolute mm
}

export interface RatsnestLine {
  netId: number;
  color: string;
  a: RatsnestPad;
  b: RatsnestPad;
}

const NET_COLORS = [
  "#f87171", "#facc15", "#34d399", "#60a5fa", "#a78bfa",
  "#f472b6", "#fb923c", "#22d3ee", "#84cc16", "#e879f9",
];
export const netColor = (id: number) => NET_COLORS[id % NET_COLORS.length];

/** Rotate a footprint-local pad position by the footprint's rotation. */
function rotateLocal(p: { x: number; y: number }, rot: number) {
  const r = (rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export function getRatsnestPads(pcb: PcbDoc): Map<string, RatsnestPad> {
  const out = new Map<string, RatsnestPad>();
  for (const fp of pcb.footprints ?? []) {
    for (const pad of fp.pads) {
      const r = rotateLocal({ x: pad.x, y: pad.y }, fp.rotation);
      out.set(`${fp.id}:${pad.pinIndex}`, {
        nodeId: fp.id,
        pinIndex: pad.pinIndex,
        x: fp.x + r.x,
        y: fp.y + r.y,
      });
    }
  }
  return out;
}

/** Compute MST-style ratsnest lines from the schematic netlist + footprint geometry. */
export function computeRatsnest(schematic: SchematicDoc, pcb: PcbDoc): RatsnestLine[] {
  if (pcb?.isImportedGerber || !schematic?.nodes?.length) return [];
  const idx = buildNetIndex(schematic);
  const padPos = getRatsnestPads(pcb);
  const lines: RatsnestLine[] = [];
  for (const net of idx.nets) {
    if (net.pins.length < 2) continue;
    const pts: RatsnestPad[] = [];
    for (const p of net.pins) {
      const pp = padPos.get(`${p.nodeId}:${p.pinIndex}`);
      if (pp) pts.push(pp);
    }
    if (pts.length < 2) continue;
    const used = new Set<number>([0]);
    const remaining = new Set<number>(pts.map((_, i) => i).slice(1));
    const color = netColor(net.id);
    while (remaining.size) {
      let best: { i: number; j: number; d: number } | null = null;
      for (const i of used) {
        for (const j of remaining) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (!best || d < best.d) best = { i, j, d };
        }
      }
      if (!best) break;
      lines.push({ netId: net.id, color, a: pts[best.i], b: pts[best.j] });
      used.add(best.j);
      remaining.delete(best.j);
    }
  }
  return lines;
}

/** Bounding box (mm) of a footprint, used to draw an outline + select. */
export function footprintBBox(fp: PcbFootprint) {
  if (!fp.pads.length) return { x: fp.x - 1, y: fp.y - 1, w: 2, h: 2 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const sym = (fp.symbol || "").toLowerCase();
  const ref = (fp.reference || "").toLowerCase();
  const val = (fp.value || "").toLowerCase();

  const isScrewTerminal = sym.startsWith("conn_screw") || sym.includes("screw") || sym.includes("terminal") || (fp as any).metadata?.type === "SCREW_TERMINAL";
  if (isScrewTerminal) {
    const poles = fp.pads.length || 2;
    let pitch = (fp as any).metadata?.pitch || 5.08;
    if (fp.pads.length > 1) {
      pitch = Math.hypot(fp.pads[1].x - fp.pads[0].x, fp.pads[1].y - fp.pads[0].y) || pitch;
    }
    const width = poles * pitch;
    const depth = 8.5;
    return {
      x: fp.x - width / 2,
      y: fp.y - depth / 2,
      w: width,
      h: depth,
    };
  }

  const isESP32 = sym.includes("esp32") || val.includes("esp32");
  const isESP8266 = sym.includes("esp8266") || val.includes("esp8266") || val.includes("nodemcu");
  const isArduinoNano = (sym.includes("arduino") && sym.includes("nano")) || (val.includes("arduino") && val.includes("nano"));
  const isArduinoMini = (sym.includes("arduino") && sym.includes("mini")) || (val.includes("arduino") && val.includes("mini"));
  const isArduinoUno = (sym.includes("arduino") && (sym.includes("uno") || sym.includes("mega"))) || (val.includes("arduino") && (val.includes("uno") || val.includes("mega")));
  const isRaspberryPico = sym.includes("pico") || sym.includes("rp2040") || val.includes("pico") || val.includes("rp2040");
  const isBoardController = isESP32 || isESP8266 || isArduinoNano || isArduinoMini || isArduinoUno || isRaspberryPico;

  if (isBoardController) {
    let bW = 20;
    let bH = 30;
    if (isESP32) { bW = 27.94; bH = 54.61; }
    else if (isESP8266) { bW = 25.4; bH = 48.0; }
    else if (isArduinoNano) { bW = 17.78; bH = 43.18; }
    else if (isArduinoMini) { bW = 17.78; bH = 33.02; }
    else if (isArduinoUno) { bW = 53.34; bH = 68.6; }
    else if (isRaspberryPico) { bW = 21.0; bH = 51.0; }

    let sumX = 0, sumY = 0;
    for (const p of fp.pads) {
      sumX += p.x;
      sumY += p.y;
    }
    const cx = sumX / fp.pads.length;
    const cy = sumY / fp.pads.length;

    const halfW = bW / 2;
    const halfH = bH / 2;
    const corners = [
      { x: cx - halfW, y: cy - halfH },
      { x: cx + halfW, y: cy - halfH },
      { x: cx - halfW, y: cy + halfH },
      { x: cx + halfW, y: cy + halfH },
    ];

    for (const c of corners) {
      const r = rotateLocal(c, fp.rotation);
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x);
      maxY = Math.max(maxY, r.y);
    }
  } else {
    const isPolarCap = sym.includes("capacitor_polar") || sym.includes("cpol") || (ref.startsWith("c") && sym.includes("polar"));

    if (isPolarCap && fp.pads.length >= 2) {
      const pad0 = fp.pads[0];
      const pad1 = fp.pads[1];
      const capValRaw = fp.value || fp.val || "10uF";
      const capSize = getElectrolyticSize(capValRaw);
      const d = Math.hypot(pad0.x - pad1.x, pad0.y - pad1.y);
      const r = Math.max(capSize.w / 2, d / 2 + 0.3);
      const cx = (pad0.x + pad1.x) / 2;
      const cy = (pad0.y + pad1.y) / 2;
      const centerLocal = { x: cx, y: cy };
      const centerRotated = rotateLocal(centerLocal, fp.rotation);
      minX = centerRotated.x - r;
      minY = centerRotated.y - r;
      maxX = centerRotated.x + r;
      maxY = centerRotated.y + r;
    } else {
      for (const p of fp.pads) {
        const r = rotateLocal({ x: p.x, y: p.y }, fp.rotation);
        minX = Math.min(minX, r.x - p.width / 2);
        minY = Math.min(minY, r.y - p.height / 2);
        maxX = Math.max(maxX, r.x + p.width / 2);
        maxY = Math.max(maxY, r.y + p.height / 2);
      }
    }
  }

  const pad = 0.8;
  return {
    x: fp.x + minX - pad,
    y: fp.y + minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

export { emptyPcbDoc };

export interface EcoDiff {
  add: { id: string; reference: string; symbol: string }[];
  remove: { id: string; reference: string }[];
  update: { id: string; reference: string; changes: string[] }[];
}

export function computeEcoDiff(schematic: import("./schematic").SchematicDoc, pcb: PcbDoc | undefined): EcoDiff {
  const diff: EcoDiff = { add: [], remove: [], update: [] };
  if (!pcb) return diff;
  
  const schNodes = new Map(schematic.nodes.map((n) => [n.id, n]));
  const pcbFps = new Map((pcb.footprints ?? []).map((f) => [f.id, f]));
  
  // Find Add & Update
  for (const node of schematic.nodes) {
    const fp = pcbFps.get(node.id);
    if (!fp) {
      diff.add.push({ id: node.id, reference: node.reference, symbol: node.symbol });
    } else {
      const changes: string[] = [];
      const expectedPads = makePadsForSymbol(node.symbol, node, fp.packageId);
      const padsChanged = JSON.stringify(fp.pads) !== JSON.stringify(expectedPads);

      if (fp.reference !== node.reference) {
        changes.push(`Reference: ${fp.reference} ➔ ${node.reference}`);
      }
      if (fp.value !== node.value) {
        changes.push(`Value: ${fp.value || "None"} ➔ ${node.value || "None"}`);
      }
      if (fp.symbol !== node.symbol) {
        changes.push(`Symbol: ${fp.symbol} ➔ ${node.symbol}`);
      }
      if (padsChanged) {
        changes.push(
          `Pads configuration updated`
        );
      }
      if (changes.length > 0) {
        diff.update.push({ id: node.id, reference: node.reference, changes });
      }
    }
  }
  
  // Find Remove
  for (const fp of pcb.footprints ?? []) {
    if (!schNodes.has(fp.id)) {
      diff.remove.push({ id: fp.id, reference: fp.reference });
    }
  }
  
  return diff;
}
