import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface CollapsibleFilterGroupProps {
  title: string;
  defaultOpen?: boolean;
  summary?: React.ReactNode;
  children: React.ReactNode;
}

export function CollapsibleFilterGroup({
  title,
  defaultOpen = false,
  summary,
  children,
}: CollapsibleFilterGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors bg-muted/30 hover:bg-muted/60"
        >
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {!open && summary && (
              <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>
            )}
          </div>
          {open ? (
            <Minus size={16} className="flex-shrink-0 text-muted-foreground" />
          ) : (
            <Plus size={16} className="flex-shrink-0 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pt-3 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
