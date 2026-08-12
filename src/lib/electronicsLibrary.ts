
export type PackageType = "SMD" | "DIP";

export interface ComponentPackage {
  id: string;
  name: string;
  type: PackageType;
  padW: number;
  padH: number;
  scaleX: number;
  scaleY: number;
  drill?: number;
}

export const PACKAGES: Record<string, ComponentPackage[]> = {
  resistor: [
    { id: "res_dip_762", name: "DIP 7.62mm (0.3\")", type: "DIP", padW: 1.8, padH: 1.8, scaleX: 0.75, scaleY: 1.0, drill: 0.8 },
    { id: "res_dip_1016", name: "DIP 10.16mm (0.4\")", type: "DIP", padW: 1.8, padH: 1.8, scaleX: 1.0, scaleY: 1.0, drill: 0.8 },
    { id: "0805", name: "SMD 0805", type: "SMD", padW: 1.2, padH: 1.4, scaleX: 0.2, scaleY: 1.0 },
    { id: "0603", name: "SMD 0603", type: "SMD", padW: 0.9, padH: 1.1, scaleX: 0.15, scaleY: 1.0 },
    { id: "0402", name: "SMD 0402", type: "SMD", padW: 0.6, padH: 0.7, scaleX: 0.1, scaleY: 1.0 },
    { id: "1206", name: "SMD 1206", type: "SMD", padW: 1.6, padH: 1.8, scaleX: 0.3, scaleY: 1.0 },
  ],
  capacitor: [
    { id: "cap_dip_508", name: "DIP 5.08mm (0.2\")", type: "DIP", padW: 1.8, padH: 1.8, scaleX: 0.66, scaleY: 1.0, drill: 0.8 },
    { id: "cap_dip_254", name: "DIP 2.54mm (0.1\")", type: "DIP", padW: 1.5, padH: 1.5, scaleX: 0.33, scaleY: 1.0, drill: 0.7 },
    { id: "0805", name: "SMD 0805", type: "SMD", padW: 1.2, padH: 1.3, scaleX: 0.2, scaleY: 1.0 },
    { id: "0603", name: "SMD 0603", type: "SMD", padW: 0.9, padH: 1.0, scaleX: 0.15, scaleY: 1.0 },
    { id: "1206", name: "SMD 1206", type: "SMD", padW: 1.6, padH: 1.7, scaleX: 0.3, scaleY: 1.0 },
  ],
  ic: [
    { id: "dip_300", name: "DIP 300mil", type: "DIP", padW: 1.8, padH: 1.8, scaleX: 1.0, scaleY: 1.0, drill: 0.8 },
    { id: "soic", name: "SOIC (SMD)", type: "SMD", padW: 1.8, padH: 0.6, scaleX: 0.8, scaleY: 0.5 },
    { id: "tssop", name: "TSSOP (SMD)", type: "SMD", padW: 1.2, padH: 0.4, scaleX: 0.6, scaleY: 0.25 },
  ],
  diode: [
    { id: "diode_dip", name: "DIP DO-41", type: "DIP", padW: 2.0, padH: 2.0, scaleX: 1.0, scaleY: 1.0, drill: 1.0 },
    { id: "sod123", name: "SMD SOD-123", type: "SMD", padW: 1.2, padH: 1.0, scaleX: 0.3, scaleY: 1.0 },
    { id: "sma", name: "SMD SMA", type: "SMD", padW: 2.2, padH: 2.2, scaleX: 0.4, scaleY: 1.0 },
  ],
  transistor: [
    { id: "to92", name: "DIP TO-92 (Standard)", type: "DIP", padW: 1.5, padH: 1.5, scaleX: 0.7, scaleY: 0.7, drill: 0.8 },
    { id: "to220", name: "DIP TO-220 (Power)", type: "DIP", padW: 2.0, padH: 2.0, scaleX: 1.2, scaleY: 1.2, drill: 1.0 },
    { id: "sot23", name: "SMD SOT-23", type: "SMD", padW: 0.8, padH: 1.0, scaleX: 0.5, scaleY: 0.5 },
    { id: "sot223", name: "SMD SOT-223", type: "SMD", padW: 1.2, padH: 1.6, scaleX: 0.7, scaleY: 0.7 },
    { id: "dpak", name: "SMD TO-252 (DPAK)", type: "SMD", padW: 1.4, padH: 2.2, scaleX: 1.0, scaleY: 0.9 },
  ],
  regulator: [
    { id: "to220", name: "DIP TO-220 (Power)", type: "DIP", padW: 2.0, padH: 2.0, scaleX: 1.2, scaleY: 1.2, drill: 1.0 },
    { id: "to92", name: "DIP TO-92 (Low-Power)", type: "DIP", padW: 1.5, padH: 1.5, scaleX: 0.7, scaleY: 0.7, drill: 0.8 },
    { id: "sot223", name: "SMD SOT-223", type: "SMD", padW: 1.2, padH: 1.6, scaleX: 0.7, scaleY: 0.7 },
    { id: "sot23", name: "SMD SOT-23", type: "SMD", padW: 0.8, padH: 1.0, scaleX: 0.5, scaleY: 0.5 },
    { id: "dpak", name: "SMD TO-252 (DPAK)", type: "SMD", padW: 1.4, padH: 2.2, scaleX: 1.0, scaleY: 0.9 },
  ]
};

export function getPackagesForSymbol(symbolId: string | undefined | null): ComponentPackage[] {
  if (!symbolId || typeof symbolId !== "string") {
    return [
      { id: "gen_dip", name: "General DIP", type: "DIP", padW: 1.6, padH: 1.6, scaleX: 1.0, scaleY: 1.0, drill: 0.8 },
      { id: "gen_smd", name: "General SMD", type: "SMD", padW: 1.2, padH: 1.2, scaleX: 0.6, scaleY: 0.6 }
    ];
  }
  const s = symbolId.toLowerCase();
  if (s.includes("resistor")) return PACKAGES.resistor;
  if (s.includes("capacitor")) return PACKAGES.capacitor;
  if (s.includes("ic") || s.includes("opamp") || s.includes("mcu")) return PACKAGES.ic;
  if (s.includes("diode") || s.includes("led")) return PACKAGES.diode;
  if (s.includes("regulator") || s.includes("7805") || s.includes("7812") || s.includes("lm317") || s.includes("ams1117") || s.includes("vreg")) return PACKAGES.regulator;
  if (s.includes("npn") || s.includes("pnp") || s.includes("mosfet") || s.includes("transistor") || s.includes("bjt") || s.includes("2n2222") || s.includes("bc547") || s.includes("irf540")) return PACKAGES.transistor;
  
  // Default fallback
  return [
    { id: "gen_dip", name: "General DIP", type: "DIP", padW: 1.6, padH: 1.6, scaleX: 1.0, scaleY: 1.0, drill: 0.8 },
    { id: "gen_smd", name: "General SMD", type: "SMD", padW: 1.2, padH: 1.2, scaleX: 0.6, scaleY: 0.6 }
  ];
}
