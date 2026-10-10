"use client";

import Link from "next/link";
import { DragEvent, useState } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

type PageThumbnail = {
  originalPageNumber: number;
  image: string;
};

export default function ReorderPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageThumbnail[]>([]);
  const [originalPages, setOriginalPages] = useState<PageThumbnail[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Blob | null>(null);
  const [previewPage, setPreviewPage] = useState<PageThumbnail | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const generateThumbnails = async (selectedFile: File) => {
    setLoadingPages(true);
    setProgress(0);
    setError("");

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();

      const pdf = await pdfjsLib
        .getDocument({
          data: new Uint8Array(arrayBuffer),
        })
        .promise;

      const generatedPages: PageThumbnail[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);

        const viewport = page.getViewport({
          scale: 0.7,
        });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Unable to create canvas.");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        generatedPages.push({
          originalPageNumber: pageNumber,
          image: canvas.toDataURL("image/jpeg", 0.75),
        });

        setProgress(Math.round((pageNumber / pdf.numPages) * 100));
      }

      setPages(generatedPages);
      setOriginalPages(generatedPages);
    } catch (err) {
      console.error(err);
      setError("Unable to read this PDF. Please try another file.");
    } finally {
      setLoadingPages(false);
    }
  };

  const handleFile = async (selectedFile: File) => {
    setError("");
    setResult(null);
    setPages([]);
    setOriginalPages([]);
    setPreviewPage(null);

    if (selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("PDF must be smaller than 50 MB.");
      return;
    }

    setFile(selectedFile);

    await generateThumbnails(selectedFile);
  };

  const handleInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    await handleFile(selectedFile);

    event.target.value = "";
  };

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    setDraggedIndex(index);

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    event.preventDefault();

    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    setPages((currentPages) => {
      const updatedPages = [...currentPages];

      const [movedPage] = updatedPages.splice(draggedIndex, 1);

      updatedPages.splice(targetIndex, 0, movedPage);

      return updatedPages;
    });

    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const resetOrder = () => {
    setPages([...originalPages]);
    setResult(null);
    setError("");
  };

  const hasOrderChanged = pages.some(
    (page, index) =>
      page.originalPageNumber !== originalPages[index]?.originalPageNumber,
  );

  const createReorderedPdf = async () => {
    if (!file || pages.length === 0) {
      return;
    }

    setProcessing(true);
    setError("");
    setResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();

      const sourcePdf = await PDFDocument.load(arrayBuffer);

      const outputPdf = await PDFDocument.create();

      const pageIndexes = pages.map(
        (page) => page.originalPageNumber - 1,
      );

      const copiedPages = await outputPdf.copyPages(
        sourcePdf,
        pageIndexes,
      );

      copiedPages.forEach((page) => {
        outputPdf.addPage(page);
      });

      const pdfBytes = await outputPdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      const blob = new Blob([pdfBytes], {
        type: "application/pdf",
      });

      setResult(blob);
    } catch (err) {
      console.error(err);
      setError("Unable to create the reordered PDF.");
    } finally {
      setProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!result) {
      return;
    }

    const url = URL.createObjectURL(result);

    const link = document.createElement("a");
    link.href = url;
    link.download = "paperkit-reordered.pdf";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <section className="mx-auto max-w-6xl px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <Link
            href="/pdf"
            className="inline-flex items-center text-xs font-medium text-neutral-400 transition hover:text-neutral-900"
          >
            ← Back to PDF tools
          </Link>

          <div className="mt-7 inline-flex items-center rounded-full border border-black/[0.07] bg-white/70 px-4 py-2 text-[11px] font-medium tracking-[0.12em] text-neutral-500 shadow-sm backdrop-blur-xl">
            PDF TOOL
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-5xl">
            Reorder PDF Pages
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-neutral-500 sm:text-base">
            Drag and drop pages into any order you want, then create your
            reordered PDF.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-5xl">
          {!file && (
            <label className="group flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-black/[0.12] bg-white/70 p-8 text-center backdrop-blur-xl transition hover:border-black/[0.2] hover:bg-white">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleInputChange}
                className="hidden"
              />

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-2xl transition group-hover:scale-105">
                ↕
              </div>

              <h2 className="mt-5 text-base font-semibold tracking-[-0.02em] text-neutral-900">
                Upload your PDF
              </h2>

              <p className="mt-2 text-sm text-neutral-500">
                Drag pages into a new order after uploading
              </p>

              <span className="mt-5 rounded-xl bg-neutral-950 px-5 py-2.5 text-xs font-medium text-white transition group-hover:bg-neutral-800">
                Choose PDF
              </span>

              <p className="mt-4 text-[11px] text-neutral-400">
                Maximum file size: 50 MB
              </p>
            </label>
          )}

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {loadingPages && (
            <div className="mt-8 rounded-3xl border border-black/[0.06] bg-white/70 p-8 text-center backdrop-blur-xl">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" />

              <p className="mt-5 text-sm font-medium text-neutral-700">
                Preparing PDF pages...
              </p>

              <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-neutral-950 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-neutral-400">
                {progress}%
              </p>
            </div>
          )}

          {file && !loadingPages && pages.length > 0 && (
            <div>
              <div className="flex flex-col gap-4 rounded-3xl border border-black/[0.06] bg-white/70 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold tracking-[-0.02em] text-neutral-900">
                    {file.name}
                  </p>

                  <p className="mt-1 text-xs text-neutral-400">
                    {pages.length} pages · Drag pages to reorder
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="flex h-10 cursor-pointer items-center justify-center rounded-xl border border-black/[0.08] bg-white px-4 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleInputChange}
                      className="hidden"
                    />
                    Replace PDF
                  </label>

                  <button
                    type="button"
                    onClick={resetOrder}
                    disabled={!hasOrderChanged}
                    className="flex h-10 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-4 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reset order
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-black/[0.06] bg-white/50 p-4 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900">
                      Arrange pages
                    </h2>

                    <p className="mt-1 text-xs text-neutral-400">
                      Drag any page and drop it where you want.
                    </p>
                  </div>

                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">
                    {pages.length} pages
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {pages.map((page, index) => (
                    <div
                      key={page.originalPageNumber}
                      draggable
                      onDragStart={(event) =>
                        handleDragStart(event, index)
                      }
                      onDragOver={handleDragOver}
                      onDrop={(event) =>
                        handleDrop(event, index)
                      }
                      onDragEnd={handleDragEnd}
                      className={`group cursor-grab overflow-hidden rounded-2xl border bg-white transition-all active:cursor-grabbing ${
                        draggedIndex === index
                          ? "scale-[0.97] border-neutral-400 opacity-50"
                          : "border-black/[0.08] hover:-translate-y-0.5 hover:border-black/[0.14] hover:shadow-lg hover:shadow-black/[0.04]"
                      }`}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
                        <img
                          src={page.image}
                          alt={`Page ${page.originalPageNumber}`}
                          className="h-full w-full object-cover"
                        />

                        <div className="absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-lg bg-black/70 px-2 text-[10px] font-semibold text-white backdrop-blur-md">
                          {index + 1}
                        </div>

                        <div className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-[9px] font-medium text-neutral-500 shadow-sm backdrop-blur-md">
                          Original {page.originalPageNumber}
                        </div>

                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/50 to-transparent px-3 pb-3 pt-10 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="text-[10px] font-medium text-white">
                            Drag to move
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] p-3">
                        <div>
                          <p className="text-xs font-semibold text-neutral-800">
                            Page {index + 1}
                          </p>

                          <p className="mt-0.5 text-[10px] text-neutral-400">
                            Originally {page.originalPageNumber}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPreviewPage(page)}
                          className="flex h-9 items-center justify-center rounded-lg border border-black/[0.08] bg-white px-3 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-black/[0.06] bg-white/70 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    Ready to create your PDF?
                  </p>

                  <p className="mt-1 text-xs text-neutral-400">
                    {hasOrderChanged
                      ? "Your page order has been changed."
                      : "You have not changed the page order yet."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={createReorderedPdf}
                  disabled={processing || !hasOrderChanged}
                  className="flex h-11 items-center justify-center rounded-xl bg-neutral-950 px-6 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {processing
                    ? "Creating PDF..."
                    : "Create Reordered PDF"}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 backdrop-blur-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Your reordered PDF is ready
                  </p>

                  <p className="mt-1 text-xs text-emerald-700">
                    {pages.length} pages arranged in your selected order.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={downloadResult}
                  className="flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {previewPage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setPreviewPage(null)}
        >
          <div
            className="relative max-h-[95vh] max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={previewPage.image}
              alt={`Page ${previewPage.originalPageNumber}`}
              className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            />

            <button
              type="button"
              onClick={() => setPreviewPage(null)}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl text-white backdrop-blur-md transition hover:bg-black/80"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </main>
  );
}