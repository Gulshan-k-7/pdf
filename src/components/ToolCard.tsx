import Link from "next/link";

export type Tool = {
  title: string;
  description: string;
  href: string;
  icon: string;
  tone: string;
  category: "pdf" | "image";
  label?: string;
};

export function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      href={tool.href}
      className="group flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/70 p-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-black/[0.1] hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${tool.tone}`}
      >
        {tool.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold tracking-[-0.02em] text-neutral-900">
            {tool.title}
          </h3>

          {tool.label && (
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-neutral-500">
              {tool.label}
            </span>
          )}
        </div>

        <p className="mt-1 line-clamp-2 text-xs leading-5 tracking-[-0.005em] text-neutral-500">
          {tool.description}
        </p>
      </div>

      <span className="shrink-0 text-lg text-neutral-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-neutral-700">
        →
      </span>
    </Link>
  );
}