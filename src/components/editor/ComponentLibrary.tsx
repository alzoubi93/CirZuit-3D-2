import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, Check, Search } from "lucide-react";
import { SYMBOL_LIST, CATEGORY_ORDER, type SymbolCategory } from "@/lib/symbols";
import { SymbolPreview } from "./SymbolPreview";
import { useI18n } from "@/i18n";
import type { SymbolId } from "@/lib/schematic";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  favorites: SymbolId[];
  onToggleFavorite: (id: SymbolId) => void;
  onPick: (id: SymbolId) => void;
  realistic?: boolean;
}

export function ComponentLibrary({ open, onOpenChange, favorites, onToggleFavorite, onPick, realistic = false }: Props) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<SymbolCategory | "all">("all");

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return SYMBOL_LIST.filter((s) => {
      if (activeCat !== "all" && s.category !== activeCat) return false;
      if (!ql) return true;
      const name = t(`symbols.${s.id}`).toLowerCase();
      return name.includes(ql) || s.id.includes(ql) || (s.defaultValue ?? "").toLowerCase().includes(ql);
    });
  }, [q, activeCat, t]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof SYMBOL_LIST> = {};
    for (const s of filtered) (g[s.category] ??= []).push(s);
    return g;
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-base">{t("library")}</DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 border-b space-y-2 shrink-0">
          <div className="relative">
            <Search className="absolute start-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("librarySearch")}
              className="h-9 ps-8"
              autoFocus
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Chip active={activeCat === "all"} onClick={() => setActiveCat("all")}>{t("all")}</Chip>
            {CATEGORY_ORDER.map((c) => (
              <Chip key={c} active={activeCat === c} onClick={() => setActiveCat(c)}>
                {t(`categories.${c}`)}
              </Chip>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-5">
            {Object.entries(grouped).length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">{t("noResults")}</div>
            )}
            {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
              <div key={cat}>
                <div className="text-[11px] font-semibold text-muted-foreground px-1 mb-2 uppercase tracking-wider">
                  {t(`categories.${cat}`)}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {grouped[cat].map((s) => {
                    const isFav = favSet.has(s.id);
                    return (
                      <div 
                        key={s.id} 
                        className={`relative group border rounded-md transition-all cursor-pointer ${
                          isFav 
                            ? "bg-blue-500/10 border-blue-500/50 shadow-md shadow-blue-500/5" 
                            : "bg-card border-border hover:border-blue-500/30"
                        }`}
                        onClick={() => {
                          onToggleFavorite(s.id);
                        }}
                        title={isFav ? t("removeFromSidebar") : t("addToSidebar")}
                      >
                        <div className="w-full flex flex-col items-center gap-1 p-2 active:scale-95 transition-transform select-none">
                          <SymbolPreview id={s.id} size={56} realistic={realistic} />
                          <span className="text-[10px] text-center leading-tight text-muted-foreground line-clamp-2">
                            {t(`symbols.${s.id}`)}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant={isFav ? "default" : "secondary"}
                          className={`absolute top-1 end-1 size-6 rounded-full transition-transform active:scale-90 ${
                            isFav ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                          }`}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            onToggleFavorite(s.id); 
                          }}
                          title={isFav ? t("removeFromSidebar") : t("addToSidebar")}
                        >
                          {isFav ? <Check className="size-3" /> : <Plus className="size-3" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
