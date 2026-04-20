import { useState, useEffect, useRef } from "react";
import { Menu, X, ShoppingCart, UserCircle, ChevronDown } from "lucide-react";
import logo from "@/assets/logo.svg";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AuthDialog from "@/components/auth/AuthDialog";

// ── Personalize sub-items ────────────────────────────────────────────────────

const PERSONALIZE_ITEMS = [
  { label: "Goals",       href: "#goals",       description: "Choose your health, sports, and beauty goals" },
  { label: "Profile",     href: "#profile",     description: "Fill out your profile to unlock better matches" },
  { label: "Preferences", href: "#preferences", description: "Choose your preferred dosage forms" },
  { label: "Approach",    href: "#approach",    description: "Take control of how you supplement" },
];

const PERSONALIZE_IDS = PERSONALIZE_ITEMS.map((i) => i.href.slice(1));

// ── Other top-level nav items ────────────────────────────────────────────────

const OTHER_NAV_ITEMS = [
  {
    label: "Matches", href: "#matches",
    tooltip: "Discover off-the-shelf products matching your needs and goals",
    highlight: true, spaceBefore: true,
  },
  {
    label: "Review", mobileLabel: "Review Current Supplements", href: "#supplements",
    tooltip: "Review your current supplements against your recommendations",
  },
  { label: "Cart",    href: "#cart",    tooltip: "Your shopping cart",           icon: "cart",    spaceBefore: true },
  { label: "Account", href: "#account", tooltip: "Login or Create an Account",   icon: "account" },
  { label: "About",   href: "#about",   tooltip: "Welcome! Find out more about Youtrimers" },
];

const ALL_SECTION_IDS = [
  ...PERSONALIZE_IDS,
  ...OTHER_NAV_ITEMS.filter((i) => i.icon !== "account").map((i) => i.href.slice(1)),
];

// ── Active section tracker ───────────────────────────────────────────────────

function useActiveSection(): string | null {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const centre = window.innerHeight / 2;
      let bestId: string | null = null;
      let bestTop = -Infinity;

      for (const id of ALL_SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const { top, bottom } = el.getBoundingClientRect();
        if (top <= centre && bottom > 0 && top > bestTop) {
          bestTop = top;
          bestId = id;
        }
      }

      if (bestId) setActiveSection(bestId);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return activeSection;
}

// ── Component ────────────────────────────────────────────────────────────────

const TopBar = () => {
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [authOpen, setAuthOpen]       = useState(false);
  const [megaOpen, setMegaOpen]       = useState(false);
  const wrapperRef                    = useRef<HTMLDivElement>(null);
  const activeSection                 = useActiveSection();

  const isPersonalizeActive = activeSection !== null && PERSONALIZE_IDS.includes(activeSection);

  const handleNavClick = (href: string, icon?: string) => {
    setMobileOpen(false);
    setMegaOpen(false);
    if (icon === "account") { setAuthOpen(true); return; }
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="flex items-center gap-2.5"
          >
            <img src={logo} alt="Youtrimers logo" className="h-9 w-9" />
            <span className="font-heading text-xl font-bold text-foreground">Youtrients</span>
            <span className="hidden sm:inline text-xs text-muted-foreground ml-3">Personalized supplements at off-the-shelf prices</span>
          </a>

          {/* ── Desktop Nav ─────────────────────────────────────────────── */}
          <nav className="hidden md:flex items-center gap-1">
            <TooltipProvider delayDuration={300}>

              {/* Personalize — trigger + mega menu in one hover zone */}
              <div
                ref={wrapperRef}
                className="relative"
                onMouseEnter={() => setMegaOpen(true)}
                onMouseLeave={() => setMegaOpen(false)}
              >
                {/* Trigger button */}
                <button
                  onClick={() => handleNavClick("#goals")}
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md min-h-[44px] transition-colors
                    ${megaOpen || isPersonalizeActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                >
                  Personalize
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${megaOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Mega menu — stays in the hover zone via pt-1 bridge */}
                {megaOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full pt-1 z-50">
                    <div
                      className="flex rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
                      style={{ width: "min(480px, calc(100vw - 2rem))" }}
                    >
                      {PERSONALIZE_ITEMS.map((item) => {
                        const isActive = activeSection === item.href.slice(1);
                        return (
                          <Tooltip key={item.href}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleNavClick(item.href)}
                                className={`flex-1 flex items-center justify-center px-4 py-4 text-sm font-semibold whitespace-nowrap transition-colors
                                  hover:bg-accent
                                  ${isActive ? "bg-primary/10 text-primary" : "text-foreground"}
                                  not-last:border-r not-last:border-border`}
                              >
                                {item.label}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent><p>{item.description}</p></TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Other nav items */}
              {OTHER_NAV_ITEMS.map((item) => {
                const sectionId = item.href.slice(1);
                const isActive  = activeSection === sectionId;

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
                        {item.icon === "cart"    ? <ShoppingCart className="h-5 w-5" />
                        : item.icon === "account" ? <UserCircle   className="h-5 w-5" />
                        : item.label}
                      </button>
                    </TooltipTrigger>
                    {item.tooltip && !isActive && (
                      <TooltipContent><p>{item.tooltip}</p></TooltipContent>
                    )}
                  </Tooltip>
                );
              })}

            </TooltipProvider>
          </nav>

          {/* Mobile Hamburger toggle */}
          <button
            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* ── Mobile Nav ──────────────────────────────────────────────────── */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-border bg-background px-4 pb-4">

            {/* Personalize category label */}
            <div className="pt-3 pb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
              Personalize
            </div>

            {/* Personalize sub-items — indented */}
            {PERSONALIZE_ITEMS.map((item) => {
              const isActive = activeSection === item.href.slice(1);
              return (
                <button
                  key={item.href}
                  onClick={() => handleNavClick(item.href)}
                  className={`block w-full text-left pl-7 pr-3 py-3 text-base font-medium rounded-md min-h-[44px]
                    hover:text-foreground hover:bg-accent transition-colors
                    ${isActive ? "bg-accent text-foreground" : "text-muted-foreground"}`}
                >
                  {item.label}
                </button>
              );
            })}

            {/* Divider */}
            <div className="my-2 border-t border-border" />

            {/* Other items */}
            {OTHER_NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.href.slice(1);
              return (
                <button
                  key={item.href}
                  onClick={() => handleNavClick(item.href, item.icon)}
                  className={`block w-full text-left px-3 py-3 text-base font-medium rounded-md min-h-[44px]
                    hover:text-foreground hover:bg-accent transition-colors
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
