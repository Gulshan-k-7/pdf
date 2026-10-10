
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type Format = "image/jpeg" | "image/png" | "image/webp";
type Ratio = "free" | "1:1" | "4:3" | "16:9" | "3:2";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ratios: { label: string; value: Ratio }[] = [
  { label: "Free", value: "free" },
  { label: "1:1", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "16:9", value: "16:9" },
  { label: "3:2", value: "3:2" },
];

const formats: { label: string; value: Format }[] = [
  { label: "JPG", value: "image/jpeg" },
  { label: "PNG", value: "image/png" },
  { label: "WebP", value: "image/webp" },
];

function getAspectRatio(ratio: Ratio): number | undefined {
  if (ratio === "free") return undefined;

  const [width, height] = ratio.split(":").map(Number);
  return width / height;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createCrop(ratio: Ratio): Crop {
  const aspect = getAspectRatio(ratio);

  if (!aspect) {
    return {
      unit: "%",
      x: 10,
      y: 10,
      width: 80,
      height: 80,
    };
  }

  return centerCrop(
    makeAspectCrop(
      { unit: "%", width: 80 },
      aspect,
      100,
      100,
    ),
    100,
    100,
  );
}

export default function CropImagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [ratio, setRatio] = useState<Ratio>("free");
  const [format, setFormat] = useState<Format>("image/jpeg");
  const [quality, setQuality] = useState(90);
  const [resultUrl, setResultUrl] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearResult = useCallback(() => {
    setResultBlob(null);
    setResultUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });
  }, []);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [imageUrl, resultUrl]);

  function handleFile(selectedFile?: File) {
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

    const nextUrl = URL.createObjectURL(selectedFile);

    setImageUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return nextUrl;
    });

    setFile(selectedFile);
    setRatio("free");
    setCrop(undefined);
    setCompletedCrop(undefined);
  }

  function handleRatioChange(nextRatio: Ratio) {
    setRatio(nextRatio);
    clearResult();

    if (imageRef.current) {
      const image = imageRef.current;
      const nextCrop = createCrop(nextRatio);
      const aspect = getAspectRatio(nextRatio);

      if (aspect) {
        setCrop(
          centerCrop(
            makeAspectCrop(
              { unit: "%", width: 80 },
              aspect,
              image.width,
              image.height,
            ),
            image.width,
            image.height,
          ),
        );
      } else {
        setCrop(nextCrop);
      }
    }
  }

  function handleImageLoad() {
    const image = imageRef.current;
    if (!image) return;

    const aspect = getAspectRatio(ratio);

    if (aspect) {
      setCrop(
        centerCrop(
          makeAspectCrop(
            { unit: "%", width: 80 },
            aspect,
            image.width,
            image.height,
          ),
          image.width,
          image.height,
        ),
      );
    } else {
      setCrop({
        unit: "%",
        x: 10,
        y: 10,
        width: 80,
        height: 80,
      });
    }
  }

  async function cropImage() {
    const image = imageRef.current;
    const canvas = canvasRef.current;

    if (!image || !canvas || !completedCrop || !file) {
      setError("Select an image and adjust the crop area first.");
      return;
    }

    if (completedCrop.width < 1 || completedCrop.height < 1) {
      setError("Please select a larger crop area.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const sourceX = Math.max(0, Math.round(completedCrop.x * scaleX));
      const sourceY = Math.max(0, Math.round(completedCrop.y * scaleY));
      const sourceWidth = Math.min(
        Math.round(completedCrop.width * scaleX),
        image.naturalWidth - sourceX,
      );
      const sourceHeight = Math.min(
        Math.round(completedCrop.height * scaleY),
        image.naturalHeight - sourceY,
      );

      if (sourceWidth < 1 || sourceHeight < 1) {
        throw new Error("The selected crop area is too small.");
      }

      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not process this image.");

      // JPG does not support transparency, so use a white background.
      if (format === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, sourceWidth, sourceHeight);
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (output) => {
            if (output) resolve(output);
            else reject(new Error("Could not create the cropped image."));
          },
          format,
          format === "image/png" ? undefined : quality / 100,
        );
      });

      clearResult();
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while cropping the image.",
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
    link.download = `paperkit-cropped-image.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function resetAll() {
    setFile(null);
    setImageUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });
    setCrop(undefined);
    setCompletedCrop(undefined);
    clearResult();
    setError("");

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="min-h-screen bg-[#fafbf9] px-4 pb-20 pt-12 text-[#20251f] sm:px-6 sm:pt-16">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            PaperKit Image Tools
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Crop image<span className="text-emerald-600">.</span>
          </h1>

          <p className="mt-4 text-base leading-7 text-gray-500 sm:text-lg">
            Keep what matters. Crop your images exactly how you want them.
            Simple, private, and right in your browser.
          </p>
        </div>

        <section className="rounded-3xl border border-black/[0.06] bg-white p-4 shadow-[0_12px_50px_rgba(25,40,25,0.05)] sm:p-7">
          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 px-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50"
            >
              <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">
                ✂️
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
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{file.name}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Original size: {formatSize(file.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
                >
                  Remove image
                </button>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold">Aspect ratio</p>
                <div className="flex flex-wrap gap-2">
                  {ratios.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleRatioChange(item.value)}
                      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                        ratio === item.value
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "border border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl bg-[#f4f5f2] p-3 sm:p-5">
                <p className="mb-4 text-center text-xs text-gray-500">
                  Drag the crop area and its handles to adjust your selection.
                </p>

                <div className="flex min-h-48 items-center justify-center">
                  <ReactCrop
                    crop={crop}
                    onChange={(nextCrop) => {
                      setCrop(nextCrop);
                      clearResult();
                    }}
                    onComplete={(nextCrop) => setCompletedCrop(nextCrop)}
                    aspect={getAspectRatio(ratio)}
                    minWidth={20}
                    minHeight={20}
                    keepSelection
                    ruleOfThirds
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="Image being cropped"
                      onLoad={handleImageLoad}
                      className="block max-h-[65vh] max-w-full object-contain"
                      style={{ width: "auto", height: "auto" }}
                    />
                  </ReactCrop>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold">Output format</p>
                <div className="grid grid-cols-3 gap-2">
                  {formats.map((item) => (
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

              {format !== "image/png" && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <label
                      htmlFor="crop-quality"
                      className="text-sm font-semibold"
                    >
                      Image quality
                    </label>
                    <span className="text-sm font-medium text-emerald-700">
                      {quality}%
                    </span>
                  </div>
                  <input
                    id="crop-quality"
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
                    Higher quality usually means a larger file.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={cropImage}
                disabled={busy}
                className="w-full rounded-xl bg-emerald-600 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Cropping image..." : "Crop image"}
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <canvas ref={canvasRef} className="hidden" />

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {resultUrl && resultBlob && file && (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
                  ✓
                </span>
                <div>
                  <h2 className="font-semibold">Your cropped image is ready!</h2>
                  <p className="text-sm text-gray-500">
                    Preview your result before downloading.
                  </p>
                </div>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="Cropped image preview"
                className="mx-auto max-h-96 max-w-full rounded-xl border border-gray-200 bg-white object-contain"
              />

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-gray-500">Original</p>
                  <p className="mt-1 font-semibold">{formatSize(file.size)}</p>
                </div>
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-gray-500">Cropped file</p>
                  <p className="mt-1 font-semibold">
                    {formatSize(resultBlob.size)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={downloadImage}
                className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-4 font-semibold text-white transition hover:bg-emerald-700"
              >
                Download cropped image ↓
              </button>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">
            More image tools
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Fine-tune your images with PaperKit.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                title: "Compress Image",
                description: "Reduce image file size.",
                href: "/compress-image",
                icon: "↘",
              },
              {
                title: "Resize Image",
                description: "Change image dimensions.",
                href: "/resize-image",
                icon: "⤢",
              },
              {
                title: "Convert Image",
                description: "Convert between formats.",
                href: "/convert-image",
                icon: "⇄",
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
          Your image is processed in your browser. It is not uploaded to a
          PaperKit server by this tool.
        </p>
      </div>
    </main>
  );
}
