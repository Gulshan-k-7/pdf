
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_DIMENSION = 12000;
const MAX_OUTPUT_SIZE = 100 * 1024 * 1024;

const PRESETS = [
  { label: "Custom size", width: 0, height: 0 },
  { label: "HD · 1280 × 720", width: 1280, height: 720 },
  { label: "Full HD · 1920 × 1080", width: 1920, height: 1080 },
  { label: "Instagram square · 1080 × 1080", width: 1080, height: 1080 },
  { label: "Instagram portrait · 1080 × 1350", width: 1080, height: 1350 },
  { label: "Story · 1080 × 1920", width: 1080, height: 1920 },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getExtension(format: OutputFormat) {
  if (format === "image/jpeg") return "jpg";
  if (format === "image/webp") return "webp";
  return "png";
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
          reject(new Error("Could not create the resized image."));
          return;
        }

        if (blob.type !== format) {
          reject(
            new Error(
              `Your browser does not support ${format.split("/")[1].toUpperCase()} output. Please select another format.`
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

export default function ResizeImagePage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);

  const [width, setWidth] = useState("1080");
  const [height, setHeight] = useState("1080");
  const [lockRatio, setLockRatio] = useState(true);
  const [preset, setPreset] = useState("custom");

  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = useState(90);

  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  function clearResult() {
    setResultBlob(null);
    setResultUrl("");
    setError("");
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    clearResult();

    if (!selected.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setError("The maximum upload size is 50 MB.");
      return;
    }

    try {
      const bitmap = await createImageBitmap(selected);
      const imageWidth = bitmap.width;
      const imageHeight = bitmap.height;
      bitmap.close();

      setFile(selected);
      setOriginalWidth(imageWidth);
      setOriginalHeight(imageHeight);
      setWidth(String(imageWidth));
      setHeight(String(imageHeight));
      setPreset("custom");
      setPreviewUrl(URL.createObjectURL(selected));
      setError("");
    } catch {
      setError("Could not open this image. Please try another file.");
    }
  }

  function handleWidthChange(value: string) {
    setWidth(value);
    setPreset("custom");

    const newWidth = Number(value);

    if (
      lockRatio &&
      originalWidth > 0 &&
      Number.isFinite(newWidth) &&
      newWidth > 0
    ) {
      setHeight(
        String(Math.max(1, Math.round((newWidth / originalWidth) * originalHeight)))
      );
    }

    clearResult();
  }

  function handleHeightChange(value: string) {
    setHeight(value);
    setPreset("custom");

    const newHeight = Number(value);

    if (
      lockRatio &&
      originalHeight > 0 &&
      Number.isFinite(newHeight) &&
      newHeight > 0
    ) {
      setWidth(
        String(Math.max(1, Math.round((newHeight / originalHeight) * originalWidth)))
      );
    }

    clearResult();
  }

  function applyPreset(value: string) {
    setPreset(value);
    clearResult();

    if (value === "custom") return;

    const selectedPreset = PRESETS.find(
      (item) => `${item.width}x${item.height}` === value
    );

    if (!selectedPreset) return;

    setLockRatio(false);
    setWidth(String(selectedPreset.width));
    setHeight(String(selectedPreset.height));
  }

  async function handleResize() {
    if (!file) {
      setError("Please upload an image first.");
      return;
    }

    const outputWidth = Number(width);
    const outputHeight = Number(height);

    if (
      !Number.isInteger(outputWidth) ||
      !Number.isInteger(outputHeight) ||
      outputWidth < 1 ||
      outputHeight < 1
    ) {
      setError("Enter a valid width and height in pixels.");
      return;
    }

    if (
      outputWidth > MAX_DIMENSION ||
      outputHeight > MAX_DIMENSION
    ) {
      setError("Width and height cannot exceed 12,000 pixels.");
      return;
    }

    if (outputWidth * outputHeight > 40000000) {
      setError("The output is too large. Choose dimensions totaling no more than 40 megapixels.");
      return;
    }

    setIsResizing(true);
    setError("");
    clearResult();

    let bitmap: ImageBitmap | null = null;
    let canvas: HTMLCanvasElement | null = null;

    try {
      bitmap = await createImageBitmap(file);

      canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Your browser could not process this image.");
      }

      if (format === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, outputWidth, outputHeight);
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      context.drawImage(
        bitmap,
        0,
        0,
        outputWidth,
        outputHeight
      );

      const blob = await canvasToBlob(
        canvas,
        format,
        quality / 100
      );

      if (blob.size > MAX_OUTPUT_SIZE) {
        throw new Error("The output exceeds 100 MB. Try smaller dimensions.");
      }

      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not resize this image. Please try again."
      );
    } finally {
      bitmap?.close();

      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }

      setIsResizing(false);
    }
  }

  const savedPercent =
    file && resultBlob
      ? ((file.size - resultBlob.size) / file.size) * 100
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
            Resize Image
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Change image dimensions in seconds. Enter custom pixel sizes,
            use presets, and download your resized image.
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
                ↔️
              </span>
              <span className="text-lg font-semibold">
                Upload your image
              </span>
              <span className="mt-2 text-sm text-slate-500">
                JPG, PNG, WebP and other browser-supported images · Max 50 MB
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

                <img
                  src={previewUrl}
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
                  Resize settings
                </h2>

                <label className="mb-2 mt-5 block text-sm font-medium text-slate-700">
                  Preset dimensions
                </label>

                <select
                  value={preset}
                  onChange={(event) => applyPreset(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-400"
                >
                  <option value="custom">Custom size</option>
                  {PRESETS.filter((item) => item.width > 0).map((item) => (
                    <option
                      key={`${item.width}x${item.height}`}
                      value={`${item.width}x${item.height}`}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={MAX_DIMENSION}
                      value={width}
                      onChange={(event) => handleWidthChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={MAX_DIMENSION}
                      value={height}
                      onChange={(event) => handleHeightChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLockRatio(!lockRatio);
                    clearResult();
                  }}
                  aria-pressed={lockRatio}
                  className={`mt-4 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                    lockRatio
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span>Lock aspect ratio</span>
                  <span className="font-semibold">
                    {lockRatio ? "🔒 On" : "🔓 Off"}
                  </span>
                </button>

                <label className="mb-2 mt-5 block text-sm font-medium text-slate-700">
                  Output format
                </label>

                <select
                  value={format}
                  onChange={(event) => {
                    setFormat(event.target.value as OutputFormat);
                    clearResult();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-400"
                >
                  <option value="image/jpeg">JPEG — smaller file</option>
                  <option value="image/png">PNG — lossless</option>
                  <option value="image/webp">WebP — modern format</option>
                </select>

                {format !== "image/png" && (
                  <>
                    <div className="mb-2 mt-5 flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">
                        Image quality
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
                  disabled={isResizing}
                  onClick={handleResize}
                  className="mt-6 flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResizing ? "Resizing…" : "Resize image"}
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

          {resultBlob && resultUrl && (
            <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold">Image resized successfully!</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {width} × {height} px
                  </p>
                </div>
                <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  {formatSize(resultBlob.size)}
                </span>
              </div>

              <div className="mt-5 rounded-xl bg-white p-4">
                <img
                  src={resultUrl}
                  alt="Resized image preview"
                  className="mx-auto max-h-96 rounded-lg object-contain"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">Original size</p>
                  <p className="mt-2 text-lg font-bold">
                    {formatSize(file!.size)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">New size</p>
                  <p className="mt-2 text-lg font-bold text-emerald-700">
                    {formatSize(resultBlob.size)}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">Size change</p>
                  <p className="mt-2 text-lg font-bold">
                    {savedPercent >= 0
                      ? `${savedPercent.toFixed(1)}% smaller`
                      : `${Math.abs(savedPercent).toFixed(1)}% larger`}
                  </p>
                </div>
              </div>

              <a
                href={resultUrl}
                download={`paperkit-resized.${getExtension(format)}`}
                className="mt-5 flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                ↓ Download resized image
              </a>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-white bg-white/70 p-6">
          <h2 className="font-semibold">Explore more tools</h2>
          <div className="mt-4 flex flex-wrap gap-3">
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
