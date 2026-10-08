"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type CompressionMode = "fast" | "target";



// const targetSizes = [
//   { label: "500 KB", value: 500 },
//   { label: "1 MB", value: 1024 },
//   { label: "2 MB", value: 2048 },
//   { label: "5 MB", value: 5120 },
//   { label: "10 MB", value: 10240 },
// ];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function fastCompress(file: File) {
  const arrayBuffer = await file.arrayBuffer();

  const pdfDoc = await PDFDocument.load(arrayBuffer, {
    ignoreEncryption: false,
  });

  pdfDoc.setTitle("");
  pdfDoc.setAuthor("");
  pdfDoc.setSubject("");
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer("PaperKit");
  pdfDoc.setCreator("PaperKit");

  const compressedPdf = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  });

  return new Blob([Uint8Array.from(compressedPdf).buffer as ArrayBuffer], {
    type: "application/pdf",
  });
}

async function renderPageToJpeg(
  page: pdfjsLib.PDFPageProxy,
  scale: number,
  quality: number,
) {
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: false,
  });

  if (!context) {
    throw new Error("Could not create canvas.");
  }

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    background: "white",
  }).promise;

  const dataUrl = canvas.toDataURL("image/jpeg", quality);

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
  };
}

async function buildTargetPdf(
  file: File,
  targetBytes: number,
  onProgress: (value: number) => void,
) {
  const arrayBuffer = await file.arrayBuffer();

  const sourcePdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    disableAutoFetch: false,
    disableStream: false,
  }).promise;

  const pageCount = sourcePdf.numPages;

  let scale = 1.35;
  let quality = 0.65;

  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const outputPdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      compress: true,
    });

    for (let i = 1; i <= pageCount; i++) {
      const page = await sourcePdf.getPage(i);

      const rendered = await renderPageToJpeg(
        page,
        scale,
        quality,
      );

      const orientation =
        rendered.width > rendered.height ? "landscape" : "portrait";

      const pageWidth = orientation === "landscape" ? 841.89 : 595.28;
      const pageHeight = orientation === "landscape" ? 595.28 : 841.89;

      if (i !== 1) {
        outputPdf.addPage(
          [pageWidth, pageHeight],
          orientation,
        );
      }

      const ratio = Math.min(
        pageWidth / rendered.width,
        pageHeight / rendered.height,
      );

      const width = rendered.width * ratio;
      const height = rendered.height * ratio;

      const x = (pageWidth - width) / 2;
      const y = (pageHeight - height) / 2;

      outputPdf.addImage(
        rendered.dataUrl,
        "JPEG",
        x,
        y,
        width,
        height,
        undefined,
        "FAST",
      );

      onProgress(
        Math.round(
          ((attempt * pageCount + i) /
            (5 * pageCount)) *
          100,
        ),
      );

      page.cleanup();
    }

    const output = outputPdf.output("blob");

    if (!bestBlob || output.size < bestBlob.size) {
      bestBlob = output;
    }

    if (output.size <= targetBytes) {
      break;
    }

    if (attempt === 0) {
      quality = 0.5;
    } else if (attempt === 1) {
      quality = 0.38;
    } else if (attempt === 2) {
      quality = 0.28;
    } else {
      quality = 0.2;
      scale *= 0.85;
    }
  }

  if (!bestBlob) {
    throw new Error("Could not compress PDF.");
  }

  return bestBlob;
}

export default function CompressPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<CompressionMode>("fast");
  const [targetSizeValue, setTargetSizeValue] = useState("1");
  const [targetSizeUnit, setTargetSizeUnit] = useState<"KB" | "MB">("MB");

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState("");

  const handleFile = (selectedFile: File) => {
    setError("");
    setResult(null);

    if (selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file.");
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError("Maximum file size is 50 MB.");
      return;
    }

    setFile(selectedFile);
  };

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      handleFile(selectedFile);
    }
  };
  const targetSizeInKB =
    Number(targetSizeValue) *
    (targetSizeUnit === "MB" ? 1024 : 1);

  const compressPdf = async () => {
    if (!file) return;
    if (mode === "target") {
      const size = Number(targetSizeValue);

      if (!size || size <= 0) {
        setError("Please enter a valid target size.");
        return;
      }

      if (targetSizeUnit === "KB" && size < 100) {
        setError("Target size must be at least 100 KB.");
        return;
      }
    }

    try {
      setProcessing(true);
      setProgress(0);
      setError("");
      setResult(null);

      let compressed: Blob;

      if (mode === "fast") {
        setProgress(20);

        compressed = await fastCompress(file);

        setProgress(100);
      } else {
        compressed = await buildTargetPdf(
          file,
          targetSizeInKB * 1024,
          setProgress,
        );
      }

      setResult(compressed);
    } catch (err) {
      console.error(err);
      setError(
        "Something went wrong while compressing this PDF.",
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
    link.download = `paperkit-compressed-${file?.name ?? "file.pdf"}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
    setProgress(0);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const reduction =
    file && result
      ? Math.max(
        0,
        Math.round(
          ((file.size - result.size) / file.size) * 100,
        ),
      )
      : 0;

  return (
    <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          PDF TOOL
        </p>

        <h1 className="text-4xl font-semibold tracking-[-0.055em] text-neutral-950 sm:text-5xl">
          Compress PDF
        </h1>

        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 tracking-[-0.01em] text-neutral-500 sm:text-base">
          Reduce your PDF file size without uploading it to a
          server. Fast, private and simple.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-2xl">
        {!file && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-black/[0.1] bg-white/60 px-6 py-12 text-center shadow-sm shadow-black/[0.02] backdrop-blur-xl transition-all duration-200 hover:border-black/[0.18] hover:bg-white"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-semibold text-emerald-600">
              PDF
            </div>

            <strong className="text-base font-semibold tracking-[-0.02em] text-neutral-900">
              Drop your PDF here
            </strong>

            <span className="mt-2 text-sm text-neutral-400">
              or choose a file from your device
            </span>

            <span className="mt-7 inline-flex h-11 items-center rounded-xl bg-neutral-950 px-6 text-sm font-medium text-white">
              Choose PDF
            </span>

            <small className="mt-4 text-[11px] tracking-[0.02em] text-neutral-400">
              PDF files up to 50 MB
            </small>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        {file && !result && (
          <div className="rounded-3xl border border-black/[0.06] bg-white/70 p-5 shadow-sm shadow-black/[0.03] backdrop-blur-xl sm:p-6">
            <div className="flex items-center gap-4 rounded-2xl bg-neutral-50 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[11px] font-semibold text-emerald-600">
                PDF
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {file.name}
                </p>

                <p className="mt-1 text-xs text-neutral-400">
                  {formatBytes(file.size)}
                </p>
              </div>

              <button
                onClick={reset}
                className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-900"
              >
                Remove
              </button>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold tracking-[-0.01em] text-neutral-900">
                Compression level
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("fast")}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${mode === "fast"
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-black/[0.07] bg-white text-neutral-600 hover:border-black/[0.15]"
                    }`}
                >
                  <span className="block text-sm font-medium">
                    Fastest
                  </span>

                  <span
                    className={`mt-1 block text-[11px] ${mode === "fast"
                      ? "text-white/60"
                      : "text-neutral-400"
                      }`}
                  >
                    Quick optimization
                  </span>
                </button>

                <button
                  onClick={() => setMode("target")}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${mode === "target"
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-black/[0.07] bg-white text-neutral-600 hover:border-black/[0.15]"
                    }`}
                >
                  <span className="block text-sm font-medium">
                    Specific size
                  </span>

                  <span
                    className={`mt-1 block text-[11px] ${mode === "target"
                      ? "text-white/60"
                      : "text-neutral-400"
                      }`}
                  >
                    Aim for a file size
                  </span>
                </button>
              </div>
            </div>

            {mode === "target" && (
              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold tracking-[-0.01em] text-neutral-900">
                  Target file size
                </p>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={targetSizeValue}
                    onChange={(e) => setTargetSizeValue(e.target.value)}
                    placeholder="Enter size"
                    className="h-12 min-w-0 flex-1 rounded-xl border border-black/[0.08] bg-white px-4 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-950"
                  />

                  <select
                    value={targetSizeUnit}
                    onChange={(e) =>
                      setTargetSizeUnit(e.target.value as "KB" | "MB")
                    }
                    className="h-12 w-24 rounded-xl border border-black/[0.08] bg-white px-3 text-sm font-medium text-neutral-700 outline-none transition-all focus:border-neutral-950"
                  >
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                  </select>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                {error}
              </div>
            )}

            {processing && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>
                    {mode === "target"
                      ? "Compressing PDF..."
                      : "Optimizing PDF..."}
                  </span>

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
              onClick={compressPdf}
              disabled={processing}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-neutral-950 text-sm font-medium text-white transition-all duration-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {processing
                ? "Compressing..."
                : mode === "target"
                  ? `Compress to ${targetSizeValue || "0"} ${targetSizeUnit}`
                  : "Compress PDF"}
            </button>

            <p className="mt-4 text-center text-[11px] leading-5 text-neutral-400">
              Your file stays in your browser and is not uploaded.
            </p>
          </div>
        )}

        {result && file && (
          <div className="rounded-3xl border border-black/[0.06] bg-white/70 p-6 text-center shadow-sm shadow-black/[0.03] backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-600">
              ✓
            </div>

            <h2 className="mt-5 text-xl font-semibold tracking-[-0.035em] text-neutral-950">
              PDF compressed
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              Your compressed file is ready to download.
            </p>

            <div className="mx-auto mt-7 grid max-w-md grid-cols-3 gap-2">
              <div className="rounded-xl bg-neutral-50 px-3 py-4">
                <span className="block text-[10px] uppercase tracking-[0.08em] text-neutral-400">
                  Original
                </span>

                <strong className="mt-1 block text-sm font-semibold text-neutral-900">
                  {formatBytes(file.size)}
                </strong>
              </div>

              <div className="rounded-xl bg-neutral-50 px-3 py-4">
                <span className="block text-[10px] uppercase tracking-[0.08em] text-neutral-400">
                  New size
                </span>

                <strong className="mt-1 block text-sm font-semibold text-neutral-900">
                  {formatBytes(result.size)}
                </strong>
              </div>

              <div className="rounded-xl bg-emerald-50 px-3 py-4">
                <span className="block text-[10px] uppercase tracking-[0.08em] text-emerald-600">
                  Reduced
                </span>

                <strong className="mt-1 block text-sm font-semibold text-emerald-700">
                  {reduction}%
                </strong>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={downloadPdf}
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-neutral-950 text-sm font-medium text-white transition-all hover:bg-neutral-800"
              >
                Download PDF
              </button>

              <button
                onClick={reset}
                className="flex h-12 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-6 text-sm font-medium text-neutral-700 transition-all hover:border-black/[0.15] hover:bg-neutral-50"
              >
                Compress another
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

          <Link
            href="/tools/split-pdf"
            className="group rounded-2xl border border-black/[0.06] bg-white/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              /
            </div>

            <h3 className="mt-4 text-sm font-semibold text-neutral-900">
              Split PDF
            </h3>

            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Extract pages from a PDF into separate files.
            </p>
          </Link>

          <Link
            href="/tools/jpg-to-pdf"
            className="group rounded-2xl border border-black/[0.06] bg-white/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              JPG
            </div>

            <h3 className="mt-4 text-sm font-semibold text-neutral-900">
              JPG to PDF
            </h3>

            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Convert images into a shareable PDF.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
