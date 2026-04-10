import TopBar from "@/components/layout/TopBar";
import HeroSection from "@/components/sections/HeroSection";
import GoalsSection from "@/components/goals/GoalsSection";
import ApproachSection from "@/components/sections/ApproachSection";
import MatchesSection from "@/components/sections/MatchesSection";
import CartSection from "@/components/sections/CartSection";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <HeroSection />

      <section id="supplements" className="min-h-screen px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-heading text-foreground text-3xl">Current Supplements</h2>
          <p className="mt-2 text-muted-foreground">Coming soon…</p>
        </div>
      </section>

      <GoalsSection />

      <section id="profile" className="min-h-[50vh] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-heading text-foreground text-3xl">Profile</h2>
        </div>
      </section>

      <ApproachSection />

      <MatchesSection />

      <CartSection />

      <section id="about" className="min-h-[50vh] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-heading text-foreground text-3xl">About</h2>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
