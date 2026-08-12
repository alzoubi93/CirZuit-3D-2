import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RotateCw, Trash2, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { SYMBOLS } from "@/lib/symbols";
import type { SchematicNode, SchematicWire, WireColor } from "@/lib/schematic";

const COLORS: { id: WireColor | "default"; hex: string; label: string }[] = [
  { id: "default", hex: "transparent", label: "Default" },
  { id: "black", hex: "#111111", label: "Black" },
  { id: "red", hex: "#dc2626", label: "Red" },
  { id: "green", hex: "#16a34a", label: "Green" },
  { id: "blue", hex: "#2563eb", label: "Blue" },
  { id: "yellow", hex: "#eab308", label: "Yellow" },
  { id: "white", hex: "#ffffff", label: "White" },
];

interface Props {
  node: SchematicNode | null;
  wire?: SchematicWire | null;
  onChange: (patch: Partial<SchematicNode>) => void;
  onChangeWire?: (patch: Partial<SchematicWire>) => void;
  onRotate: () => void;
  onDelete: () => void;
  onDeleteWire?: () => void;
  onClose?: () => void;
}

export function PropertiesPanel({ node, wire, onChange, onChangeWire, onRotate, onDelete, onDeleteWire, onClose }: Props) {
  const { t, lang } = useI18n();

  if (wire) {
    return (
      <div className="h-full flex flex-col bg-panel text-panel-foreground">
        <div className="px-4 py-2 border-b flex items-center justify-between bg-card/50">
          <div className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-blue-500" />
            {lang === "ar" ? "خصائص السلك" : "Wire Properties"}
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={onDeleteWire} title={t("delete_")}>
              <Trash2 className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20" onClick={onClose}>
              <X className="size-4 stroke-[2.5]" />
            </Button>
          </div>
        </div>
        <div className="p-4 space-y-4 overflow-auto">
          <div>
            <Label className="text-xs">{lang === "ar" ? "معلومات السلك" : "Wire Info"}</Label>
            <div className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded border border-border">
              {lang === "ar" 
                ? `عدد النقاط: ${wire.points.length}` 
                : `Segments: ${wire.points.length - 1} (${wire.points.length} points)`}
            </div>
          </div>

          <div>
            <Label className="text-xs">{lang === "ar" ? "لون السلك" : "Wire Color"}</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {COLORS.filter(c => c.id !== "default").map((c) => {
                const active = wire.color === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChangeWire?.({ color: c.id as WireColor })}
                    className={`size-7 rounded-full border-2 grid place-items-center transition-all ${active ? "border-primary scale-110 shadow" : "border-border"}`}
                    style={c.id === "white" 
                      ? { background: "#ffffff", border: "1px solid #ccc" } 
                      : { background: c.hex }}
                    title={c.label}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs">{lang === "ar" ? "سماكة السلك" : "Wire Thickness"}</Label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {[
                { label: lang === "ar" ? "عادي" : "Normal", value: 0.1 },
                { label: lang === "ar" ? "متوسط" : "Medium", value: 0.15 },
                { label: lang === "ar" ? "سميك" : "Thick", value: 0.2 },
                { label: lang === "ar" ? "عريض" : "Wide", value: 0.3 },
              ].map((opt) => {
                const currentWidth = wire.width ?? 0.1;
                const active = Math.abs(currentWidth - opt.value) < 0.01;
                return (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="h-8 text-xs px-2.5 flex-1 font-normal min-w-[60px]"
                    onClick={() => onChangeWire?.({ width: opt.value })}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-4 bg-panel text-panel-foreground">
        {t("nothingSelected")}
      </div>
    );
  }
  const sym = SYMBOLS[node.symbol];
  if (!sym) return null;
  const setPinName = (i: number, v: string) => {
    const next = { ...(node.pinNames ?? {}) };
    if (v.trim()) next[i] = v;
    else delete next[i];
    onChange({ pinNames: next });
  };
  return (
    <div className="h-full flex flex-col bg-panel text-panel-foreground border-r border-border shadow-2xl">
      <div className="px-4 py-2 border-b flex items-center justify-between bg-card/50">
        <div className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-primary" />
          {t(`symbols.${node.symbol}`)}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onRotate} title={t("rotate")}>
            <RotateCw className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={onDelete} title={t("delete_")}>
            <Trash2 className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20" onClick={onClose}>
            <X className="size-4 stroke-[2.5]" />
          </Button>
        </div>
      </div>
      <div className="p-4 space-y-3 overflow-auto">
        <div>
          <Label className="text-xs">{t("reference")}</Label>
          <Input value={node.reference ?? ""} onChange={(e) => onChange({ reference: e.target.value })} placeholder="R1, C2..." className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{t("value")}</Label>
          <Input value={node.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} placeholder="10k, 100nF..." className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{t("label")}</Label>
          <Input value={node.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{t("notes")}</Label>
          <Textarea value={node.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value })} rows={2} />
        </div>

        <div>
          <Label className="text-xs">{t("componentColor")}</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {COLORS.map((c) => {
              const active = (node.color ?? "default") === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange({ color: c.id === "default" ? undefined : (c.id as WireColor) })}
                  className={`size-7 rounded-full border-2 grid place-items-center transition-all ${active ? "border-primary scale-110 shadow" : "border-border"}`}
                  style={c.id === "default"
                    ? { background: "repeating-linear-gradient(45deg,#fff,#fff 3px,#ccc 3px,#ccc 6px)" }
                    : { background: c.hex }}
                  title={c.label}
                />
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs">{lang === "ar" ? "حجم العنصر" : "Component Size"}</Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {[
              { label: lang === "ar" ? "صغير" : "S (80%)", value: 0.8 },
              { label: lang === "ar" ? "طبيعي" : "M (100%)", value: 1.0 },
              { label: lang === "ar" ? "كبير" : "L (120%)", value: 1.2 },
              { label: lang === "ar" ? "كبير جداً" : "XL (150%)", value: 1.5 },
              { label: lang === "ar" ? "ضخم" : "XXL (200%)", value: 2.0 },
            ].map((opt) => {
              const currentScale = node.size ?? 1.0;
              const active = Math.abs(currentScale - opt.value) < 0.01;
              return (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="h-8 text-[11px] px-2 flex-1 min-w-[70px] font-normal"
                  onClick={() => onChange({ size: opt.value })}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>

        {sym.pins.length > 1 && (
          <div className="pt-2 border-t">
            <Label className="text-xs font-semibold">{t("pinNames")}</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {sym.pins.map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground w-6 shrink-0">{i + 1}</span>
                  <Input
                    value={node.pinNames?.[i] ?? p.name ?? ""}
                    onChange={(e) => setPinName(i, e.target.value)}
                    placeholder={p.name ?? `${t("pin")} ${i + 1}`}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
