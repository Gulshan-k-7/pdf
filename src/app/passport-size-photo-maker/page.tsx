
"use client";

import { useEffect, useRef, useState } from "react";

type PhotoPreset = "india" | "us" | "30x40" | "custom";
type OutputFormat = "image/jpeg" | "image/png";
type PrintLayout = "single" | "4x6" | "a4";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const DPI = 300;

const presets: {
  value: PhotoPreset;
  label: string;
  description: string;
  widthMm: number;
  heightMm: number;
}[] = [
  {
    value: "india",
    label: "India passport",
    description: "35 × 45 mm",
    widthMm: 35,
    heightMm: 45,
  },
  {
    value: "us",
    label: "US passport",
    description: "2 × 2 inches",
    widthMm: 50.8,
    heightMm: 50.8,
  },
  {
    value: "30x40",
    label: "Small portrait",
    description: "30 × 40 mm",
    widthMm: 30,
    heightMm: 40,
  },
  {
    value: "custom",
    label: "Custom size",
    description: "Set your own dimensions",
    widthMm: 35,
    heightMm: 45,
  },
];

function mmToPixels(mm: number) {
  return Math.round((mm / 25.4) * DPI);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Could not export the photo.")),
      format,
      quality / 100,
    );
  });
}

export default function PassportPhotoMakerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [preset, setPreset] = useState<PhotoPreset>("india");

  const [widthMm, setWidthMm] = useState(35);
  const [heightMm, setHeightMm] = useState(45);

  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);

  const [background, setBackground] = useState<"white" | "transparent">(
    "white",
  );
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = useState(95);
  const [layout, setLayout] = useState<PrintLayout>("single");

  const [resultUrl, setResultUrl] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  function clearResult() {
    setResultBlob(null);
    setResultUrl("");
  }

  function handleUpload(selected?: File) {
    if (!selected) return;

    setError("");
    clearResult();

    if (!selected.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setError("Please choose an image smaller than 50 MB.");
      return;
    }

    const nextUrl = URL.createObjectURL(selected);
    setImageUrl(nextUrl);
    setFile(selected);
    setZoom(1);
    setHorizontal(50);
    setVertical(50);
  }

  function handlePresetChange(value: PhotoPreset) {
    const selected = presets.find((item) => item.value === value);
    if (!selected) return;

    setPreset(value);
    setWidthMm(selected.widthMm);
    setHeightMm(selected.heightMm);
    clearResult();
  }

  function resetPosition() {
    setZoom(1);
    setHorizontal(50);
    setVertical(50);
    clearResult();
  }

  async function createPassportPhoto() {
    const image = imageRef.current;

    if (!file || !image || !image.naturalWidth || !image.naturalHeight) {
      setError("Upload an image and wait for it to load.");
      return;
    }

    if (
      !Number.isFinite(widthMm) ||
      !Number.isFinite(heightMm) ||
      widthMm < 10 ||
      heightMm < 10 ||
      widthMm > 100 ||
      heightMm > 150
    ) {
      setError(
        "Enter valid dimensions: width 10–100 mm and height 10–150 mm.",
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const photoWidth = mmToPixels(widthMm);
      const photoHeight = mmToPixels(heightMm);

      const canvas = document.createElement("canvas");
      canvas.width = photoWidth;
      canvas.height = photoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser could not process this image.");

      if (background === "white" || format === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, photoWidth, photoHeight);
      } else {
        ctx.clearRect(0, 0, photoWidth, photoHeight);
      }

      // Cover the entire output frame, then zoom further if requested.
      const baseScale = Math.max(
        photoWidth / image.naturalWidth,
        photoHeight / image.naturalHeight,
      );

      const scale = baseScale * zoom;
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;

      const extraX = drawWidth - photoWidth;
      const extraY = drawHeight - photoHeight;

      const drawX = -extraX * (horizontal / 100);
      const drawY = -extraY * (vertical / 100);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, photoWidth, photoHeight);
      ctx.clip();
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      let finalCanvas = canvas;

      if (layout !== "single") {
        const sheetWidth =
          layout === "4x6" ? mmToPixels(101.6) : mmToPixels(210);
        const sheetHeight =
          layout === "4x6" ? mmToPixels(152.4) : mmToPixels(297);

        const sheet = document.createElement("canvas");
        sheet.width = sheetWidth;
        sheet.height = sheetHeight;

        const sheetCtx = sheet.getContext("2d");
        if (!sheetCtx) throw new Error("Could not create the print sheet.");

        sheetCtx.fillStyle = "#ffffff";
        sheetCtx.fillRect(0, 0, sheetWidth, sheetHeight);

        const margin = mmToPixels(layout === "4x6" ? 3 : 8);
        const gap = mmToPixels(3);
        const usableWidth = sheetWidth - margin * 2;
        const usableHeight = sheetHeight - margin * 2;

        const columns = Math.max(
          1,
          Math.floor((usableWidth + gap) / (photoWidth + gap)),
        );
        const rows = Math.max(
          1,
          Math.floor((usableHeight + gap) / (photoHeight + gap)),
        );

        // Center the grid on the print sheet.
        const gridWidth = columns * photoWidth + (columns - 1) * gap;
        const gridHeight = rows * photoHeight + (rows - 1) * gap;
        const startX = Math.round((sheetWidth - gridWidth) / 2);
        const startY = Math.round((sheetHeight - gridHeight) / 2);

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < columns; col++) {
            sheetCtx.drawImage(
              canvas,
              startX + col * (photoWidth + gap),
              startY + row * (photoHeight + gap),
            );
          }
        }

        finalCanvas = sheet;
      }

      const blob = await canvasToBlob(finalCanvas, format, quality);

      clearResult();
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create your passport photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadPhoto() {
    if (!resultUrl || !resultBlob) return;

    const extension = format === "image/jpeg" ? "jpg" : "png";
    const layoutName =
      layout === "single" ? "photo" : `${layout}-print-sheet`;

    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `paperkit-passport-${layoutName}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function removePhoto() {
    setFile(null);
    setImageUrl("");
    clearResult();
    setError("");

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="min-h-screen bg-[#fafbf9] px-4 pb-20 pt-12 text-[#20251f] sm:px-6 sm:pt-16">
      <div className="mx-auto max-w-5xl">
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            PaperKit Image Tools
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Passport photo maker
            <span className="text-emerald-600">.</span>
          </h1>

          <p className="mt-4 text-base leading-7 text-gray-500 sm:text-lg">
            Create correctly sized ID-style photos and print sheets right in
            your browser.
          </p>
        </header>

        <section className="rounded-3xl border border-black/[0.06] bg-white p-4 shadow-[0_12px_50px_rgba(25,40,25,0.05)] sm:p-7">
          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 px-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50"
            >
              <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">
                📸
              </span>
              <span className="text-lg font-semibold">Upload your portrait</span>
              <span className="mt-2 text-sm text-gray-500">
                JPG, PNG or WebP · Maximum 50 MB
              </span>
              <span className="mt-5 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white">
                Choose image
              </span>
            </button>
          ) : (
            <div className="space-y-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{file.name}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removePhoto}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Remove photo
                </button>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold">Photo size</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {presets.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handlePresetChange(item.value)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        preset === item.value
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-emerald-200"
                      }`}
                    >
                      <span className="block font-semibold">{item.label}</span>
                      <span className="mt-1 block text-sm text-gray-500">
                        {item.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {preset === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium">
                    Width (mm)
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={widthMm}
                      onChange={(event) => {
                        setWidthMm(Number(event.target.value));
                        clearResult();
                      }}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Height (mm)
                    <input
                      type="number"
                      min="10"
                      max="150"
                      value={heightMm}
                      onChange={(event) => {
                        setHeightMm(Number(event.target.value));
                        clearResult();
                      }}
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 outline-none focus:border-emerald-500"
                    />
                  </label>
                </div>
              )}

              <div className="rounded-2xl bg-[#f4f5f2] p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">Adjust your portrait</h2>
                  <button
                    type="button"
                    onClick={resetPosition}
                    className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
                  >
                    Reset position
                  </button>
                </div>

                <div className="flex min-h-64 items-center justify-center overflow-hidden">
                  <div
                    className="relative overflow-hidden border-2 border-white bg-white shadow-lg"
                    style={{
                      width: `${Math.min(240, 240 * (widthMm / Math.max(widthMm, heightMm)))}px`,
                      aspectRatio: `${widthMm} / ${heightMm}`,
                      maxHeight: "340px",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="Portrait preview"
                      className="absolute max-w-none"
                      onLoad={clearResult}
                      style={{
                        width: `${zoom * 100}%`,
                        height: `${zoom * 100}%`,
                        maxWidth: "none",
                        objectFit: "cover",
                        left: `${50 - horizontal * zoom}%`,
                        top: `${50 - vertical * zoom}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <label htmlFor="photo-zoom" className="font-medium">
                        Zoom
                      </label>
                      <span className="text-gray-500">{zoom.toFixed(1)}×</span>
                    </div>
                    <input
                      id="photo-zoom"
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={zoom}
                      onChange={(event) => {
                        setZoom(Number(event.target.value));
                        clearResult();
                      }}
                      className="w-full accent-emerald-600"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <label htmlFor="photo-horizontal" className="font-medium">
                        Horizontal position
                      </label>
                      <span className="text-gray-500">{horizontal}%</span>
                    </div>
                    <input
                      id="photo-horizontal"
                      type="range"
                      min="0"
                      max="100"
                      value={horizontal}
                      onChange={(event) => {
                        setHorizontal(Number(event.target.value));
                        clearResult();
                      }}
                      className="w-full accent-emerald-600"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <label htmlFor="photo-vertical" className="font-medium">
                        Vertical position
                      </label>
                      <span className="text-gray-500">{vertical}%</span>
                    </div>
                    <input
                      id="photo-vertical"
                      type="range"
                      min="0"
                      max="100"
                      value={vertical}
                      onChange={(event) => {
                        setVertical(Number(event.target.value));
                        clearResult();
                      }}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold">Background</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "white" as const, label: "White background" },
                    {
                      value: "transparent" as const,
                      label: "Transparent canvas",
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setBackground(option.value);
                        clearResult();
                      }}
                      className={`rounded-xl border px-3 py-3 text-sm font-medium ${
                        background === option.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  This setting fills transparent areas; it does not remove an
                  existing background from your portrait.
                </p>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold">Download format</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "image/jpeg" as const, label: "JPG" },
                    { value: "image/png" as const, label: "PNG" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setFormat(option.value);
                        clearResult();
                      }}
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                        format === option.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {format === "image/jpeg" && (
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <label htmlFor="photo-quality" className="font-medium">
                      JPG quality
                    </label>
                    <span className="text-emerald-700">{quality}%</span>
                  </div>
                  <input
                    id="photo-quality"
                    type="range"
                    min="60"
                    max="100"
                    value={quality}
                    onChange={(event) => {
                      setQuality(Number(event.target.value));
                      clearResult();
                    }}
                    className="w-full accent-emerald-600"
                  />
                </div>
              )}

              <div>
                <h2 className="mb-3 text-sm font-semibold">Print layout</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { value: "single" as const, label: "Single photo" },
                    { value: "4x6" as const, label: "4 × 6 inch sheet" },
                    { value: "a4" as const, label: "A4 sheet" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setLayout(option.value);
                        clearResult();
                      }}
                      className={`rounded-xl border px-3 py-3 text-sm font-medium ${
                        layout === option.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Print sheets arrange as many copies as fit with small gaps.
                  Print at 100% / actual size to preserve dimensions.
                </p>
              </div>

              <button
                type="button"
                onClick={createPassportPhoto}
                disabled={busy}
                className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy ? "Creating photo..." : "Create passport photo"}
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => handleUpload(event.target.files?.[0])}
          />

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {resultUrl && resultBlob && (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-6">
              <div className="mb-5">
                <h2 className="font-semibold">Your photo is ready!</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Output: {widthMm} × {heightMm} mm at {DPI} DPI
                  {layout !== "single" ? ` · ${layout.toUpperCase()} print sheet` : ""}
                </p>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="Generated passport photo or print sheet"
                className="mx-auto max-h-[500px] max-w-full rounded-xl border border-gray-200 bg-white object-contain"
              />

              <p className="mt-4 text-sm text-gray-600">
                File size: {formatSize(resultBlob.size)}
              </p>

              <button
                type="button"
                onClick={downloadPhoto}
                className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-4 font-semibold text-white transition hover:bg-emerald-700"
              >
                Download photo ↓
              </button>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">More image tools</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                title: "Crop Image",
                description: "Crop your portrait precisely.",
                href: "/crop-image",
              },
              {
                title: "Resize Image",
                description: "Change image dimensions.",
                href: "/resize-image",
              },
              {
                title: "Compress Image",
                description: "Reduce your image file size.",
                href: "/compress-image",
              },
            ].map((tool) => (
              <a
                key={tool.href}
                href={tool.href}
                className="rounded-2xl border border-black/[0.06] bg-white p-5 transition hover:border-emerald-200 hover:shadow-lg"
              >
                <h3 className="font-semibold">{tool.title}</h3>
                <p className="mt-2 text-sm text-gray-500">
                  {tool.description}
                </p>
              </a>
            ))}
          </div>
        </section>

        <p className="mt-10 text-center text-xs leading-6 text-gray-400">
          Processed locally in your browser. No upload to a PaperKit server.
        </p>
      </div>
    </main>
  );
}
