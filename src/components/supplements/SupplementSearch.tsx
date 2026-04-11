import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ArrowRight, Camera, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CurrentSupplement } from "@/hooks/useMemberCurrentSupplements";

interface SearchResult {
  productId: number;
  productName: string;
  brand: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  costUsd: number | null;
  normalizedDosageForm: string | null;
}

const MAX_RESULTS = 8;

/** Detect the search mode from the raw input string. */
function detectMode(input: string): "url" | "upc" | "name" {
  const trimmed = input.trim();
  if (trimmed.startsWith("http") || trimmed.toLowerCase().includes("iherb")) return "url";
  if (/^\d{8,14}$/.test(trimmed)) return "upc";
  return "name";
}

async function runSearch(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const mode = detectMode(trimmed);
  let q = supabase
    .from("products")
    .select("id, product_name, brand, image_url, product_url, cost_usd, normalized_dosage_form")
    .eq("is_active", true)
    .limit(MAX_RESULTS);

  if (mode === "url") {
    q = q.ilike("product_url", `%${trimmed}%`);
  } else if (mode === "upc") {
    q = q.eq("upc", trimmed);
  } else {
    q = q.ilike("product_name", `%${trimmed}%`);
  }

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((p) => ({
    productId: p.id,
    productName: p.product_name,
    brand: p.brand ?? null,
    imageUrl: p.image_url ?? null,
    productUrl: p.product_url ?? null,
    costUsd: p.cost_usd ?? null,
    normalizedDosageForm: p.normalized_dosage_form ?? null,
  }));
}

interface SupplementSearchProps {
  alreadyAddedIds: Set<number>;
  onAdd: (supplement: CurrentSupplement) => void;
}

export function SupplementSearch({ alreadyAddedIds, onAdd }: SupplementSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showCameraHint, setShowCameraHint] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close dropdown on outside click
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

  const search = useCallback(async (value: string) => {
    if (!value.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const res = await runSearch(value);
    setResults(res);
    setOpen(res.length > 0);
    setLoading(false);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSubmit = () => {
    clearTimeout(debounceRef.current);
    search(query);
  };

  const handleSelect = (result: SearchResult) => {
    onAdd(result as CurrentSupplement);
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      } else {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const mode = query.trim() ? detectMode(query) : null;
  const modeLabel = mode === "url" ? "URL" : mode === "upc" ? "UPC" : null;

  return (
    <div ref={containerRef} className="relative">
      {/* Search bar */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-colors shadow-sm">
        {/* Left: search icon + optional mode badge */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Search size={15} className="text-muted-foreground" />
          {modeLabel && (
            <span className="rounded-sm bg-primary/10 px-1 py-0.5 text-[10px] font-semibold text-primary leading-none">
              {modeLabel}
            </span>
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Type or paste a supplement product name, url at iHerb, UPC code or scan its barcode by clicking the camera icon in the bar"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
        />

        {/* Clear */}
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); inputRef.current?.focus(); }}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear"
          >
            <X size={14} />
          </button>
        )}

        {/* Camera (barcode stub) */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => { setShowCameraHint((v) => !v); inputRef.current?.focus(); }}
            className="flex items-center justify-center h-7 w-7 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Scan barcode"
          >
            <Camera size={14} />
          </button>
          {showCameraHint && (
            <div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-lg border border-border bg-popover shadow-lg px-3 py-2.5 text-xs text-muted-foreground">
              <div className="flex items-start justify-between gap-2">
                <span>Barcode scanning coming soon. Type or paste a UPC code (8–14 digits) to search by barcode.</span>
                <button
                  type="button"
                  onClick={() => setShowCameraHint(false)}
                  aria-label="Close"
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Go arrow */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!query.trim() || loading}
          className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors flex-shrink-0"
          aria-label="Search"
        >
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1.5 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
        >
          {results.map((r, i) => {
            const alreadyAdded = alreadyAddedIds.has(r.productId);
            return (
              <li
                key={r.productId}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); if (!alreadyAdded) handleSelect(r); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                  alreadyAdded
                    ? "opacity-40 cursor-not-allowed"
                    : i === activeIndex
                    ? "bg-primary/10 cursor-pointer"
                    : "hover:bg-muted cursor-pointer"
                }`}
              >
                {/* Thumbnail */}
                <div className="w-9 h-9 flex-shrink-0 rounded-md overflow-hidden bg-muted border border-border">
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt="" className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                      —
                    </div>
                  )}
                </div>

                {/* Name + brand */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground leading-snug line-clamp-1">
                    {r.productName}
                  </p>
                  {r.brand && (
                    <p className="text-xs text-muted-foreground">{r.brand}</p>
                  )}
                </div>

                {/* Price */}
                {r.costUsd != null && (
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    ${r.costUsd.toFixed(2)}
                  </span>
                )}

                {alreadyAdded && (
                  <span className="flex-shrink-0 text-xs text-muted-foreground italic">Added</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* No results hint */}
      {open && results.length === 0 && !loading && query.trim() && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-border bg-popover shadow-lg px-3 py-3 text-sm text-muted-foreground">
          No products found for "{query}"
        </div>
      )}
    </div>
  );
}
