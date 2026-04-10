import { useState, useEffect } from "react";
import { Menu, X, ShoppingCart, UserCircle } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AuthDialog from "@/components/auth/AuthDialog";

const NAV_ITEMS = [
  { label: "Supplements", mobileLabel: "Current Supplements", href: "#supplements", tooltip: "Assess your current supplements" },
  { label: "Goals",        href: "#goals",       tooltip: "Choose your health, sports, and beauty goals" },
  { label: "Profile",      href: "#profile",     tooltip: "Fill out your profile to unlock better matches" },
  { label: "Approach",     href: "#approach",    tooltip: "Take control of how you supplement" },
  { label: "Matches",      href: "#matches",     tooltip: "Discover off-the-shelf products matching your needs and goals", highlight: true, spaceBefore: true },
  { label: "Cart",         href: "#cart",        tooltip: "Your shopping cart", icon: "cart", spaceBefore: true },
  { label: "Account",      href: "#account",     tooltip: "Login or Create an Account", icon: "account" },
  { label: "About",        href: "#about",       tooltip: "Welcome! Find out more about Youtrimers" },
];

/** IDs of sections that map 1-to-1 with nav items (excludes #account which opens a dialog) */
const SECTION_IDS = NAV_ITEMS
  .filter((item) => item.icon !== "account")
  .map((item) => item.href.slice(1)); // strip the leading #

/**
 * Tracks which section is currently active based on scroll position.
 * Picks the section whose top edge is closest to (but still above) the
 * viewport centre — deterministic and works for short bottom sections too.
 */
function useActiveSection(): string | null {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const centre = window.innerHeight / 2;
      let bestId: string | null = null;
      let bestTop = -Infinity;

      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const { top, bottom } = el.getBoundingClientRect();
        // Section must have started scrolling into view (top ≤ centre)
        // and not entirely scrolled past (bottom > 0)
        if (top <= centre && bottom > 0 && top > bestTop) {
          bestTop = top;
          bestId = id;
        }
      }

      if (bestId) setActiveSection(bestId);
    };

    update(); // initialise on mount
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return activeSection;
}

const TopBar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const activeSection = useActiveSection();

  const handleNavClick = (href: string, icon?: string) => {
    setMobileOpen(false);
    if (icon === "account") {
      setAuthOpen(true);
      return;
    }
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2.5"
          >
            <img src={logo} alt="Youtrimers logo" className="h-9 w-9" />
            <span className="font-heading text-xl font-bold text-foreground">Youtrimers</span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <TooltipProvider delayDuration={300}>
              {NAV_ITEMS.map((item) => {
                const sectionId = item.href.slice(1);
                const isActive = activeSection === sectionId;

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleNavClick(item.href, item.icon)}
                        className={`px-3 py-2 text-sm font-medium transition-colors rounded-md min-h-[44px] flex items-center
                          ${item.highlight
                            ? "text-primary font-semibold hover:bg-accent hover:text-primary/80"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"}
                          ${item.spaceBefore ? "ml-4" : ""}
                          ${isActive ? "bg-accent text-foreground" : ""}`}
                      >
                        {item.icon === "cart" ? (
                          <ShoppingCart className="h-5 w-5" />
                        ) : item.icon === "account" ? (
                          <UserCircle className="h-5 w-5" />
                        ) : (
                          item.label
                        )}
                      </button>
                    </TooltipTrigger>
                    {/* Suppress tooltip when the section is already active */}
                    {item.tooltip && !isActive && (
                      <TooltipContent>
                        <p>{item.tooltip}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </nav>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-border bg-background px-4 pb-4">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.href.slice(1);
              return (
                <button
                  key={item.href}
                  onClick={() => handleNavClick(item.href, item.icon)}
                  className={`block w-full text-left px-3 py-3 text-base font-medium rounded-md min-h-[44px]
                    hover:text-foreground hover:bg-accent
                    ${isActive ? "bg-accent text-foreground" : "text-muted-foreground"}`}
                >
                  {item.icon === "cart" ? (
                    <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Cart</span>
                  ) : item.icon === "account" ? (
                    <span className="flex items-center gap-2"><UserCircle className="h-5 w-5" /> Account</span>
                  ) : (
                    item.mobileLabel || item.label
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
};

export default TopBar;
