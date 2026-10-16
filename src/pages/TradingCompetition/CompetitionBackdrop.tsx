/** Fades the decorative grid out towards the edges. */
const GRID_MASK = "radial-gradient(80% 60% at 50% 40%, #000 0%, transparent 100%)";

/**
 * The teal-on-navy backdrop shared by every competition page, so the hero, the
 * countdown and the dashboard read as one section rather than three screens.
 */
export default function CompetitionBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A1B28] via-[#081420] to-[#050D15]" />

      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #35B9C0 1px, transparent 1px), linear-gradient(to bottom, #35B9C0 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          WebkitMaskImage: GRID_MASK,
          maskImage: GRID_MASK,
        }}
      />

      <div
        className="absolute -left-[10%] top-[-15%] size-[min(70vw,640px)] rounded-full
          bg-gradient-radial from-[#0e7f8e]/25 to-[#0e7f8e]/0 blur-[90px]"
      />
      <div
        className="absolute -right-[5%] bottom-[-20%] size-[min(80vw,720px)] rounded-full
          bg-gradient-radial from-[#35B9C0]/20 to-[#35B9C0]/0 blur-[100px]"
      />
    </div>
  );
}
