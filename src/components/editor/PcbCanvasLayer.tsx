import React, { useEffect, useRef } from "react";
import { PcbDoc, PcbTrack, PcbVia, PcbPad, PcbLayerId, PcbLayer } from "@/lib/pcb";

interface PcbCanvasLayerProps {
  pcb: PcbDoc;
  pan: { x: number; y: number };
  zoom: number;
  boardRotation: number;
  selectedTrackId: string | null;
  selectedId: string | null;
  selection: any;
  groupSelected: { footprints: string[]; tracks: string[]; vias: string[]; pads: string[] } | null;
  highlightedNetIds: number[];
  trackNetMap: Map<string, number>;
  activeLayer: PcbLayerId;
  dimInactiveLayers: boolean;
  containerWidth: number;
  containerHeight: number;
}

export const PcbCanvasLayer: React.FC<PcbCanvasLayerProps> = ({
  pcb,
  pan,
  zoom,
  boardRotation,
  selectedTrackId,
  selectedId,
  selection,
  groupSelected,
  highlightedNetIds,
  trackNetMap,
  activeLayer,
  dimInactiveLayers,
  containerWidth,
  containerHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = containerWidth || canvas.clientWidth || 800;
    const h = containerHeight || canvas.clientHeight || 600;

    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up viewport transformation (high DPI + pan + zoom + board rotation)
    ctx.scale(dpr, dpr);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    if (boardRotation) {
      ctx.rotate((boardRotation * Math.PI) / 180);
    }

    const layerMap = new Map<string, PcbLayer>();
    (pcb.layers || []).forEach((l) => layerMap.set(l.id, l));

    const isLayerVisible = (layerId: string) => {
      const layer = layerMap.get(layerId);
      return layer ? layer.visible : true;
    };

    const getLayerColor = (layerId: string, fallback: string) => {
      const layer = layerMap.get(layerId);
      return layer?.color || fallback;
    };

    const getLayerAlpha = (layerId: string) => {
      if (!dimInactiveLayers) return 1.0;
      if (layerId === activeLayer || layerId === "multi_layer" || layerId === "drill") return 1.0;
      return 0.25;
    };

    // 1. RENDER TRACKS (WebGL/Canvas accelerated)
    const tracks = pcb.tracks || [];
    for (let i = 0; i < tracks.length; i++) {
      const tr = tracks[i];
      if (!tr.points || tr.points.length < 2) continue;
      if (!isLayerVisible(tr.layer)) continue;

      const isSel = selectedTrackId === tr.id;
      const trackNetId = trackNetMap.get(tr.id);
      const isHi = trackNetId !== undefined && highlightedNetIds.includes(trackNetId);
      const isGroupSel = groupSelected?.tracks.includes(tr.id) || false;

      const alpha = getLayerAlpha(tr.layer);
      ctx.globalAlpha = alpha;

      let strokeColor = getLayerColor(tr.layer, "#3b82f6");
      const strokeWidth = tr.width || 0.4;

      if (isGroupSel) {
        strokeColor = "#f59e0b";
      } else if (isSel) {
        strokeColor = "#3b82f6";
      }

      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;

      ctx.moveTo(tr.points[0].x, tr.points[0].y);
      for (let j = 1; j < tr.points.length; j++) {
        ctx.lineTo(tr.points[j].x, tr.points[j].y);
      }
      ctx.stroke();

      // Highlight / Selection overlays
      if (isHi || isSel || isGroupSel) {
        ctx.beginPath();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = strokeWidth + (isHi ? 1.5 : 0.8);
        ctx.strokeStyle = isGroupSel ? "#f59e0b" : isHi ? "rgba(59, 130, 246, 0.7)" : "rgba(96, 165, 250, 0.8)";
        ctx.moveTo(tr.points[0].x, tr.points[0].y);
        for (let j = 1; j < tr.points.length; j++) {
          ctx.lineTo(tr.points[j].x, tr.points[j].y);
        }
        ctx.stroke();
      }
    }

    // 2. RENDER STANDALONE & FOOTPRINT PADS (WebGL/Canvas accelerated)
    const allPads: { pad: PcbPad; footprintId?: string }[] = [];
    (pcb.pads || []).forEach((p) => allPads.push({ pad: p }));
    (pcb.footprints || []).forEach((fp) => {
      (fp.pads || []).forEach((p) => {
        // Calculate absolute position for footprint pads
        const rad = ((fp.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const absX = fp.x + (p.x * cos - p.y * sin);
        const absY = fp.y + (p.x * sin + p.y * cos);
        allPads.push({
          pad: { ...p, x: absX, y: absY },
          footprintId: fp.id,
        });
      });
    });

    for (let i = 0; i < allPads.length; i++) {
      const { pad, footprintId } = allPads[i];
      if (!isLayerVisible(pad.layer)) continue;

      const isPadSel = (selection?.kind === "pad" && selection.id === pad.id) || (footprintId && selectedId === footprintId);
      const isGroupSel = groupSelected?.pads.includes(pad.id) || (footprintId && groupSelected?.footprints.includes(footprintId));

      ctx.globalAlpha = getLayerAlpha(pad.layer);
      let padColor = getLayerColor(pad.layer, pad.layer === "bottom_copper" ? "#3b82f6" : "#22c55e");

      if (isGroupSel) padColor = "#f59e0b";
      else if (isPadSel) padColor = "#60a5fa";

      ctx.fillStyle = padColor;

      if (pad.shape === "rect") {
        ctx.fillRect(pad.x - pad.width / 2, pad.y - pad.height / 2, pad.width, pad.height);
        if (isPadSel || isGroupSel) {
          ctx.strokeStyle = isGroupSel ? "#f59e0b" : "#3b82f6";
          ctx.lineWidth = 0.2;
          ctx.strokeRect(pad.x - pad.width / 2, pad.y - pad.height / 2, pad.width, pad.height);
        }
      } else {
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, pad.width / 2, 0, Math.PI * 2);
        ctx.fill();
        if (isPadSel || isGroupSel) {
          ctx.strokeStyle = isGroupSel ? "#f59e0b" : "#3b82f6";
          ctx.lineWidth = 0.2;
          ctx.stroke();
        }
      }

      // Drill hole
      if (pad.drill) {
        ctx.fillStyle = "#121214";
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, pad.drill / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. RENDER VIAS (WebGL/Canvas accelerated)
    if (isLayerVisible("drill") || isLayerVisible("top_copper") || isLayerVisible("bottom_copper")) {
      const vias = pcb.vias || [];
      for (let i = 0; i < vias.length; i++) {
        const v = vias[i];
        const isViaSel = selection?.kind === "via" && selection.id === v.id;
        const isGroupSel = groupSelected?.vias.includes(v.id) || false;

        ctx.globalAlpha = getLayerAlpha("drill");

        let viaColor = "#e2e8f0"; // copper ring
        if (isGroupSel) viaColor = "#f59e0b";
        else if (isViaSel) viaColor = "#60a5fa";

        // Outer copper ring
        ctx.fillStyle = viaColor;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.diameter / 2, 0, Math.PI * 2);
        ctx.fill();

        // Inner drill hole
        ctx.fillStyle = "#121214";
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.drill / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }, [
    pcb,
    pan,
    zoom,
    boardRotation,
    selectedTrackId,
    selectedId,
    selection,
    groupSelected,
    highlightedNetIds,
    trackNetMap,
    activeLayer,
    dimInactiveLayers,
    containerWidth,
    containerHeight,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
    />
  );
};
