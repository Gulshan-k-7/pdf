"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type ConvertedPage = { page: number; image: string };
const maxFileSize = 50 * 1024 * 1024;

export default function PdfToJpgPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState<ConvertedPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function convert(file: File) {
    setError("");
    setPages([]);
    if (file.size > maxFileSize) { setError("Choose a PDF smaller than 50 MB."); return; }
    setBusy(true);
    try {
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const converted: ConvertedPage[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport, background: "white" }).promise;
        converted.push({ page: number, image: canvas.toDataURL("image/jpeg", 0.9) });
        page.cleanup();
      }
      setFileName(file.name.replace(/\.pdf$/i, "") || "document");
      setPages(converted);
    } catch {
      setError("We couldn’t open this PDF. It may be password-protected or damaged.");
    } finally { setBusy(false); }
  }

  function download(page: ConvertedPage) {
    const anchor = document.createElement("a");
    anchor.href = page.image;
    anchor.download = `${fileName}-page-${page.page}.jpg`;
    anchor.click();
  }

  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#eff6ff_0%,_#f8fafc_42%,_#fff_100%)] px-4 py-10 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white bg-white/80 text-2xl shadow-lg shadow-blue-100/70">▧</div><p className="mb-2 text-sm font-semibold uppercase tracking-[.18em] text-blue-600">PaperKit PDF tools</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">PDF to JPG</h1><p className="mt-3 text-slate-600">Turn each page of your PDF into a high-quality JPG image.</p></header>
      {pages.length === 0 ? <section className="mx-auto max-w-3xl rounded-3xl border border-white/80 bg-white/75 p-6 shadow-xl shadow-slate-200/60 backdrop-blur-xl sm:p-10"><button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 px-6 text-center transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60"><span className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-white text-3xl shadow-sm">📄</span><span className="text-xl font-semibold">{busy ? "Converting pages…" : "Choose a PDF to convert"}</span><span className="mt-2 text-sm text-slate-500">Your pages will appear as JPG previews · Up to 50 MB</span><span className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">Select PDF</span></button><input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void convert(file); event.target.value = ""; }} />{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<p className="mt-5 text-center text-sm text-slate-500">🔒 Your document stays on this device and is processed in your browser.</p></section> : <section><div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><div><h2 className="font-semibold">{fileName}.pdf</h2><p className="text-sm text-slate-500">{pages.length} JPG images ready</p></div><button type="button" onClick={() => inputRef.current?.click()} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white">Choose another PDF</button><input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void convert(file); event.target.value = ""; }} /></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{pages.map((page) => <article key={page.page} className="overflow-hidden rounded-2xl border border-white bg-white/80 p-3 shadow-lg shadow-slate-200/50"><img src={page.image} alt={`Page ${page.page}`} className="max-h-[60vh] w-full rounded-xl bg-slate-50 object-contain"/><div className="flex items-center justify-between px-1 pt-3"><span className="text-sm font-medium text-slate-600">Page {page.page}</span><button type="button" onClick={() => download(page)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Download JPG</button></div></article>)}</div></section>}
      <div className="mt-10 border-t border-slate-200/70 pt-7 text-center"><p className="mb-3 text-sm font-medium text-slate-500">Explore more PDF tools</p><div className="flex flex-wrap justify-center gap-3">{[["Edit PDF", "/tools/edit-pdf"], ["Compress PDF", "/tools/compress-pdf"], ["Merge PDF", "/tools/merge-pdf"], ["Split PDF", "/tools/split-pdf"]].map(([label, href]) => <Link key={href} href={href} className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700">{label} ↗</Link>)}</div></div>
    </div>
  </main>;
}
