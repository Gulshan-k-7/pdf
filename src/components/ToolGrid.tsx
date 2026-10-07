import Link from "next/link";
import { ToolCard, type Tool } from "@/components/ToolCard";

const tools: Tool[] = [
  {
    title: "Compress PDF",
    description: "Make a PDF smaller and easier to share.",
    href: "/tools/compress-pdf",
    icon: "↓",
    tone: "bg-emerald-50 text-emerald-600",
    category: "pdf",
  },
  {
    title: "Merge PDF",
    description: "Bring multiple documents together.",
    href: "/tools/merge-pdf",
    icon: "+",
    tone: "bg-violet-50 text-violet-600",
    category: "pdf",
  },
  {
    title: "Split PDF",
    description: "Separate pages into smaller files.",
    href: "/tools/split-pdf",
    icon: "/",
    tone: "bg-orange-50 text-orange-600",
    category: "pdf",
  },
  {
    title: "JPG to PDF",
    description: "Turn images into a shareable PDF.",
    href: "/tools/jpg-to-pdf",
    icon: "J",
    tone: "bg-sky-50 text-sky-600",
    category: "image",
    label: "Popular",
  },
];

export function ToolGrid({
  category,
}: {
  category?: "pdf" | "image";
} = {}) {
  const shown = category
    ? tools.filter((tool) => tool.category === category)
    : tools;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8">
      {/* Heading */}
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            A GOOD PLACE TO START
          </p>

          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-neutral-950 sm:text-3xl">
            {category === "image" ? "Image tools" : "Small tools, big help."}
          </h2>
        </div>

        {!category && (
          <Link
            href="/pdf"
            className="shrink-0 text-sm font-medium tracking-[-0.01em] text-neutral-500 transition-colors hover:text-neutral-950"
          >
            See all PDF tools →
          </Link>
        )}
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.length ? (
          shown.map((tool) => (
            <ToolCard key={tool.href} tool={tool} />
          ))
        ) : (
          <div className="rounded-2xl border border-black/[0.06] bg-white/70 p-8 text-sm text-neutral-500 backdrop-blur-xl">
            More image tools are on the way.{" "}
            <Link
              href="/tools/jpg-to-pdf"
              className="font-medium text-neutral-900 underline underline-offset-4"
            >
              Try JPG to PDF
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}