// PCB module data schema — Phase 1
export type PcbUnit = "mm" | "inch";

export type PcbLayerId =
  | "top_copper"
  | "bottom_copper"
  | "silkscreen"
  | "bottom_silkscreen"
  | "solder_mask"
  | "bottom_solder_mask"
  | "drill"
  | "outline";

export interface PcbLayer {
  id: PcbLayerId;
  name: string;
  color: string;
  visible: boolean;
}

export const DEFAULT_LAYERS: PcbLayer[] = [
  { id: "outline",           name: "Board Outline",      color: "#eab308",   visible: true },
  { id: "top_copper",        name: "Top Copper",         color: "#ef4444",   visible: true },
  { id: "bottom_copper",     name: "Bottom Copper",      color: "#3b82f6",   visible: true },
  { id: "silkscreen",        name: "Top Silkscreen",     color: "#fde047",   visible: true },
  { id: "bottom_silkscreen", name: "Bottom Silkscreen",  color: "#fde047",   visible: true },
  { id: "solder_mask",       name: "Top Solder Mask",    color: "#10b98180", visible: true },
  { id: "bottom_solder_mask",name: "Bottom Solder Mask", color: "#04785780", visible: true },
  { id: "drill",             name: "Drill",              color: "#000000",   visible: true },
];

export interface PcbTrack {
  id: string;
  layer: PcbLayerId;
  width: number;            // mm
  points: { x: number; y: number }[]; // mm
}

export interface PcbVia {
  id: string;
  x: number; y: number;     // mm
  drill: number;            // mm
  diameter: number;         // mm (annular outer)
  shape?: "circle" | "square";
}

export interface PcbPad {
  id: string;
  x: number; y: number;     // mm
  width: number;            // mm
  height: number;           // mm
  shape: "rect" | "circle";
  layer: "top_copper" | "bottom_copper";
  drill?: number;           // mm (through-hole if set)
  number?: string;
}

export interface PcbMeasure {
  id: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
}

/** A pad that belongs to a synchronized footprint (linked to a schematic pin). */
export interface PcbFootprintPad {
  pinIndex: number;
  number?: string;
  name?: string;
  /** position relative to footprint origin, mm (before footprint rotation) */
  x: number; y: number;
  width: number; height: number;
  shape: "rect" | "circle";
  layer: "top_copper" | "bottom_copper" | "multi_layer";
  drill?: number;
}

/** A footprint mirrors a schematic component on the PCB. id === schematic node id. */
export interface PcbFootprint {
  id: string;
  reference?: string;
  value?: string;
  symbol: string;
  packageId?: string;
  x: number; y: number;          // mm, footprint origin
  rotation: number;
  pads: PcbFootprintPad[];
  custom3DModel?: string; // base64 or object URL
  custom3DModelType?: "glb" | "stp";
}

export interface PcbText {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number; // in mm
  layer: PcbLayerId;
  rotation: 0 | 90 | 180 | 270;
}

export interface PcbDoc {
  version: 1;
  unit: PcbUnit;
  width: number;
  height: number;
  gridMm: number;
  layers: PcbLayer[];
  tracks: PcbTrack[];
  vias: PcbVia[];
  pads: PcbPad[];
  measures: PcbMeasure[];
  texts?: PcbText[];
  /** Synced from schematic. Do not edit manually. */
  footprints: PcbFootprint[];
  /** Show the ratsnest overlay (airwires). */
  ratsnestVisible: boolean;
  isImportedGerber?: boolean;
}

export function emptyPcbDoc(): PcbDoc {
  return {
    version: 1,
    unit: "mm",
    width: 80,
    height: 60,
    gridMm: 4,
    layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
    tracks: [],
    vias: [],
    pads: [],
    measures: [],
    texts: [],
    footprints: [],
    ratsnestVisible: true,
  };
}

export const MM_PER_INCH = 25.4;
export const toDisplay = (mm: number, unit: PcbUnit) => unit === "mm" ? mm : mm / MM_PER_INCH;
export const fromDisplay = (v: number, unit: PcbUnit) => unit === "mm" ? v : v * MM_PER_INCH;
export const fmt = (mm: number, unit: PcbUnit, d = 2) => `${toDisplay(mm, unit).toFixed(d)} ${unit}`;
