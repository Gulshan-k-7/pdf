
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_DIMENSION = 12000;
const MAX_PIXELS = 40000000;
const MAX_OUTPUT_SIZE = 100 * 1024 * 1024;

const FORMATS: {
  value: OutputFormat;
  label: string;
  description: string;
  extension: string;
}[] = [
  {
    value: "image/jpeg",
    label: "JPG",
    description: "Small files, ideal for photographs",
    extension: "jpg",
  },
  {
    value: "image/png",
    label: "PNG",
    description: "Lossless quality, supports transparency",
    extension: "png",
  },
  {
    value: "image/webp",
    label: "WebP",
    description: "Modern format for websites",
    extension: "webp",
  },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getOutputName(name: string, format: OutputFormat) {
  const base = name.replace(/\.[^.]+$/, "");
  const extension = FORMATS.find(
    (item) => item.value === format
  )?.extension ?? "jpg";

  return `${base}-converted.${extension}`;
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
          reject(new Error("Could not convert this image."));
          return;
        }

        // Do not silently download PNG if another format was requested.
        if (blob.type !== format) {
          reject(
            new Error(
              `Your browser could not export ${format.split("/")[1].toUpperCase()} format. Try another format.`
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

export default function ConvertImagePage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [convertedUrl, setConvertedUrl] = useState("");
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);

  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);

  const [format, setFormat] = useState<OutputFormat>("image/webp");
  const [quality, setQuality] = useState(85);
  const [keepDimensions, setKeepDimensions] = useState(true);
  const [maxDimension, setMaxDimension] = useState("2500");

  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  useEffect(() => {
    return () => {
      if (convertedUrl) URL.revokeObjectURL(convertedUrl);
    };
  }, [convertedUrl]);

  function clearResult() {
    setConvertedBlob(null);
    setConvertedUrl("");
    setError("");
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    clearResult();

    if (!selected.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      event.target.value = "";
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setError("The maximum upload size is 50 MB.");
      event.target.value = "";
      return;
    }

    try {
      const bitmap = await createImageBitmap(selected);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();

      setFile(selected);
      setOriginalWidth(width);
      setOriginalHeight(height);
      setOriginalUrl(URL.createObjectURL(selected));
      setError("");
    } catch {
      setError("Could not open this image. Please try another file.");
    }
  }

  async function handleConvert() {
    if (!file) {
      setError("Please upload an image first.");
      return;
    }

    if (
      !keepDimensions &&
      (!Number.isInteger(Number(maxDimension)) ||
        Number(maxDimension) < 1 ||
        Number(maxDimension) > MAX_DIMENSION)
    ) {
      setError("Enter a maximum dimension between 1 and 12,000 pixels.");
      return;
    }

    setIsConverting(true);
    clearResult();

    let bitmap: ImageBitmap | null = null;
    let canvas: HTMLCanvasElement | null = null;

    try {
      bitmap = await createImageBitmap(file);

      let width = bitmap.width;
      let height = bitmap.height;

      if (!keepDimensions) {
        const limit = Number(maxDimension);
        const scale = Math.min(
          1,
          limit / Math.max(width, height)
        );

        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        throw new Error(
          "Image dimensions exceed 12,000 pixels. Enable resizing and choose a smaller dimension."
        );
      }

      if (width * height > MAX_PIXELS) {
        throw new Error(
          "This image is too large to process at its current dimensions. Enable resizing and choose a smaller dimension."
        );
      }

      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Your browser could not process this image.");
      }

      // JPG has no transparency. Composite transparent pixels onto white.
      if (format === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await canvasToBlob(
        canvas,
        format,
        quality / 100
      );

      if (blob.size > MAX_OUTPUT_SIZE) {
        throw new Error(
          "The converted image exceeds 100 MB. Enable resizing and choose smaller dimensions."
        );
      }

      setConvertedBlob(blob);
      setConvertedUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Conversion failed. Please try another image."
      );
    } finally {
      bitmap?.close();

      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }

      setIsConverting(false);
    }
  }

  const sizeDifference =
    file && convertedBlob
      ? file.size - convertedBlob.size
      : 0;

  const sizeChangePercent =
    file && convertedBlob && file.size > 0
      ? (sizeDifference / file.size) * 100
      : 0;

  const selectedFormat = FORMATS.find(
    (item) => item.value === format
  )!;

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
            Convert Image Format
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Convert JPG, PNG, and WebP images in seconds. Choose
            your format, control image quality, and download your
            converted file.
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
                🔄
              </span>

              <span className="text-lg font-semibold">
                Upload your image
              </span>

              <span className="mt-2 text-sm text-slate-500">
                JPG, PNG, WebP and other browser-supported images
              </span>

              <span className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                Choose image
              </span>

              <span className="mt-3 text-xs text-slate-400">
                Maximum file size: 50 MB
              </span>
            </button>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">
                    Original image
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatSize(file.size)}
                  </span>
                </div>

                <img
                  src={originalUrl}
                  alt="Original image preview"
                  className="max-h-80 w-full rounded-xl object-contain"
                />

                <p className="mt-3 text-sm text-slate-600">
                  {originalWidth} × {originalHeight} px
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
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

              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <h2 className="text-base font-semibold">
                  Conversion settings
                </h2>

                <label className="mb-3 mt-5 block text-sm font-medium text-slate-700">
                  Convert to
                </label>

                <div className="space-y-3">
                  {FORMATS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setFormat(item.value);
                        clearResult();
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${
                        format === item.value
                          ? "border-emerald-400 bg-emerald-50/70"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          format === item.value
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {format === item.value ? (
                          <span className="text-xs">✓</span>
                        ) : null}
                      </span>

                      <span>
                        <span className="block text-sm font-semibold">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {item.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                {format !== "image/png" && (
                  <>
                    <div className="mb-2 mt-6 flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">
                        Output quality
                      </label>
                      <span className="text-sm font-semibold text-emerald-700">
                        {quality}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={quality}
                      onChange={(event) => {
                        setQuality(Number(event.target.value));
                        clearResult();
                      }}
                      className="w-full accent-emerald-600"
                    />

                    <div className="mt-1 flex justify-between text-xs text-slate-400">
                      <span>Smaller file</span>
                      <span>Higher quality</span>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setKeepDimensions(!keepDimensions);
                    clearResult();
                  }}
                  aria-pressed={!keepDimensions}
                  className={`mt-6 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                    !keepDimensions
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span>Resize while converting</span>
                  <span className="font-semibold">
                    {!keepDimensions ? "On" : "Off"}
                  </span>
                </button>

                {!keepDimensions && (
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Maximum width or height (px)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={MAX_DIMENSION}
                      value={maxDimension}
                      onChange={(event) => {
                        setMaxDimension(event.target.value);
                        clearResult();
                      }}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-400"
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Preserves the image proportions and never enlarges
                      the original.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isConverting}
                  onClick={handleConvert}
                  className="mt-6 flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isConverting
                    ? "Converting…"
                    : `Convert to ${selectedFormat.label}`}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {convertedBlob && convertedUrl && file && (
            <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold">
                    Image converted successfully!
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {originalWidth} × {originalHeight} px
                    {!keepDimensions && (
                      <span>
                        {" "}· resized to fit {maxDimension} px
                      </span>
                    )}
                  </p>
                </div>

                <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  {selectedFormat.label}
                </span>
              </div>

              <div className="mt-5 rounded-xl bg-white p-4">
                <img
                  src={convertedUrl}
                  alt="Converted image preview"
                  className="mx-auto max-h-96 rounded-lg object-contain"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">Original size</p>
                  <p className="mt-2 text-lg font-bold">
                    {formatSize(file.size)}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">Converted size</p>
                  <p className="mt-2 text-lg font-bold text-emerald-700">
                    {formatSize(convertedBlob.size)}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">Size change</p>
                  <p className="mt-2 text-lg font-bold">
                    {sizeDifference >= 0
                      ? `${sizeChangePercent.toFixed(1)}% smaller`
                      : `${Math.abs(sizeChangePercent).toFixed(1)}% larger`}
                  </p>
                </div>
              </div>

              <a
                href={convertedUrl}
                download={getOutputName(file.name, format)}
                className="mt-5 flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                ↓ Download converted image
              </a>

              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                Converting formats can change file size and image quality.
                PNG preserves transparency; converting transparent images
                to JPG adds a white background.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-white bg-white/70 p-6">
          <h2 className="font-semibold">Explore more tools</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/resize-image"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              Resize Image →
            </Link>

            <Link
              href="/compress-image"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              Compress Image →
            </Link>

            <Link
              href="/jpg-to-pdf"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              JPG to PDF →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
