
"use client";

import { useEffect, useRef, useState } from "react";

type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const outputFormats: { label: string; value: OutputFormat }[] = [
  { label: "JPG", value: "image/jpeg" },
  { label: "PNG", value: "image/png" },
  { label: "WebP", value: "image/webp" },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function RotateFlipImagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = useState(90);
  const [resultUrl, setResultUrl] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function uploadImage(selectedFile?: File) {
    if (!selectedFile) return;

    setError("");
    clearResult();

    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("Your image must be 50 MB or smaller.");
      return;
    }

    setImageUrl(URL.createObjectURL(selectedFile));
    setFile(selectedFile);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  }

  function updateRotation(degrees: number) {
    setRotation((previous) => (previous + degrees + 360) % 360);
    clearResult();
  }

  function toggleHorizontalFlip() {
    setFlipH((previous) => !previous);
    clearResult();
  }

  function toggleVerticalFlip() {
    setFlipV((previous) => !previous);
    clearResult();
  }

  function resetEdits() {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    clearResult();
    setError("");
  }

  async function exportImage() {
    const image = imageRef.current;

    if (!image || !file) {
      setError("Please upload an image first.");
      return;
    }

    if (!image.naturalWidth || !image.naturalHeight) {
      setError("The image has not finished loading. Please try again.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const canvas = document.createElement("canvas");
      const sideways = rotation === 90 || rotation === 270;

      canvas.width = sideways ? image.naturalHeight : image.naturalWidth;
      canvas.height = sideways ? image.naturalWidth : image.naturalHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Your browser could not process this image.");
      }

      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.scale(flipH ? -1 : 1, flipV ? -1 : 1);

      context.drawImage(
        image,
        -image.naturalWidth / 2,
        -image.naturalHeight / 2,
        image.naturalWidth,
        image.naturalHeight,
      );

      // JPEG cannot store transparency, so fill transparent areas with white.
      if (format === "image/jpeg") {
        const flattenedCanvas = document.createElement("canvas");
        flattenedCanvas.width = canvas.width;
        flattenedCanvas.height = canvas.height;

        const flattenedContext = flattenedCanvas.getContext("2d");

        if (!flattenedContext) {
          throw new Error("Could not prepare the JPEG image.");
        }

        flattenedContext.fillStyle = "#ffffff";
        flattenedContext.fillRect(
          0,
          0,
          flattenedCanvas.width,
          flattenedCanvas.height,
        );
        flattenedContext.drawImage(canvas, 0, 0);

        const blob = await new Promise<Blob>((resolve, reject) => {
          flattenedCanvas.toBlob(
            (output) =>
              output
                ? resolve(output)
                : reject(new Error("Could not export the image.")),
            format,
            quality / 100,
          );
        });

        setResultBlob(blob);
        setResultUrl(URL.createObjectURL(blob));
      } else {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (output) =>
              output
                ? resolve(output)
                : reject(new Error("Could not export the image.")),
            format,
            format === "image/webp" ? quality / 100 : undefined,
          );
        });

        setResultBlob(blob);
        setResultUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while editing the image.",
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadImage() {
    if (!resultUrl || !resultBlob) return;

    const extension =
      format === "image/jpeg"
        ? "jpg"
        : format === "image/png"
          ? "png"
          : "webp";

    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `paperkit-rotated-image.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function removeImage() {
    setFile(null);
    setImageUrl("");
    resetEdits();
    clearResult();
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-[#fafbf9] px-4 pb-20 pt-12 text-[#20251f] sm:px-6 sm:pt-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            PaperKit Image Tools
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Rotate & flip image
            <span className="text-emerald-600">.</span>
          </h1>

          <p className="mt-4 text-base leading-7 text-gray-500 sm:text-lg">
            Turn your images in the right direction or flip them with a single
            click. Preview your edits and download the result.
          </p>
        </header>

        {/* Main editor */}
        <section className="rounded-3xl border border-black/[0.06] bg-white p-4 shadow-[0_12px_50px_rgba(25,40,25,0.05)] sm:p-7">
          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 px-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50"
            >
              <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">
                🔄
              </span>

              <span className="text-lg font-semibold">Upload your image</span>

              <span className="mt-2 text-sm text-gray-500">
                JPG, PNG, WebP and other browser-supported images
              </span>

              <span className="mt-5 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white">
                Choose image
              </span>

              <span className="mt-4 text-xs text-gray-400">
                Maximum file size: 50 MB
              </span>
            </button>
          ) : (
            <div className="space-y-7">
              {/* File information */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{file.name}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Original size: {formatSize(file.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={removeImage}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
                >
                  Remove image
                </button>
              </div>

              {/* Preview */}
              <div className="overflow-hidden rounded-2xl bg-[#f4f5f2] p-5 sm:p-8">
                <p className="mb-5 text-center text-xs font-medium uppercase tracking-widest text-gray-400">
                  Live preview
                </p>

                <div className="flex min-h-64 items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Image editing preview"
                    className="max-h-[55vh] max-w-full object-contain transition-transform duration-200"
                    style={{
                      transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
                    }}
                  />
                </div>

                <div className="mt-5 text-center text-sm text-gray-500">
                  Rotation: {rotation}°
                  {flipH && " · Flipped horizontally"}
                  {flipV && " · Flipped vertically"}
                </div>
              </div>

              {/* Rotate controls */}
              <div>
                <h2 className="mb-3 text-sm font-semibold">Rotate image</h2>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => updateRotation(-90)}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 px-2 py-4 transition hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <span className="text-2xl">↶</span>
                    <span className="text-sm font-medium">Left 90°</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateRotation(180)}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 px-2 py-4 transition hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <span className="text-2xl">↻</span>
                    <span className="text-sm font-medium">180°</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateRotation(90)}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 px-2 py-4 transition hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <span className="text-2xl">↷</span>
                    <span className="text-sm font-medium">Right 90°</span>
                  </button>
                </div>
              </div>

              {/* Flip controls */}
              <div>
                <h2 className="mb-3 text-sm font-semibold">Flip image</h2>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={toggleHorizontalFlip}
                    aria-pressed={flipH}
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium transition ${
                      flipH
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-gray-200 hover:border-emerald-300"
                    }`}
                  >
                    <span className="mb-2 block text-2xl">↔</span>
                    Flip horizontal
                  </button>

                  <button
                    type="button"
                    onClick={toggleVerticalFlip}
                    aria-pressed={flipV}
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium transition ${
                      flipV
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-gray-200 hover:border-emerald-300"
                    }`}
                  >
                    <span className="mb-2 block text-2xl">↕</span>
                    Flip vertical
                  </button>
                </div>
              </div>

              {/* Output format */}
              <div>
                <h2 className="mb-3 text-sm font-semibold">Output format</h2>

                <div className="grid grid-cols-3 gap-2">
                  {outputFormats.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setFormat(item.value);
                        clearResult();
                      }}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                        format === item.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality control */}
              {format !== "image/png" && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <label htmlFor="image-quality" className="text-sm font-semibold">
                      Image quality
                    </label>
                    <span className="text-sm font-medium text-emerald-700">
                      {quality}%
                    </span>
                  </div>

                  <input
                    id="image-quality"
                    type="range"
                    min="40"
                    max="100"
                    value={quality}
                    onChange={(event) => {
                      setQuality(Number(event.target.value));
                      clearResult();
                    }}
                    className="w-full accent-emerald-600"
                  />

                  <p className="mt-2 text-xs text-gray-500">
                    Higher quality generally produces a larger file.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={resetEdits}
                  className="rounded-xl border border-gray-200 px-5 py-4 font-semibold transition hover:bg-gray-50"
                >
                  Reset edits
                </button>

                <button
                  type="button"
                  onClick={exportImage}
                  disabled={busy}
                  className="rounded-xl bg-emerald-600 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Processing image..." : "Apply & export image"}
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => uploadImage(event.target.files?.[0])}
          />

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* Export result */}
          {resultUrl && resultBlob && file && (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
                  ✓
                </span>
                <div>
                  <h2 className="font-semibold">Your image is ready!</h2>
                  <p className="text-sm text-gray-500">
                    Preview and download your edited image.
                  </p>
                </div>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="Edited image result"
                className="mx-auto max-h-96 max-w-full rounded-xl border border-gray-200 bg-white object-contain"
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-gray-500">Original file</p>
                  <p className="mt-1 font-semibold">{formatSize(file.size)}</p>
                </div>

                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-gray-500">Edited file</p>
                  <p className="mt-1 font-semibold">{formatSize(resultBlob.size)}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={downloadImage}
                className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-4 font-semibold text-white transition hover:bg-emerald-700"
              >
                Download edited image ↓
              </button>
            </div>
          )}
        </section>

        {/* Related tools */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">
            More image tools
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Everything you need to prepare your images.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                title: "Crop Image",
                description: "Select the perfect area.",
                href: "/crop-image",
                icon: "✂",
              },
              {
                title: "Resize Image",
                description: "Change image dimensions.",
                href: "/resize-image",
                icon: "⤢",
              },
              {
                title: "Compress Image",
                description: "Reduce image file size.",
                href: "/compress-image",
                icon: "↘",
              },
            ].map((tool) => (
              <a
                key={tool.href}
                href={tool.href}
                className="group rounded-2xl border border-black/[0.06] bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-700">
                  {tool.icon}
                </span>
                <h3 className="mt-4 font-semibold group-hover:text-emerald-700">
                  {tool.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {tool.description}
                </p>
              </a>
            ))}
          </div>
        </section>

        <p className="mt-10 text-center text-xs leading-6 text-gray-400">
          Your image is processed locally in your browser. This tool does not
          upload your image to a PaperKit server.
        </p>
      </div>
    </main>
  );
}
