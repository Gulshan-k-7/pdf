import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-black/[0.06] bg-white/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="text-lg font-semibold tracking-[-0.04em] text-neutral-950"
        >
          paperkit
        </Link>

        {/* Description */}
        <p className="text-sm tracking-[-0.01em] text-neutral-500">
          Thoughtful little tools for your everyday files.
        </p>

        {/* Footer text */}
        <span className="text-xs tracking-[0.02em] text-neutral-400">
          Made for a smoother workflow
        </span>
      </div>
    </footer>
  );
}