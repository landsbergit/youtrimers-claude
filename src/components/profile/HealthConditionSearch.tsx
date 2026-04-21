import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import type { ConditionLeaf } from "@/hooks/useHealthConditionNodes";
import type { SelectedCondition } from "@/hooks/useMemberHealthConditions";

interface HealthConditionSearchProps {
  allConditions: ConditionLeaf[];
  selected: SelectedCondition[];
  onAdd: (condition: SelectedCondition) => void;
  onRemove: (id: string) => void;
  isLoading?: boolean;
  actionSlot?: React.ReactNode;
}

const MAX_SUGGESTIONS = 10;

export function HealthConditionSearch({
  allConditions,
  selected,
  onAdd,
  onRemove,
  isLoading,
  actionSlot,
}: HealthConditionSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIds = new Set(selected.map((c) => c.id));

  const suggestions =
    query.trim().length === 0
      ? []
      : allConditions
          .filter(
            (c) =>
              !selectedIds.has(c.id) &&
              c.displayName.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, MAX_SUGGESTIONS);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (condition: ConditionLeaf) => {
    onAdd({ id: condition.id, displayName: condition.displayName });
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="space-y-3">
      {/* Selected conditions */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {c.displayName}
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                aria-label={`Remove ${c.displayName}`}
                className="flex-shrink-0 rounded-full hover:bg-primary/20 transition-colors p-0.5"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input + dropdown */}
      <div ref={containerRef} className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-colors">
          <Search size={14} className="flex-shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => query.trim() && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "Loading conditions…" : "Search health conditions…"}
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setOpen(false); }}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
          {actionSlot && (
            <span className="flex-shrink-0 border-l border-border pl-2 ml-1">
              {actionSlot}
            </span>
          )}
        </div>

        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden max-h-64 overflow-y-auto"
          >
            {suggestions.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(c); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`px-3 py-2 cursor-pointer text-sm transition-colors ${
                  i === activeIndex
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="font-medium">{c.displayName}</span>
              </li>
            ))}
          </ul>
        )}

        {open && query.trim().length > 0 && suggestions.length === 0 && !isLoading && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg px-3 py-2.5 text-sm text-muted-foreground">
            No conditions found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
}
