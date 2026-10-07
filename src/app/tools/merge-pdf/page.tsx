import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
export default function MergePdfPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-6xl px-6 py-20 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            PDF TOOL
          </p>

          <h1 className="text-4xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-5xl">
            Merge PDF
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 tracking-[-0.01em] text-neutral-500 sm:text-base">
            Bring multiple documents together. File processing will be added soon.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-2xl">
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-black/[0.1] bg-white/60 px-6 py-12 text-center shadow-sm shadow-black/[0.02] backdrop-blur-xl">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-2xl text-neutral-500">
              +
            </div>

            <strong className="text-base font-semibold tracking-[-0.02em] text-neutral-900">
              Your file workspace
            </strong>

            <span className="mt-2 text-sm text-neutral-400">
              Add PDFs in the order you want them
            </span>

            <button
              disabled
              className="mt-7 h-11 cursor-not-allowed rounded-xl bg-neutral-950 px-6 text-sm font-medium text-white opacity-40"
            >
              Choose PDFs
            </button>
          <small>PDF files up to 50 MB each</small>
        </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
