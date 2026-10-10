"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

type PageThumbnail = {
  pageNumber: number;
  image: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getRotationLabel(rotation: number) {
  return `${rotation}°`;
}

export default function RotatePdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);

  const [pageCount, setPageCount] = useState(0);

  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);

  const [rotations, setRotations] = useState<number[]>([]);

  const [loadingPages, setLoadingPages] = useState(false);

  const [processing, setProcessing] = useState(false);

  const [progress, setProgress] = useState(0);

  const [result, setResult] = useState<Blob | null>(null);

  const [error, setError] = useState("");

  const generateThumbnails = async (
    selectedFile: File,
    currentRotations: number[],
  ) => {
    setLoadingPages(true);
    setError("");

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();

      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
      }).promise;

      const totalPages = pdf.numPages;

      setPageCount(totalPages);

      const generatedThumbnails: PageThumbnail[] = [];

      for (
        let pageNumber = 1;
        pageNumber <= totalPages;
        pageNumber++
      ) {
        const page = await pdf.getPage(pageNumber);

        const baseViewport = page.getViewport({
          scale: 0.65,
        });

        const rotation =
          currentRotations[pageNumber - 1] || 0;

        const viewport = page.getViewport({
          scale: 0.65,
          rotation,
        });

        const canvas = document.createElement("canvas");

        const context = canvas.getContext("2d");

        if (!context) {
          continue;
        }

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          background: "white",
        }).promise;

        const image = canvas.toDataURL(
          "image/jpeg",
          0.78,
        );

        generatedThumbnails.push({
          pageNumber,
          image,
        });

        page.cleanup();

        setProgress(
          Math.round((pageNumber / totalPages) * 100),
        );

        void baseViewport;
      }

      setThumbnails(generatedThumbnails);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to read this PDF. Please try another file.",
      );
    } finally {
      setLoadingPages(false);
      setProgress(0);
    }
  };

  const handleFile = async (selectedFile: File) => {
    setError("");
    setResult(null);
    setThumbnails([]);
    setPageCount(0);

    if (selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("Maximum file size is 50 MB.");
      return;
    }

    setFile(selectedFile);

    const arrayBuffer = await selectedFile.arrayBuffer();

    try {
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
      }).promise;

      const totalPages = pdf.numPages;

      const initialRotations = Array.from(
        { length: totalPages },
        () => 0,
      );

      setRotations(initialRotations);

      await generateThumbnails(
        selectedFile,
        initialRotations,
      );
    } catch (err) {
      console.error(err);

      setFile(null);

      setError(
        "Unable to read this PDF. Please try another file.",
      );
    }
  };

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const rotatePage = async (pageNumber: number) => {
    if (!file) return;

    const pageIndex = pageNumber - 1;

    const newRotations = [...rotations];

    newRotations[pageIndex] =
      (newRotations[pageIndex] + 90) % 360;

    setRotations(newRotations);

    await generateThumbnails(
      file,
      newRotations,
    );
  };

  const rotateAllPages = async () => {
    if (!file) return;

    const newRotations = rotations.map(
      (rotation) => (rotation + 90) % 360,
    );

    setRotations(newRotations);

    await generateThumbnails(
      file,
      newRotations,
    );
  };

  const resetRotations = async () => {
    if (!file) return;

    const newRotations = rotations.map(() => 0);

    setRotations(newRotations);

    await generateThumbnails(
      file,
      newRotations,
    );
  };

  const createRotatedPdf = async () => {
    if (!file) return;

    const hasRotation = rotations.some(
      (rotation) => rotation !== 0,
    );

    if (!hasRotation) {
      setError(
        "Rotate at least one page before creating the PDF.",
      );
      return;
    }

    try {
      setProcessing(true);
      setError("");

      const arrayBuffer = await file.arrayBuffer();

      const pdfDoc = await PDFDocument.load(
        arrayBuffer,
      );

      const pages = pdfDoc.getPages();

      pages.forEach((page, index) => {
        const originalRotation =
          page.getRotation().angle;

        const additionalRotation =
          rotations[index] || 0;

        const finalRotation =
          (originalRotation +
            additionalRotation) %
          360;

        page.setRotation(
          degrees(finalRotation),
        );
      });

      const pdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      const blob = new Blob([pdfBytes], {
        type: "application/pdf",
      });

      setResult(blob);
    } catch (err) {
      console.error(err);

      setError(
        "Something went wrong while creating the rotated PDF.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const downloadPdf = () => {
    if (!result) return;

    const url = URL.createObjectURL(result);

    const link = document.createElement("a");

    link.href = url;
    link.download = "paperkit-rotated.pdf";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setThumbnails([]);
    setRotations([]);
    setResult(null);
    setError("");
    setProgress(0);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          PDF TOOL
        </p>

        <h1 className="text-4xl font-semibold tracking-[-0.055em] text-neutral-950 sm:text-5xl">
          Rotate PDF
        </h1>

        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 tracking-[-0.01em] text-neutral-500 sm:text-base">
          Rotate individual pages or rotate your entire PDF
          with one click.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-5xl">
        {!file && (
          <>
            <button
              type="button"
              onClick={() =>
                inputRef.current?.click()
              }
              className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-black/[0.1] bg-white/60 px-6 py-12 text-center shadow-sm shadow-black/[0.02] backdrop-blur-xl transition-all duration-200 hover:border-black/[0.18] hover:bg-white"
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-2xl text-sky-600">
                ↻
              </div>

              <strong className="text-base font-semibold tracking-[-0.02em] text-neutral-900">
                Upload your PDF
              </strong>

              <span className="mt-2 text-sm text-neutral-400">
                Rotate any page you want
              </span>

              <span className="mt-7 inline-flex h-11 items-center rounded-xl bg-neutral-950 px-6 text-sm font-medium text-white">
                Choose PDF
              </span>

              <small className="mt-4 text-[11px] tracking-[0.02em] text-neutral-400">
                PDF files up to 50 MB
              </small>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              onChange={handleInputChange}
              className="hidden"
            />
          </>
        )}

        {file && !result && (
          <div className="rounded-3xl border border-black/[0.06] bg-white/70 p-5 shadow-sm shadow-black/[0.03] backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[11px] font-semibold text-sky-600">
                  PDF
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {file.name}
                  </p>

                  <p className="mt-1 text-xs text-neutral-400">
                    {formatBytes(file.size)} ·{" "}
                    {pageCount}{" "}
                    {pageCount === 1
                      ? "page"
                      : "pages"}
                  </p>
                </div>
              </div>

              <button
                onClick={reset}
                className="self-start text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-900 sm:self-auto"
              >
                Choose another
              </button>
            </div>

            {loadingPages && (
              <div className="mt-8">
                <div className="mb-2 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>
                    Preparing pages...
                  </span>

                  <span>
                    {progress}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-neutral-950 transition-all duration-200"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {!loadingPages &&
              thumbnails.length > 0 && (
                <>
                  <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold tracking-[-0.02em] text-neutral-900">
                        Rotate pages
                      </p>

                      <p className="mt-1 text-xs text-neutral-400">
                        Click the rotate button on any
                        page.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={rotateAllPages}
                        disabled={loadingPages}
                        className="rounded-xl border border-black/[0.07] bg-white px-4 py-2.5 text-xs font-medium text-neutral-600 transition-all hover:border-black/[0.15] hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ↻ Rotate all
                      </button>

                      <button
                        type="button"
                        onClick={resetRotations}
                        disabled={loadingPages}
                        className="rounded-xl border border-black/[0.07] bg-white px-4 py-2.5 text-xs font-medium text-neutral-600 transition-all hover:border-black/[0.15] hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                    {thumbnails.map((page) => {
                      const rotation =
                        rotations[
                          page.pageNumber - 1
                        ] || 0;

                      return (
                        <div
                          key={page.pageNumber}
                          className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white p-2 transition-all duration-200 hover:border-black/[0.14] hover:shadow-md hover:shadow-black/[0.04]"
                        >
                          <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
                            <img
                              src={page.image}
                              alt={`Page ${page.pageNumber}`}
                              className="h-full w-full object-contain"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 px-1 pb-1 pt-3">
                            <div className="min-w-0">
                              <span className="block truncate text-xs font-medium text-neutral-500">
                                Page{" "}
                                {page.pageNumber}
                              </span>

                              <span className="mt-0.5 block text-[10px] text-neutral-400">
                                {getRotationLabel(
                                  rotation,
                                )}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                rotatePage(
                                  page.pageNumber,
                                )
                              }
                              disabled={
                                loadingPages
                              }
                              aria-label={`Rotate page ${page.pageNumber}`}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-lg text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              ↻
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="sticky bottom-4 z-10 mt-8">
                    <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white/90 p-3 shadow-xl shadow-black/[0.08] backdrop-blur-xl sm:flex-row sm:items-center">
                      <div className="flex-1 px-2">
                        <p className="text-sm font-semibold text-neutral-900">
                          Ready to rotate
                        </p>

                        <p className="mt-1 text-[11px] text-neutral-400">
                          Your page rotations will be
                          applied to the downloaded PDF.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={createRotatedPdf}
                        disabled={processing}
                        className="flex h-12 items-center justify-center rounded-xl bg-neutral-950 px-7 text-sm font-medium text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {processing
                          ? "Creating PDF..."
                          : "Create rotated PDF"}
                      </button>
                    </div>
                  </div>
                </>
              )}

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <p className="mt-6 text-center text-[11px] leading-5 text-neutral-400">
              Your PDF stays in your browser and is not
              uploaded.
            </p>
          </div>
        )}

        {result && file && (
          <div className="mx-auto max-w-2xl rounded-3xl border border-black/[0.06] bg-white/70 p-6 text-center shadow-sm shadow-black/[0.03] backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-600">
              ✓
            </div>

            <h2 className="mt-5 text-xl font-semibold tracking-[-0.035em] text-neutral-950">
              PDF rotated successfully
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              Your rotated pages are ready to download.
            </p>

            <div className="mx-auto mt-7 grid max-w-md grid-cols-2 gap-2">
              <div className="rounded-xl bg-neutral-50 px-3 py-4">
                <span className="block text-[10px] uppercase tracking-[0.08em] text-neutral-400">
                  Pages
                </span>

                <strong className="mt-1 block text-sm font-semibold text-neutral-900">
                  {pageCount}
                </strong>
              </div>

              <div className="rounded-xl bg-neutral-50 px-3 py-4">
                <span className="block text-[10px] uppercase tracking-[0.08em] text-neutral-400">
                  File size
                </span>

                <strong className="mt-1 block text-sm font-semibold text-neutral-900">
                  {formatBytes(result.size)}
                </strong>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={downloadPdf}
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-neutral-950 text-sm font-medium text-white transition-all hover:bg-neutral-800"
              >
                Download PDF
              </button>

              <button
                type="button"
                onClick={reset}
                className="flex h-12 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-6 text-sm font-medium text-neutral-700 transition-all hover:border-black/[0.15] hover:bg-neutral-50"
              >
                Rotate another
              </button>
            </div>
          </div>
        )}
      </div>

      <section className="mx-auto mt-20 max-w-4xl">
        <div className="mb-6 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            YOU MAY ALSO NEED
          </p>

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-neutral-950">
            More PDF tools
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/tools/compress-pdf"
            className="group rounded-2xl border border-black/[0.06] bg-white/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              ↓
            </div>

            <h3 className="mt-4 text-sm font-semibold text-neutral-900">
              Compress PDF
            </h3>

            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Reduce the size of your PDF.
            </p>
          </Link>

          <Link
            href="/tools/split-pdf"
            className="group rounded-2xl border border-black/[0.06] bg-white/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              ✂
            </div>

            <h3 className="mt-4 text-sm font-semibold text-neutral-900">
              Split PDF
            </h3>

            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Extract the pages you need.
            </p>
          </Link>

          <Link
            href="/tools/merge-pdf"
            className="group rounded-2xl border border-black/[0.06] bg-white/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              +
            </div>

            <h3 className="mt-4 text-sm font-semibold text-neutral-900">
              Merge PDF
            </h3>

            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Combine multiple PDF files into one.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
