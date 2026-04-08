import TopBar from "@/components/layout/TopBar";
import HeroSection from "@/components/sections/HeroSection";
import GoalsSection from "@/components/goals/GoalsSection";

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

      <section id="approach" className="min-h-[50vh] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-heading text-foreground text-3xl">Approach</h2>
        </div>
      </section>

      <section id="matches" className="min-h-[50vh] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-heading text-foreground text-3xl">Matches</h2>
        </div>
      </section>

      <section id="cart" className="min-h-[50vh] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-heading text-foreground text-3xl">Shopping Cart</h2>
        </div>
      </section>

      <section id="about" className="min-h-[50vh] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="font-heading text-foreground text-3xl">About</h2>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
