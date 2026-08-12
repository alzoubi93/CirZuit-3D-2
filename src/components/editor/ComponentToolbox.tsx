import { useMemo, useState } from "react";
import { ConnectorGeneratorModal } from "./ConnectorGeneratorModal";
import { Cpu, Type } from "lucide-react";
import type { ConnectorMetadata } from "@/lib/symbols";

import { SYMBOLS, CATEGORY_ORDER } from "@/lib/symbols";
import { SymbolPreview } from "./SymbolPreview";
import { ComponentLibrary } from "./ComponentLibrary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LibraryBig, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { loadFavorites, saveFavorites } from "@/lib/favorites";
import type { SymbolId } from "@/lib/schematic";

interface Props {
  onPick: (id: SymbolId) => void;
  onOpenConnModal?: () => void;
  onClose?: () => void;
  realistic?: boolean;
}

export function ComponentToolbox({ onPick, onOpenConnModal, onClose, realistic = false }: Props) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [favorites, setFavorites] = useState<SymbolId[]>(() => loadFavorites());
  const [libOpen, setLibOpen] = useState(false);
  const [connModalOpen, setConnModalOpen] = useState(false);

  const updateFavorites = (next: SymbolId[]) => {
    setFavorites(next);
    saveFavorites(next);
  };

  const toggleFav = (id: SymbolId) => {
    updateFavorites(favorites.includes(id) ? favorites.filter((x) => x !== id) : [id, ...favorites]);
  };

  const removeFav = (id: SymbolId) => updateFavorites(favorites.filter((x) => x !== id));

  const grouped = useMemo(() => {
    const list = favorites
      .map((id) => SYMBOLS[id])
      .filter(Boolean)
      .filter((s) => {
        if (!q) return true;
        const name = t(`symbols.${s.id}`).toLowerCase();
        return name.includes(q.toLowerCase()) || s.id.includes(q.toLowerCase());
      });
    const g: Record<string, typeof list> = {};
    for (const s of list) (g[s.category] ??= []).push(s);
    return g;
  }, [favorites, q, t]);

  return (
    <div className="flex flex-col h-full w-[290px] sm:w-[310px] shrink-0 bg-panel text-panel-foreground border-r border-border/80 relative">
      <div className="p-2 border-b space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Button onClick={() => { setLibOpen(true); setQ(""); }} className="flex-1 gap-2 h-9" variant="default">
            <LibraryBig className="size-4" />
            {t("openLibrary")}
          </Button>

          <Button onClick={onOpenConnModal} variant="outline" className="h-9" title={t("connectorGen.title")}>
            <Cpu className="size-4" />
          </Button>
          <Button onClick={() => onPick("text")} variant="outline" className="h-9" title={t("connectorGen.addText") || "Add Text"}>
            <Type className="size-4" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0" 
            onClick={onClose}
          >
            <X className="size-4 stroke-[2.5]" />
          </Button>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="h-8 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-slate-700/60 scrollbar-track-transparent">
        <div className="p-2 space-y-4">
          {favorites.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8 px-3">
              {t("noFavorites")}
            </div>
          )}
          {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
            <div key={cat} className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider">
                {t(`categories.${cat}`)}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700/60 scrollbar-track-transparent snap-x">
                {grouped[cat].map((s) => (
                  <div key={s.id} className="relative group shrink-0 w-[84px] snap-start">
                    <button
                      onClick={() => onPick(s.id)}
                      className="w-full h-[92px] flex flex-col items-center justify-between gap-1 p-1.5 rounded-md border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors active:scale-95"
                    >
                      <div className="flex-1 flex items-center justify-center">
                        <SymbolPreview id={s.id} size={40} realistic={realistic} />
                      </div>
                      <span className="text-[10px] text-center leading-tight text-muted-foreground line-clamp-2 w-full">
                        {t(`symbols.${s.id}`)}
                      </span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFav(s.id); }}
                      className="absolute -top-1 -end-1 size-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity shadow"
                      title={t("removeFromSidebar")}
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ComponentLibrary
        open={libOpen}
        onOpenChange={setLibOpen}
        favorites={favorites}
        onToggleFavorite={toggleFav}
        onPick={onPick}
        realistic={realistic}
      />
    </div>
  );
}
