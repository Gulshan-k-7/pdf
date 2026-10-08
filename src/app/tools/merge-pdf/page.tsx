"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

type PdfFile = {
  id: string;
  file: File;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MergePdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<PdfFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState("");

  const addFile = (file: File) => {
    setError("");

    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Each PDF must be smaller than 50 MB.");
      return;
    }

    if (files.length >= MAX_FILES) {
      setError(`You can merge a maximum of ${MAX_FILES} PDFs.`);
      return;
    }

    const newFile: PdfFile = {
      id: `${Date.now()}-${Math.random()}`,
      file,
    };

    setFiles((current) => [...current, newFile]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      addFile(selectedFile);
    }
  };

  const removeFile = (id: string) => {
    setFiles((current) =>
      current.filter((item) => item.id !== id),
    );

    setResult(null);
    setError("");
  };

  const mergePdfs = async () => {
    if (files.length < 2) {
      setError("Please add at least 2 PDF files to merge.");
      return;
    }

    try {
      setProcessing(true);
      setProgress(0);
      setError("");
      setResult(null);

      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i].file;

        const arrayBuffer = await file.arrayBuffer();

        const sourcePdf = await PDFDocument.load(arrayBuffer);

        const pages = await mergedPdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices(),
        );

        pages.forEach((page) => {
          mergedPdf.addPage(page);
        });

        setProgress(
          Math.round(((i + 1) / files.length) * 100),
        );
      }

      const mergedBytes = await mergedPdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      const mergedBlob = new Blob([Uint8Array.from(mergedBytes).buffer as ArrayBuffer], {
        type: "application/pdf",
      });

      setResult(mergedBlob);
    } catch (err) {
      console.error(err);

      setError(
        "Something went wrong while merging the PDF files.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const downloadMergedPdf = () => {
    if (!result) return;

    const url = URL.createObjectURL(result);

    const link = document.createElement("a");

    link.href = url;
    link.download = "paperkit-merged.pdf";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFiles([]);
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
          Merge PDF
        </h1>

        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 tracking-[-0.01em] text-neutral-500 sm:text-base">
          Combine multiple PDF files into one document.
          Add up to 5 PDFs and merge them instantly.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-2xl">
        {!result && (
          <div className="rounded-3xl border border-black/[0.06] bg-white/70 p-5 shadow-sm shadow-black/[0.03] backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold tracking-[-0.02em] text-neutral-900">
                  Your PDF files
                </p>

                <p className="mt-1 text-xs text-neutral-400">
                  {files.length} of {MAX_FILES} files added
                </p>
              </div>

              {files.length > 0 && (
                <button
                  onClick={reset}
                  className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-900"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="space-y-2">
              {files.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-neutral-50 p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[10px] font-semibold text-violet-600">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {item.file.name}
                    </p>

                    <p className="mt-1 text-[11px] text-neutral-400">
                      {formatBytes(item.file.size)}
                    </p>
                  </div>

                  <button
                    onClick={() => removeFile(item.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white hover:text-neutral-900"
                    aria-label={`Remove ${item.file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {files.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/[0.1] bg-white/60 px-4 py-5 text-sm font-medium text-neutral-600 transition-all hover:border-black/[0.18] hover:bg-white"
              >
                <span className="text-lg">+</span>
                Add PDF
                {files.length > 0 && (
                  <span className="text-xs text-neutral-400">
                    · PDF {files.length + 1}
                  </span>
                )}
              </button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {files.length === 0 && (
              <div className="mt-4 flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.1] bg-neutral-50/60 px-6 text-center">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-sm font-semibold text-violet-600">
                  PDF
                </div>

                <strong className="text-sm font-semibold text-neutral-900">
                  Add your first PDF
                </strong>

                <span className="mt-2 text-xs text-neutral-400">
                  Then add more PDFs one by one
                </span>

                <button
                  onClick={() => inputRef.current?.click()}
                  className="mt-6 h-11 rounded-xl bg-neutral-950 px-6 text-sm font-medium text-white transition-all hover:bg-neutral-800"
                >
                  Choose PDF
                </button>
              </div>
            )}

            {files.length > 0 && (
              <div className="mt-5">
                {files.length === 1 && (
                  <p className="mb-4 text-center text-[11px] text-neutral-400">
                    Add at least one more PDF to merge.
                  </p>
                )}

                {error && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                    {error}
                  </div>
                )}

                {processing && (
                  <div className="mb-5">
                    <div className="mb-2 flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Merging PDFs...</span>
                      <span>{progress}%</span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-neutral-950 transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={mergePdfs}
                  disabled={files.length < 2 || processing}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-neutral-950 text-sm font-medium text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {processing
                    ? "Merging..."
                    : `Merge ${files.length} PDFs`}
                </button>
              </div>
            )}

            <p className="mt-5 text-center text-[11px] leading-5 text-neutral-400">
              Your files stay in your browser and are not uploaded.
            </p>
          </div>
        )}

        {result && (
          <div className="rounded-3xl border border-black/[0.06] bg-white/70 p-6 text-center shadow-sm shadow-black/[0.03] backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-600">
              ✓
            </div>

            <h2 className="mt-5 text-xl font-semibold tracking-[-0.035em] text-neutral-950">
              PDFs merged
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              {files.length} PDF files have been combined successfully.
            </p>

            <div className="mx-auto mt-7 max-w-sm rounded-2xl bg-neutral-50 px-5 py-4">
              <span className="block text-[10px] uppercase tracking-[0.08em] text-neutral-400">
                Merged file size
              </span>

              <strong className="mt-1 block text-lg font-semibold text-neutral-900">
                {formatBytes(result.size)}
              </strong>
            </div>

            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={downloadMergedPdf}
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-neutral-950 text-sm font-medium text-white transition-all hover:bg-neutral-800"
              >
                Download PDF
              </button>

              <button
                onClick={reset}
                className="flex h-12 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-6 text-sm font-medium text-neutral-700 transition-all hover:border-black/[0.15] hover:bg-neutral-50"
              >
                Merge more
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
            More PDF & image tools
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
              Reduce the size of your PDF for easier sharing.
            </p>
          </Link>

          <Link
            href="/tools/jpg-to-pdf"
            className="group rounded-2xl border border-black/[0.06] bg-white/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[10px] font-semibold text-sky-600">
              JPG
            </div>

            <h3 className="mt-4 text-sm font-semibold text-neutral-900">
              JPG to PDF
            </h3>

            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Turn multiple images into a PDF document.
            </p>
          </Link>

          <Link
            href="/tools/pdf-to-jpg"
            className="group rounded-2xl border border-black/[0.06] bg-white/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[10px] font-semibold text-orange-600">
              IMG
            </div>

            <h3 className="mt-4 text-sm font-semibold text-neutral-900">
              PDF to JPG
            </h3>

            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Convert PDF pages into high-quality JPG images.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
