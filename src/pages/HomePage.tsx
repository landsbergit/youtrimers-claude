import TopBar from "@/components/layout/TopBar";
import HeroSection from "@/components/sections/HeroSection";
import GoalsSection from "@/components/goals/GoalsSection";
import ProfileSection from "@/components/sections/ProfileSection";
import PreferencesSection from "@/components/sections/PreferencesSection";
import CurrentSupplementsSection from "@/components/sections/CurrentSupplementsSection";
import ApproachSection from "@/components/sections/ApproachSection";
import MatchesSection from "@/components/sections/MatchesSection";
import CartSection from "@/components/sections/CartSection";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <HeroSection />

      <CurrentSupplementsSection />

      <GoalsSection />

      <ProfileSection />

      <PreferencesSection />

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
