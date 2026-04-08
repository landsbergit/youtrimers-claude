const HeroSection = () => {
  const handleCTA = () => {
    const el = document.querySelector("#supplements");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      id="hero"
      className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-background px-4 sm:px-6 lg:px-8"
    >
      {/* Subtle mint accent blobs */}
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-mint opacity-40 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-mint opacity-30 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <p className="mb-4 text-sm sm:text-base text-muted-foreground tracking-wide">
          Personalized supplements at off-the-shelf prices
        </p>

        <h1 className="font-heading text-foreground mb-6 text-4xl sm:text-5xl lg:text-6xl leading-tight">
          Find the <span className="text-primary">Right</span> Supplements for You
        </h1>

        <p className="mx-auto mb-8 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
          See if your supplements suit you and find off-the-shelf alternatives
          that better match your needs and goals.
        </p>

        <button
          onClick={handleCTA}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-md transition-all hover:opacity-90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[48px]"
        >
          Get Started
        </button>
      </div>
    </section>
  );
};

export default HeroSection;
