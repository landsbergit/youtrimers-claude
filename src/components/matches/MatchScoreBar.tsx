interface MatchScoreBarProps {
  score: number; // 0–1
}

/**
 * A thin horizontal bar showing match quality.
 * Colour: green ≥ 0.7, amber 0.4–0.7, muted < 0.4.
 */
export function MatchScoreBar({ score }: MatchScoreBarProps) {
  const pct = Math.round(score * 1000) / 10; // one decimal, e.g. 93.4

  const colour =
    pct >= 70
      ? "bg-success"
      : pct >= 40
      ? "bg-warning"
      : "bg-muted-foreground/40";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}
