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
    title: "edit PDF",
    description: "Edit your PDF files with our easy-to-use editor.",
    href: "/tools/edit-pdf",
    icon: "E",
    tone: "bg-amber-50 text-amber-600",
    category: "pdf",
    label: "Popular",
  },
  {
    title: "rotate PDF pages",
    description: "Rotate pages in your PDF files.",
    href: "/tools/rotate-pdf-pages",
    icon: "R",
    tone: "bg-cyan-50 text-cyan-600",
    category: "pdf",
    label: "Popular",
  },
  {
    title: "delete PDF pages",
    description: "Remove unwanted pages from your PDF files.",
    href: "/tools/delete-pdf-pages",
    icon: "D",
    tone: "bg-rose-50 text-rose-600",
    category: "pdf",
    label: "Popular",
  },
  {
    title: "reorder PDF pages",
    description: "Reorder pages in your PDF files.",
    href: "/tools/reorder-pdf-pages",
    icon: "R",
    tone: "bg-amber-50 text-amber-600",
    category: "pdf",
    label: "Popular",
  },
  {
    title: "Protect PDF",
    description: "Add password protection to your PDF files.",
    href: "/tools/protect-pdf",
    icon: "P",
    tone: "bg-violet-50 text-violet-600",
    category: "pdf",
    label: "Popular",
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
  {
    title: "PDF to JPG",
    description: "Convert your PDFs to high-quality images.",
    href: "/tools/pdf-to-jpg",
    icon: "P",
    tone: "bg-rose-50 text-rose-600",
    category: "image",
    label: "Popular",
  },
  {
    title: "compress image",
    description: "Reduce the file size of your images.",
    href: "/tools/compress-image",
    icon: "C",
    tone: "bg-emerald-50 text-emerald-600",
    category: "image",
    label: "Popular",
  },
  {
    title: "resize image",
    description: "Change the dimensions of your images.",
    href: "/tools/resize-image",
    icon: "R",
    tone: "bg-amber-50 text-amber-600",
    category: "image",
    label: "Popular",
  },
  {
    title: "convert image format",
    description: "Convert your images to different formats.",
    href: "/tools/convert-image-format",
    icon: "C",
    tone: "bg-violet-50 text-violet-600",
    category: "image",
    label: "Popular",
  },
  {
    title: "heic to jpg",
    description: "Convert your HEIC images to JPG format.",
    href: "/tools/heic-to-jpg",
    icon: "H",
    tone: "bg-amber-50 text-amber-600",
    category: "image",
    label: "Popular",
  },
  {
    title: "crop image",
    description: "Trim the edges of your images.",
    href: "/tools/crop-image",
    icon: "C",
    tone: "bg-violet-50 text-violet-600",
    category: "image",
    label: "Popular",
  },
  {
    title: "rotate and flip",
    description: "Rotate and flip your images.",
    href: "/tools/rotate-and-flip",
    icon: "R",
    tone: "bg-amber-50 text-amber-600",
    category: "image",
    label: "Popular",
  },
  {
    title: "passport size photo maker",
    description: "Create passport-sized photos for your documents.",
    href: "/tools/passport-size-photo-maker",
    icon: "P",
    tone: "bg-rose-50 text-rose-600",
    category: "image",
    label: "Popular",
  },
  {
    title: "signature maker",
    description: "Create a digital signature for your documents.",
    href: "/tools/signature-maker",
    icon: "S",
    tone: "bg-rose-50 text-rose-600",
    category: "image",
    label: "Popular",
  },
   {
    title: "Background Remover",
    description: "Remove the background from your images.",
    href: "/tools/background-remover",
    icon: "B",
    tone: "bg-emerald-50 text-emerald-600",
    category: "image",
    label: "Popular",
  },
   {
    title: "add watermark to image",
    description: "Add a watermark to your images.",
    href: "/tools/add-watermark-to-image",
    icon: "W",
    tone: "bg-amber-50 text-amber-600",
    category: "image",
    label: "Popular",
  },
   {
    title: "upscale image",
    description: "Increase the resolution of your images.",
    href: "/tools/upscale-image",
    icon: "U",
    tone: "bg-amber-50 text-amber-600",
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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