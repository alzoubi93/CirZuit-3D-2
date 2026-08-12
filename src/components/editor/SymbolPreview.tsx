import { SYMBOLS } from "@/lib/symbols";
import type { SymbolId } from "@/lib/schematic";
import { RealisticComponent, RealisticDefs } from "./RealisticComponents";

export function SymbolPreview({ id, size = 56, color = "currentColor", realistic = false }: { id: SymbolId; size?: number; color?: string; realistic?: boolean }) {
  const sym = SYMBOLS[id];
  if (!sym) return null;
  const pad = 0.5;
  const w = sym.width + pad * 2;
  const h = sym.height + pad * 2;
  return (
    <svg viewBox={`${-pad} ${-pad} ${w} ${h}`} width={size} height={size} preserveAspectRatio="xMidYMid meet">
      {realistic ? (
        <>
          <RealisticDefs />
          <g transform={`translate(0, 0)`}>
            <RealisticComponent
              node={{
                id: `preview-${id}`,
                symbol: id,
                x: 0,
                y: 0,
                rotation: 0,
                value: sym.defaultValue,
              }}
              width={sym.width}
              height={sym.height}
            />
          </g>
        </>
      ) : (
        sym.draw(color)
      )}
    </svg>
  );
}
