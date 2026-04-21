import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { ConditionGroup, ConditionLeaf } from "@/hooks/useHealthConditionNodes";
import type { SelectedCondition } from "@/hooks/useMemberHealthConditions";

// ── Hotspot definitions ───────────────────────────────────────────────────────
// Coordinates in viewBox="0 0 420 488". Body center x=210, y=12 (head top) – y=480 (feet).
// labelSide: which side the label text appears on relative to the dot.

interface HotspotDef {
  nodeId: string;
  label: string;
  cx: number;
  cy: number;
  labelSide: "left" | "right";
}

const HOTSPOTS: HotspotDef[] = [
  // ── Organs ──
  { nodeId: "cff4fe09-0c65-474e-9bc6-0cbe5d68e7c1", label: "Hair",            cx: 210, cy: 20,  labelSide: "right" },
  { nodeId: "cff4fe09-0c65-474e-9bc6-0cbe5d68e7c1", label: "Nails",           cx: 165, cy: 305, labelSide: "left"  },
  { nodeId: "67a5425e-f053-4d44-b0b7-78f5c7b418a3", label: "Eye",              cx: 210, cy: 63,  labelSide: "right" },
  { nodeId: "c771ed33-3268-4531-8fcc-9a584e596ac0", label: "Mouth",            cx: 210, cy: 85,  labelSide: "right" },
  { nodeId: "ce5a561c-3c22-47c7-8c37-fd361e0a1b00", label: "Skin",             cx: 270, cy: 250, labelSide: "right" },
  { nodeId: "7b59b55d-2d7b-4dec-9c84-224ca7e7c211", label: "Reproductive",     cx: 210, cy: 281, labelSide: "right" },
  // ── Systems ──
  { nodeId: "60e86b9b-fdf3-4fe8-9e84-7c33ec38a6c6", label: "Nervous",          cx: 210, cy: 47,  labelSide: "left"  },
  { nodeId: "b14059a9-3a0c-4f22-ae26-52441a4295e8", label: "Endocrine",        cx: 210, cy: 120, labelSide: "left"  },
  { nodeId: "a15676c6-1537-4da2-9bf5-662ccc117082", label: "Musculoskeletal",  cx: 270, cy: 132, labelSide: "right" },
  { nodeId: "455a54da-910a-48bc-bea9-4fa8e188e94d", label: "Cardiovascular",   cx: 145, cy: 145, labelSide: "left"  },
  { nodeId: "e296b655-47dc-4dc2-acb5-2f9127c70633", label: "Respiratory",      cx: 248, cy: 155, labelSide: "right" },
  { nodeId: "29c01528-be20-4901-b596-edefc9a9feb0", label: "Blood",            cx: 130, cy: 200, labelSide: "left"  },
  { nodeId: "f0c3ed1d-cb3f-4525-ad30-d6de9e2d8063", label: "Immune",           cx: 258, cy: 181, labelSide: "right" },
  { nodeId: "4447d30d-e210-4abf-a338-3e8dcae78f69", label: "Digestive",        cx: 210, cy: 220, labelSide: "right" },
  { nodeId: "c54afbcc-18ff-48c7-a0b9-6ffa8560a96c", label: "Urinary",          cx: 210, cy: 281, labelSide: "left"  },
];

// Body silhouette is now an external PNG image (public/body-silhouette.png).

// ── Props ─────────────────────────────────────────────────────────────────────

interface BodyMapProps {
  groups: ConditionGroup[];
  selected: SelectedCondition[];
  onToggle: (condition: SelectedCondition) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BodyMap({ groups, selected, onToggle, onClose }: BodyMapProps) {
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const selectedIds = new Set(selected.map((c) => c.id));

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenNodeId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Visible hotspots: only those whose group has conditions
  const visibleHotspots = HOTSPOTS.filter((h) => groupById.has(h.nodeId));

  // Original viewBox is 420×488. We crop at the knees (y≈380) for display.
  const CROP_Y = 380;
  const W = 300;
  const H = Math.round(W * (CROP_Y / 420));
  const scaleX = W / 420;
  const scaleY = H / CROP_Y;

  return (
    <div ref={containerRef} className="flex-shrink-0 select-none">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Body Map
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close body map"
        >
          <X size={14} />
        </button>
      </div>

      {/* Map container */}
      <div
        className="relative"
        style={{ width: W, height: H }}
      >
        {/* Body silhouette image — full body rendered, cropped at knees */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src="/body-silhouette.png"
            alt=""
            width={W}
            className="object-contain object-top opacity-40 pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Hotspot markers + labels */}
        {visibleHotspots.map((hotspot, idx) => {
          const group = groupById.get(hotspot.nodeId)!;
          const selectedCount = group.conditions.filter((c) => selectedIds.has(c.id)).length;
          const hotspotKey = `${hotspot.nodeId}-${hotspot.label}`;
          const isOpen = openNodeId === hotspotKey;
          const px = Math.round(hotspot.cx * scaleX); // pixel x in container
          const py = Math.round(hotspot.cy * scaleY); // pixel y in container

          return (
            <div key={hotspotKey}>
              {/* Marker: label + dot, flex direction based on side */}
              <div
                className="absolute flex items-center"
                style={{
                  ...(hotspot.labelSide === "left"
                    ? { right: W - px }
                    : { left: px }),
                  top: py,
                  transform: "translateY(-50%)",
                  flexDirection: hotspot.labelSide === "left" ? "row" : "row-reverse",
                  gap: 4,
                  zIndex: 10,
                }}
              >
                {/* Label text */}
                <span className="text-[10px] leading-none text-muted-foreground whitespace-nowrap">
                  {hotspot.label}
                </span>

                {/* Dot button */}
                <button
                  type="button"
                  onClick={() => setOpenNodeId(isOpen ? null : hotspotKey)}
                  className={`relative flex-shrink-0 rounded-full border-2 transition-colors ${
                    selectedCount > 0
                      ? "bg-primary/20 border-primary w-4 h-4"
                      : "bg-background border-border hover:border-primary/60 w-3.5 h-3.5"
                  }`}
                  title={hotspot.label}
                >
                  {selectedCount > 0 && (
                    <span className="absolute -top-2 -right-2 text-[8px] font-bold bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                      {selectedCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Popover — clamped within container bounds */}
              {isOpen && (() => {
                const popW = 200;
                const rawLeft = px - popW / 2;
                const clampedLeft = Math.max(0, Math.min(rawLeft, W - popW));
                return (
                <div
                  className="absolute z-50 bg-popover border border-border rounded-xl shadow-xl p-3"
                  style={{
                    top: py + 14,
                    left: clampedLeft,
                    width: popW,
                  }}
                >
                  <p className="text-sm font-semibold text-foreground mb-2">{hotspot.label}</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {group.conditions
                      .filter((c) => {
                        // Split Hair & Nails group: show only relevant conditions per hotspot
                        if (hotspot.label === "Hair") return !c.displayName.toLowerCase().includes("nail");
                        if (hotspot.label === "Nails") return c.displayName.toLowerCase().includes("nail");
                        return true;
                      })
                      .map((condition: ConditionLeaf) => (
                      <label
                        key={condition.id}
                        className="flex items-center gap-2 cursor-pointer select-none group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(condition.id)}
                          onChange={() =>
                            onToggle({ id: condition.id, displayName: condition.displayName })
                          }
                          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer flex-shrink-0"
                        />
                        <span className="text-sm text-foreground group-hover:text-foreground/80 leading-snug">
                          {condition.displayName}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
