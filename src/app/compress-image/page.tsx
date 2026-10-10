
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type OutputFormat = "image/jpeg" | "image/webp";

type CompressionResult = {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MIN_TARGET_KB = 100;
const MAX_TARGET_KB = 50 * 1024;

const DIMENSION_OPTIONS = [
  { label: "Original dimensions", value: 6000 },
  { label: "4000 px", value: 4000 },
  { label: "2500 px", value: 2500 },
  { label: "1600 px", value: 1600 },
  { label: "1200 px", value: 1200 },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function makeJpegName(name: string, format: OutputFormat) {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}-compressed.${format === "image/webp" ? "webp" : "jpg"}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress this image."));
          return;
        }

        // Some browsers may fall back to PNG when WebP isn't supported.
        if (blob.type !== format) {
          reject(
            new Error(
              `${format === "image/webp" ? "WebP" : "JPEG"} output is not supported by this browser. Try the other format.`
            )
          );
          return;
        }

        resolve(blob);
      },
      format,
      quality
    );
  });
}

async function renderAtSize(
  bitmap: ImageBitmap,
  maxDimension: number,
  format: OutputFormat,
  quality: number
): Promise<CompressionResult> {
  const scale = Math.min(
    1,
    maxDimension / Math.max(bitmap.width, bitmap.height)
  );

  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Your browser could not process this image.");
  }

  // JPEG does not support transparency, so use a white background.
  if (format === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);

  try {
    const blob = await canvasToBlob(canvas, format, quality);
    return { blob, width, height, quality };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Finds the largest encoded file that does not exceed the target.
 * It searches quality first and reduces dimensions only if needed.
 */
async function compressToTarget(
  bitmap: ImageBitmap,
  targetBytes: number,
  maxDimension: number,
  format: OutputFormat,
  onProgress: (progress: number) => void
): Promise<CompressionResult> {
  const startingDimension = Math.min(
    maxDimension,
    Math.max(bitmap.width, bitmap.height)
  );

  // Never upscale. Only try smaller dimensions if quality alone
  // cannot bring the image under the target.
  const dimensionAttempts = [
    startingDimension,
    Math.round(startingDimension * 0.9),
    Math.round(startingDimension * 0.8),
    Math.round(startingDimension * 0.7),
    Math.round(startingDimension * 0.6),
    Math.round(startingDimension * 0.5),
    Math.round(startingDimension * 0.4),
  ].filter((value, index, array) => value > 0 && array.indexOf(value) === index);

  let bestResult: CompressionResult | null = null;
  let smallestResult: CompressionResult | null = null;

  for (let attempt = 0; attempt < dimensionAttempts.length; attempt++) {
    const dimension = dimensionAttempts[attempt];

    onProgress(Math.min(15 + attempt * 8, 55));

    // Test the maximum quality at this dimension first.
    const maximumQualityResult = await renderAtSize(
      bitmap,
      dimension,
      format,
      0.98
    );

    if (
      !smallestResult ||
      maximumQualityResult.blob.size < smallestResult.blob.size
    ) {
      smallestResult = maximumQualityResult;
    }

    if (maximumQualityResult.blob.size <= targetBytes) {
      // Binary search for the highest quality that stays under target.
      let low = 0.1;
      let high = 0.98;
      let localBest: CompressionResult | null = null;

      // A low-quality image may still be over target, so test it.
      const minimumQualityResult = await renderAtSize(
        bitmap,
        dimension,
        format,
        low
      );

      if (minimumQualityResult.blob.size <= targetBytes) {
        localBest = minimumQualityResult;
      }

      if (
        !smallestResult ||
        minimumQualityResult.blob.size < smallestResult.blob.size
      ) {
        smallestResult = minimumQualityResult;
      }

      for (let step = 0; step < 12; step++) {
        const quality = (low + high) / 2;

        onProgress(Math.min(60 + attempt * 5 + step, 95));

        const result = await renderAtSize(
          bitmap,
          dimension,
          format,
          quality
        );

        if (result.blob.size <= targetBytes) {
          // Keep the biggest file that fits, not the smallest file.
          if (
            !localBest ||
            result.blob.size > localBest.blob.size
          ) {
            localBest = result;
          }

          low = quality;
        } else {
          high = quality;
        }
      }

      // Also consider the maximum-quality result.
      if (
        !localBest ||
        maximumQualityResult.blob.size > localBest.blob.size
      ) {
        localBest = maximumQualityResult;
      }

      if (
        !bestResult ||
        localBest.blob.size > bestResult.blob.size
      ) {
        bestResult = localBest;
      }

      // If the maximum dimensions already fit, don't degrade them.
      break;
    }

    // If even maximum compression is too large, try smaller dimensions.
  }

  onProgress(100);

  if (bestResult) {
    return bestResult;
  }

  if (smallestResult) {
    throw new Error(
      `Could not reach ${formatSize(targetBytes)} without excessive quality loss. The smallest result was ${formatSize(smallestResult.blob.size)}. Try a larger target size.`
    );
  }

  throw new Error("Could not compress this image.");
}

export default function CompressImagePage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [targetSize, setTargetSize] = useState("300");
  const [unit, setUnit] = useState<"KB" | "MB">("KB");
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [maxDimension, setMaxDimension] = useState(6000);

  const [originalUrl, setOriginalUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  function clearResult() {
    setResult(null);
    setError("");
    setProgress(0);
    setResultUrl("");
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    clearResult();

    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("The maximum upload size is 50 MB.");
      return;
    }

    setFile(selectedFile);
    setOriginalUrl(URL.createObjectURL(selectedFile));
    setError("");
  }

  async function handleCompress() {
    if (!file) {
      setError("Please upload an image first.");
      return;
    }

    const numericTarget = Number(targetSize);

    if (!Number.isFinite(numericTarget) || numericTarget <= 0) {
      setError("Enter a valid target file size.");
      return;
    }

    const targetBytes =
      numericTarget * (unit === "KB" ? 1024 : 1024 * 1024);

    if (targetBytes < MIN_TARGET_KB * 1024) {
      setError("The minimum target size is 100 KB.");
      return;
    }

    if (targetBytes > MAX_TARGET_KB * 1024 * 1024) {
      setError("The maximum target size is 50 MB.");
      return;
    }

    setIsCompressing(true);
    setProgress(0);
    setError("");
    setResult(null);
    setResultUrl("");

    let bitmap: ImageBitmap | null = null;

    try {
      bitmap = await createImageBitmap(file);

      const compressed = await compressToTarget(
        bitmap,
        targetBytes,
        maxDimension,
        format,
        setProgress
      );

      setResult(compressed);
      setResultUrl(URL.createObjectURL(compressed.blob));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Compression failed. Please try another image."
      );
    } finally {
      bitmap?.close();
      setIsCompressing(false);
    }
  }

  const savedBytes = result
    ? Math.max(0, file!.size - result.blob.size)
    : 0;

  const savedPercent =
    file && result
      ? Math.max(0, (savedBytes / file.size) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-12 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/image"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"
        >
          <span aria-hidden="true">←</span> All image tools
        </Link>

        <header className="mb-10 text-center">
          <div className="mb-4 inline-flex rounded-full border border-emerald-100 bg-white/80 px-4 py-2 text-xs font-semibold tracking-wide text-emerald-700 shadow-sm">
            PAPERKIT · IMAGE TOOLS
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Compress Image
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Reduce image file size with control over the target size,
            image quality, and dimensions. Your image is processed in
            your browser.
          </p>
        </header>

        <section className="rounded-3xl border border-white bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-8">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center transition hover:border-emerald-300 hover:bg-emerald-50/30"
            >
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                🖼️
              </span>
              <span className="text-lg font-semibold">
                Upload your image
              </span>
              <span className="mt-2 text-sm text-slate-500">
                Click to browse · Maximum file size 50 MB
              </span>
              <span className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                Choose image
              </span>
            </button>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Original image</span>
                  <span className="text-xs text-slate-500">
                    {formatSize(file.size)}
                  </span>
                </div>

                {originalUrl && (
                  <img
                    src={originalUrl}
                    alt="Original image preview"
                    className="max-h-72 w-full rounded-xl object-contain"
                  />
                )}

                <p className="mt-3 truncate text-xs text-slate-500">
                  {file.name}
                </p>

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-4 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Choose another image
                </button>
              </div>

              <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-5">
                <h2 className="text-base font-semibold">
                  Compression settings
                </h2>

                <label className="mb-2 mt-5 text-sm font-medium text-slate-700">
                  Target file size
                </label>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="100"
                    value={targetSize}
                    onChange={(event) => setTargetSize(event.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  />

                  <select
                    value={unit}
                    onChange={(event) =>
                      setUnit(event.target.value as "KB" | "MB")
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-emerald-400"
                  >
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                  </select>
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Minimum 100 KB. The result aims to stay at or below
                  your target.
                </p>

                <label className="mb-2 mt-5 text-sm font-medium text-slate-700">
                  Output format
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["image/jpeg", "JPEG"],
                      ["image/webp", "WebP"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setFormat(value);
                        clearResult();
                      }}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        format === value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="mb-2 mt-5 text-sm font-medium text-slate-700">
                  Maximum image dimensions
                </label>

                <select
                  value={maxDimension}
                  onChange={(event) => {
                    setMaxDimension(Number(event.target.value));
                    clearResult();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-400"
                >
                  {DIMENSION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={isCompressing}
                  onClick={handleCompress}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCompressing
                    ? `Compressing… ${progress}%`
                    : "Compress image"}
                </button>

                {isCompressing && (
                  <div
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
            >
              {error}
            </div>
          )}

          {result && resultUrl && file && (
            <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold">Compression complete!</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {result.width} × {result.height} px
                  </p>
                </div>
                <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  {savedPercent.toFixed(1)}% smaller
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">Original size</p>
                  <p className="mt-2 text-xl font-bold">
                    {formatSize(file.size)}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">Compressed size</p>
                  <p className="mt-2 text-xl font-bold text-emerald-700">
                    {formatSize(result.blob.size)}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">Space saved</p>
                  <p className="mt-2 text-xl font-bold">
                    {formatSize(savedBytes)}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-white p-4">
                <img
                  src={resultUrl}
                  alt="Compressed image preview"
                  className="mx-auto max-h-80 rounded-lg object-contain"
                />
              </div>

              {result.blob.size > Number(targetSize) *
                (unit === "KB" ? 1024 : 1024 * 1024) && (
                <p className="mt-4 text-sm text-amber-700">
                  The output exceeds the requested target. Try a larger
                  target size or smaller dimensions.
                </p>
              )}

              <a
                href={resultUrl}
                download={makeJpegName(file.name, format)}
                className="mt-5 flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                ↓ Download compressed image
              </a>

              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                The target is a maximum, not a guarantee of an exact
                file size. Simple images may naturally compress to
                considerably less.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-white bg-white/70 p-6">
          <h2 className="font-semibold">Explore more tools</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/jpg-to-pdf"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              JPG to PDF →
            </Link>
            <Link
              href="/image"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              All image tools →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
