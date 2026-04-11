import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import type { MedicationNode } from "@/hooks/useMedicationNodes";
import type { SelectedMedication } from "@/hooks/useMemberMedications";

interface MedicationSearchProps {
  allMedications: MedicationNode[];
  selected: SelectedMedication[];
  onAdd: (med: SelectedMedication) => void;
  onRemove: (id: string) => void;
  isLoading?: boolean;
}

const MAX_SUGGESTIONS = 8;

export function MedicationSearch({
  allMedications,
  selected,
  onAdd,
  onRemove,
  isLoading,
}: MedicationSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIds = new Set(selected.map((m) => m.id));

  const suggestions =
    query.trim().length === 0
      ? []
      : allMedications
          .filter(
            (m) =>
              !selectedIds.has(m.id) &&
              m.displayName.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, MAX_SUGGESTIONS);

  // Close dropdown when clicking outside
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

  const handleSelect = (med: MedicationNode) => {
    onAdd({ id: med.id, displayName: med.displayName });
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
      {/* Selected medications */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((med) => (
            <span
              key={med.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {med.displayName}
              <button
                type="button"
                onClick={() => onRemove(med.id)}
                aria-label={`Remove ${med.displayName}`}
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
            placeholder={isLoading ? "Loading medications…" : "Search medications…"}
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
        </div>

        {/* Autocomplete dropdown */}
        {open && suggestions.length > 0 && (
          <ul
            ref={listRef}
            role="listbox"
            className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
          >
            {suggestions.map((med, i) => (
              <li
                key={med.id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(med); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex items-baseline justify-between gap-3 px-3 py-2 cursor-pointer text-sm transition-colors ${
                  i === activeIndex
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="font-medium">{med.displayName}</span>
                {med.categoryName && (
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    {med.categoryName}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* No results hint */}
        {open && query.trim().length > 0 && suggestions.length === 0 && !isLoading && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg px-3 py-2.5 text-sm text-muted-foreground">
            No medications found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
}
