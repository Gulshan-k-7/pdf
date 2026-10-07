import Link from "next/link";

export  function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#e6e6e6]">
      <div className="mx-auto flex min-h-[620px] max-w-6xl items-center justify-center px-6 py-24 sm:px-8">
        <div className="max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-black/[0.07] bg-white/70 px-4 py-2 text-[11px] font-medium tracking-[0.12em] text-neutral-500 shadow-sm backdrop-blur-xl">
            SIMPLE TOOLS. NO COMPLEXITY.
          </div>

          <h1 className="text-balance text-5xl font-semibold tracking-[-0.055em] text-neutral-950 sm:text-6xl md:text-7xl">
            Everything you need to
            <span className="block text-neutral-400">work with files.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-base leading-7 tracking-[-0.01em] text-neutral-500 sm:text-lg">
            Fast, simple tools for working with PDFs and images.
            Convert, compress, merge, resize and more — right from your browser.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/pdf"
              className="flex h-12 items-center justify-center rounded-xl bg-neutral-950 px-7 text-sm font-medium tracking-[-0.01em] text-white transition-all duration-200 hover:bg-neutral-800"
            >
              Explore PDF tools
            </Link>

            <Link
              href="/image"
              className="flex h-12 items-center justify-center rounded-xl border border-black/[0.08] bg-white/70 px-7 text-sm font-medium tracking-[-0.01em] text-neutral-700 backdrop-blur-xl transition-all duration-200 hover:border-black/[0.15] hover:bg-white"
            >
              Explore image tools
            </Link>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-200/40 blur-3xl" />
    </section>
  );
}