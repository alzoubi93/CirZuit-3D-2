import { PcbDoc, PcbTrack, PcbVia, PcbPad, PcbFootprint, PcbFootprintPad, PcbText, PcbLayerId, DEFAULT_LAYERS } from "./pcb";
import { SchematicDoc } from "./schematic";

// ==========================================
// S-Expression Tokenizer and Parser
// ==========================================

interface SExprToken {
  type: "paren" | "string" | "atom";
  value: string;
}

function tokenizeSExpr(text: string): SExprToken[] {
  const tokens: SExprToken[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
    } else if (ch === '"') {
      let str = "";
      i++;
      while (i < text.length) {
        if (text[i] === "\\" && i + 1 < text.length) {
          str += text[i + 1];
          i += 2;
        } else if (text[i] === '"') {
          i++;
          break;
        } else {
          str += text[i];
          i++;
        }
      }
      tokens.push({ type: "string", value: str });
    } else if (/\s/.test(ch)) {
      i++;
    } else if (ch === "#") {
      // Line comment in some files
      while (i < text.length && text[i] !== "\n") i++;
    } else {
      let atom = "";
      while (i < text.length && !/\s|\(|\)|"/.test(text[i])) {
        atom += text[i];
        i++;
      }
      if (atom) {
        tokens.push({ type: "atom", value: atom });
      }
    }
  }
  return tokens;
}

type SExprAST = Array<string | SExprAST>;

function parseSExprAST(tokens: SExprToken[]): SExprAST {
  let index = 0;
  while (index < tokens.length && (tokens[index].type !== "paren" || tokens[index].value !== "(")) index++;
  function parseNode(): SExprAST {
    const list: SExprAST = [];
    if (index >= tokens.length || (tokens[index].type !== "paren" || tokens[index].value !== "(")) return list;
    index++; // skip '('
    while (index < tokens.length) {
      const tok = tokens[index];
      if (tok.type === "paren" && tok.value === ")") {
        index++; // skip ')'
        break;
      }
      if (tok.type === "paren" && tok.value === "(") {
        list.push(parseNode());
      } else {
        list.push(tok.value);
        index++;
      }
    }
    return list;
  }

  const root: SExprAST = [];
  while (index < tokens.length) {
    if (tokens[index].value === "(") {
      root.push(parseNode());
    } else {
      index++;
    }
  }
  return root;
}

// Layer mapping from KiCad PCB layer names to PcbLayerId
export function mapKiCadPcbLayer(layerName: string): PcbLayerId {
  const l = layerName.toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (l.includes("f.cu") || l === "top" || l === "f_cu") return "top_copper";
  if (l.includes("b.cu") || l === "bottom" || l === "bot" || l === "b_cu") return "bottom_copper";
  if (l.includes("f.silks") || l.includes("f.silk") || l.includes("silkscreen.top")) return "silkscreen";
  if (l.includes("b.silks") || l.includes("b.silk") || l.includes("silkscreen.bot")) return "bottom_silkscreen";
  if (l.includes("f.mask") || l.includes("soldermask.top")) return "solder_mask";
  if (l.includes("b.mask") || l.includes("soldermask.bot")) return "bottom_solder_mask";
  if (l.includes("edge.cuts") || l.includes("edgecuts") || l.includes("outline") || l.includes("margin")) return "outline";
  if (l.includes("drill") || l.includes("hole")) return "drill";
  if (l.includes("in1.cu") || l.includes("in2.cu") || l.includes("cu")) return "top_copper";
  return "top_copper";
}

export function isKiCadPcbContent(text: string): boolean {
  if (!text) return false;
  return text.includes("(kicad_pcb") || text.includes("kicad_pcb");
}

/**
 * Main parser for KiCad PCB (.kicad_pcb)
 */
export function parseKiCadPcb(
  fileContent: string,
  filename: string = "kicad_pcb_board",
  lang: "ar" | "en" = "en"
): { doc: SchematicDoc; name: string } {
  const tracks: PcbTrack[] = [];
  const vias: PcbVia[] = [];
  const pads: PcbPad[] = [];
  const footprints: PcbFootprint[] = [];
  const texts: PcbText[] = [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function registerPoint(x: number, y: number) {
    if (isNaN(x) || isNaN(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  try {
    const tokens = tokenizeSExpr(fileContent);
    const ast = parseSExprAST(tokens);

    // Find main (kicad_pcb ...) root node
    let mainNode: SExprAST | null = null;
    for (const item of ast) {
      if (Array.isArray(item) && item[0] === "kicad_pcb") {
        mainNode = item;
        break;
      }
    }

    const rootList = mainNode || ast;

    for (const node of rootList) {
      if (!Array.isArray(node)) continue;
      const head = node[0];

      // 1. Tracks / Segments: (segment (start X Y) (end X Y) (width W) (layer L) ...)
      if (head === "segment") {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0, width = 0.25;
        let layer: PcbLayerId = "top_copper";

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "start") {
            x1 = parseFloat(sub[1] as string) || 0;
            y1 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "end") {
            x2 = parseFloat(sub[1] as string) || 0;
            y2 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "width") {
            width = parseFloat(sub[1] as string) || 0.25;
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          }
        }

        registerPoint(x1, y1);
        registerPoint(x2, y2);

        tracks.push({
          id: `track-kicad-${Math.random().toString(36).substring(2, 9)}`,
          layer,
          width,
          points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        });
      }

      // 2. Arcs: (arc (start X Y) (mid X Y) (end X Y) (width W) (layer L) ...)
      else if (head === "arc") {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0, width = 0.25;
        let layer: PcbLayerId = "top_copper";

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "start") {
            x1 = parseFloat(sub[1] as string) || 0;
            y1 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "end") {
            x2 = parseFloat(sub[1] as string) || 0;
            y2 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "width") {
            width = parseFloat(sub[1] as string) || 0.25;
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          }
        }

        registerPoint(x1, y1);
        registerPoint(x2, y2);

        tracks.push({
          id: `track-arc-kicad-${Math.random().toString(36).substring(2, 9)}`,
          layer,
          width,
          points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        });
      }

      // 3. Vias: (via (at X Y) (size S) (drill D) ...)
      else if (head === "via") {
        let vx = 0, vy = 0, size = 0.8, drill = 0.4;
        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "at") {
            vx = parseFloat(sub[1] as string) || 0;
            vy = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "size") {
            size = parseFloat(sub[1] as string) || 0.8;
          } else if (sub[0] === "drill") {
            drill = parseFloat(sub[1] as string) || size * 0.5;
          }
        }

        registerPoint(vx, vy);

        vias.push({
          id: `via-kicad-${Math.random().toString(36).substring(2, 9)}`,
          x: vx,
          y: vy,
          diameter: size,
          drill,
          shape: "circle",
        });
      }

      // 4. Graphical Lines / Outline: (gr_line (start X Y) (end X Y) (layer L) (width W))
      else if (head === "gr_line" || head === "gr_arc" || head === "gr_rect" || head === "gr_circle") {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0, width = 0.15;
        let layer: PcbLayerId = "outline";

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "start" || sub[0] === "center") {
            x1 = parseFloat(sub[1] as string) || 0;
            y1 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "end") {
            x2 = parseFloat(sub[1] as string) || 0;
            y2 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "width") {
            width = parseFloat(sub[1] as string) || 0.15;
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          }
        }

        registerPoint(x1, y1);
        registerPoint(x2, y2);

        tracks.push({
          id: `gr-${head}-${Math.random().toString(36).substring(2, 9)}`,
          layer,
          width,
          points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        });
      }

      // 5. Graphic Text: (gr_text "TEXT" (at X Y [ROT]) (layer L) ...)
      else if (head === "gr_text") {
        const textVal = (typeof node[1] === "string" ? node[1] : "TEXT");
        let tx = 0, ty = 0, rot: 0 | 90 | 180 | 270 = 0;
        let layer: PcbLayerId = "silkscreen";
        let size = 1.2;

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "at") {
            tx = parseFloat(sub[1] as string) || 0;
            ty = parseFloat(sub[2] as string) || 0;
            const rVal = parseFloat(sub[3] as string) || 0;
            if (rVal === 90 || rVal === 180 || rVal === 270) rot = rVal;
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (sub[0] === "effects") {
            for (const effSub of sub) {
              if (Array.isArray(effSub) && effSub[0] === "font") {
                for (const fontSub of effSub) {
                  if (Array.isArray(fontSub) && fontSub[0] === "size") {
                    size = parseFloat(fontSub[1] as string) || 1.2;
                  }
                }
              }
            }
          }
        }

        registerPoint(tx, ty);

        texts.push({
          id: `text-kicad-${Math.random().toString(36).substring(2, 9)}`,
          text: textVal,
          x: tx,
          y: ty,
          size,
          layer,
          rotation: rot,
        });
      }

      // 6. Footprints / Modules: (footprint "NAME" ...) or (module "NAME" ...)
      else if (head === "footprint" || head === "module") {
        let fx = 0, fy = 0, frot = 0;
        let fpRef = "";
        let fpVal = "";
        let fpSymbol = "ic";
        const fpPads: PcbFootprintPad[] = [];

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          const subHead = sub[0];

          if (subHead === "at") {
            fx = parseFloat(sub[1] as string) || 0;
            fy = parseFloat(sub[2] as string) || 0;
            frot = parseFloat(sub[3] as string) || 0;
          } else if (subHead === "property" && sub[1] === "Reference") {
            fpRef = (sub[2] as string) || "";
          } else if (subHead === "property" && sub[1] === "Value") {
            fpVal = (sub[2] as string) || "";
          } else if (subHead === "fp_text") {
            if (sub[1] === "reference") fpRef = (sub[2] as string) || "";
            if (sub[1] === "value") fpVal = (sub[2] as string) || "";
          }

          // Pads inside footprint
          else if (subHead === "pad") {
            const padNum = (sub[1] as string) || "1";
            const padType = (sub[2] as string) || "smd";
            const padShapeStr = (sub[3] as string) || "rect";

            let px = 0, py = 0;
            let pw = 1.0, ph = 1.0;
            let drill: number | undefined = undefined;
            let padLayers: ("top_copper" | "bottom_copper" | "multi_layer") = padType === "smd" ? "top_copper" : "multi_layer";

            for (const padSub of sub) {
              if (!Array.isArray(padSub)) continue;
              if (padSub[0] === "at") {
                px = parseFloat(padSub[1] as string) || 0;
                py = parseFloat(padSub[2] as string) || 0;
              } else if (padSub[0] === "size") {
                pw = parseFloat(padSub[1] as string) || 1.0;
                ph = parseFloat(padSub[2] as string) || 1.0;
              } else if (padSub[0] === "drill") {
                drill = parseFloat(padSub[1] as string) || 0.8;
              } else if (padSub[0] === "layers") {
                const layerList = padSub.slice(1).map((l) => String(l).toLowerCase());
                const hasFront = layerList.some((l) => l.includes("f.cu") || l.includes("top"));
                const hasBack = layerList.some((l) => l.includes("b.cu") || l.includes("bottom"));
                if (hasFront && hasBack) padLayers = "multi_layer";
                else if (hasBack) padLayers = "bottom_copper";
                else padLayers = "top_copper";
              }
            }

            // Calculate absolute position of pad
            const rad = (frot * Math.PI) / 180;
            const absPx = fx + (px * Math.cos(rad) - py * Math.sin(rad));
            const absPy = fy + (px * Math.sin(rad) + py * Math.cos(rad));

            registerPoint(absPx, absPy);

            const shape: "rect" | "circle" = (padShapeStr === "circle" || padShapeStr === "oval") ? "circle" : "rect";

            fpPads.push({
              pinIndex: parseInt(padNum, 10) || 1,
              number: padNum,
              name: padNum,
              x: px,
              y: py,
              width: pw,
              height: ph,
              shape,
              layer: padLayers,
              drill,
            });

            pads.push({
              id: `pad-kicad-${Math.random().toString(36).substring(2, 9)}`,
              x: absPx,
              y: absPy,
              width: pw,
              height: ph,
              shape,
              layer: padLayers === "bottom_copper" ? "bottom_copper" : "top_copper",
              drill,
              number: padNum,
            });
          }

          // Silkscreen / graphics inside footprint
          else if (subHead === "fp_line") {
            let x1 = 0, y1 = 0, x2 = 0, y2 = 0, width = 0.15;
            let layer: PcbLayerId = "silkscreen";
            for (const fpSub of sub) {
              if (!Array.isArray(fpSub)) continue;
              if (fpSub[0] === "start") {
                x1 = parseFloat(fpSub[1] as string) || 0;
                y1 = parseFloat(fpSub[2] as string) || 0;
              } else if (fpSub[0] === "end") {
                x2 = parseFloat(fpSub[1] as string) || 0;
                y2 = parseFloat(fpSub[2] as string) || 0;
              } else if (fpSub[0] === "width") {
                width = parseFloat(fpSub[1] as string) || 0.15;
              } else if (fpSub[0] === "layer") {
                layer = mapKiCadPcbLayer(fpSub[1] as string);
              }
            }

            const rad = (frot * Math.PI) / 180;
            const absX1 = fx + (x1 * Math.cos(rad) - y1 * Math.sin(rad));
            const absY1 = fy + (x1 * Math.sin(rad) + y1 * Math.cos(rad));
            const absX2 = fx + (x2 * Math.cos(rad) - y2 * Math.sin(rad));
            const absY2 = fy + (x2 * Math.sin(rad) + y2 * Math.cos(rad));

            registerPoint(absX1, absY1);
            registerPoint(absX2, absY2);

            tracks.push({
              id: `fp-line-${Math.random().toString(36).substring(2, 9)}`,
              layer,
              width,
              points: [{ x: absX1, y: absY1 }, { x: absX2, y: absY2 }],
            });
          }
        }

        registerPoint(fx, fy);

        if (fpRef) {
          if (/^r[0-9]/i.test(fpRef)) fpSymbol = "resistor";
          else if (/^c[0-9]/i.test(fpRef)) fpSymbol = "capacitor";
          else if (/^l[0-9]/i.test(fpRef)) fpSymbol = "inductor";
          else if (/^d[0-9]/i.test(fpRef)) fpSymbol = "diode2";
          else if (/^q[0-9]/i.test(fpRef)) fpSymbol = "transistor";
          else if (/^u[0-9]/i.test(fpRef)) fpSymbol = "opamp4";
        }

        footprints.push({
          id: `fp-${Math.random().toString(36).substring(2, 9)}`,
          reference: fpRef || undefined,
          value: fpVal || undefined,
          symbol: fpSymbol,
          x: fx,
          y: fy,
          rotation: frot,
          pads: fpPads,
        });
      }
    }
  } catch (err) {
    console.warn("KiCad PCB AST parse warning, falling back to regex scanner", err);
  }

  // Regex fallback scanner if AST missed segments or points
  if (tracks.length === 0 && pads.length === 0 && vias.length === 0) {
    // Regex for segments
    const segMatches = fileContent.matchAll(/\(segment\s+\(start\s+([\d.-]+)\s+([\d.-]+)\)\s+\(end\s+([\d.-]+)\s+([\d.-]+)\)\s+\(width\s+([\d.-]+)\)\s+\(layer\s+"?([^"\s)]+)"?\)/gi);
    for (const m of segMatches) {
      const x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
      const x2 = parseFloat(m[3]), y2 = parseFloat(m[4]);
      const width = parseFloat(m[5]) || 0.25;
      const layer = mapKiCadPcbLayer(m[6] || "F.Cu");

      registerPoint(x1, y1);
      registerPoint(x2, y2);

      tracks.push({
        id: `track-fb-${Math.random().toString(36).substring(2, 9)}`,
        layer,
        width,
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
      });
    }

    // Regex for vias
    const viaMatches = fileContent.matchAll(/\(via\s+\(at\s+([\d.-]+)\s+([\d.-]+)\)\s+\(size\s+([\d.-]+)\)(?:\s+\(drill\s+([\d.-]+)\))?/gi);
    for (const m of viaMatches) {
      const vx = parseFloat(m[1]), vy = parseFloat(m[2]);
      const size = parseFloat(m[3]) || 0.8;
      const drill = parseFloat(m[4]) || size * 0.5;

      registerPoint(vx, vy);

      vias.push({
        id: `via-fb-${Math.random().toString(36).substring(2, 9)}`,
        x: vx,
        y: vy,
        diameter: size,
        drill,
        shape: "circle",
      });
    }
  }

  // Calculate board dimensions and offset
  if (minX === Infinity || minY === Infinity) {
    minX = 0; minY = 0; maxX = 100; maxY = 80;
  }

  const offsetX = -minX + 5; // 5mm margin
  const offsetY = -minY + 5;

  const boardWidth = Number(Math.max(20, (maxX - minX) + 10).toFixed(2));
  const boardHeight = Number(Math.max(20, (maxY - minY) + 10).toFixed(2));

  // Offset all elements so min coordinate is at margin
  tracks.forEach((t) => {
    t.points = t.points.map((p) => ({
      x: Number((p.x + offsetX).toFixed(3)),
      y: Number((p.y + offsetY).toFixed(3)),
    }));
  });

  pads.forEach((p) => {
    p.x = Number((p.x + offsetX).toFixed(3));
    p.y = Number((p.y + offsetY).toFixed(3));
  });

  vias.forEach((v) => {
    v.x = Number((v.x + offsetX).toFixed(3));
    v.y = Number((v.y + offsetY).toFixed(3));
  });

  footprints.forEach((f) => {
    f.x = Number((f.x + offsetX).toFixed(3));
    f.y = Number((f.y + offsetY).toFixed(3));
  });

  texts.forEach((t) => {
    t.x = Number((t.x + offsetX).toFixed(3));
    t.y = Number((t.y + offsetY).toFixed(3));
  });

  const pcbDoc: PcbDoc = {
    version: 1,
    unit: "mm",
    width: boardWidth,
    height: boardHeight,
    gridSize: 1,
    layers: DEFAULT_LAYERS,
    tracks,
    vias,
    pads,
    footprints,
    texts,
    measures: [],
    isImportedGerber: true,
  };

  const cleanProjName = filename.replace(/\.(kicad_pcb|kicad_sch|zip|json|xml)$/i, "");

  return {
    name: cleanProjName,
    doc: {
      nodes: [],
      wires: [],
      canvasColor: "white",
      defaultWireColor: "black",
      pcb: pcbDoc,
    },
  };
}
