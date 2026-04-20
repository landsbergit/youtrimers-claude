import TopBar from "@/components/layout/TopBar";
import { FilterSidebar } from "@/components/layout/FilterSidebar";
import MatchesSection from "@/components/sections/MatchesSection";
import CurrentSupplementsSection from "@/components/sections/CurrentSupplementsSection";
import CartSection from "@/components/sections/CartSection";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      {/* Two-panel dashboard layout */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-12">
        <div className="lg:flex lg:gap-8 items-start">

          {/* Left: Filter sidebar (desktop) */}
          <div className="hidden lg:block lg:w-[320px] lg:flex-shrink-0">
            <FilterSidebar />
          </div>

          {/* Right: Main content */}
          <div className="flex-1 min-w-0 space-y-6">
            <MatchesSection />
            <CurrentSupplementsSection />
            <CartSection />
          </div>

        </div>
      </div>

      <section id="about" className="min-h-[50vh] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-heading text-foreground text-3xl">About</h2>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
