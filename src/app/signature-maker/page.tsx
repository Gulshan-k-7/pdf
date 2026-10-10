
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; width: number };
type Background = "transparent" | "white";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 350;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SignatureMakerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const baseImageUrlRef = useRef("");

  const [color, setColor] = useState("#172554");
  const [penWidth, setPenWidth] = useState(3);
  const [background, setBackground] = useState<Background>("transparent");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [baseImageUrl, setBaseImageUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const clearResult = useCallback(() => {
    setResultBlob(null);
    setResultUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });
    setSaved(false);
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (background === "white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    const baseImage = baseImageRef.current;
    if (baseImage && baseImage.complete && baseImage.naturalWidth) {
      const scale = Math.min(
        (CANVAS_WIDTH * 0.9) / baseImage.naturalWidth,
        (CANVAS_HEIGHT * 0.8) / baseImage.naturalHeight,
      );

      const width = baseImage.naturalWidth * scale;
      const height = baseImage.naturalHeight * scale;

      ctx.drawImage(
        baseImage,
        (CANVAS_WIDTH - width) / 2,
        (CANVAS_HEIGHT - height) / 2,
        width,
        height,
      );
    }

    const allStrokes = [...strokesRef.current];
    if (currentStrokeRef.current) {
      allStrokes.push(currentStrokeRef.current);
    }

    for (const stroke of allStrokes) {
      if (!stroke.points.length) continue;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const first = stroke.points[0];

      if (stroke.points.length === 1) {
        ctx.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.moveTo(first.x, first.y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.stroke();
    }
  }, [background]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, strokes, baseImageUrl]);

  useEffect(() => {
    return () => {
      if (baseImageUrlRef.current) {
        URL.revokeObjectURL(baseImageUrlRef.current);
      }
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    return {
      x: Math.max(
        0,
        Math.min(
          CANVAS_WIDTH,
          ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          CANVAS_HEIGHT,
          ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
        ),
      ),
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;

    currentStrokeRef.current = {
      points: [getPoint(event)],
      color,
      width: penWidth,
    };

    clearResult();
    redrawCanvas();
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentStrokeRef.current) return;

    event.preventDefault();
    currentStrokeRef.current.points.push(getPoint(event));
    redrawCanvas();
  }

  function stopDrawing(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;

    drawingRef.current = false;

    const completed = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (completed) {
      const next = [...strokesRef.current, completed];
      strokesRef.current = next;
      setStrokes(next);
    }

    if (
      event &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    redrawCanvas();
  }

  function undo() {
    const next = strokesRef.current.slice(0, -1);
    strokesRef.current = next;
    setStrokes(next);
    clearResult();
  }

  function clearSignature() {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    setStrokes([]);
    baseImageRef.current = null;

    setBaseImageUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      baseImageUrlRef.current = "";
      return "";
    });

    clearResult();
    setError("");
    redrawCanvas();
  }

  function uploadSignature(file?: File) {
    if (!file) return;

    setError("");
    clearResult();

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("The uploaded image must be 20 MB or smaller.");
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      baseImageRef.current = image;

      strokesRef.current = [];
      currentStrokeRef.current = null;
      setStrokes([]);

      setBaseImageUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        baseImageUrlRef.current = url;
        return url;
      });

      redrawCanvas();
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not open this image. Please try another file.");
    };

    image.src = url;
  }

  async function downloadSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setBusy(true);
    setError("");

    try {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = CANVAS_WIDTH;
      exportCanvas.height = CANVAS_HEIGHT;

      const ctx = exportCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare the signature.");

      if (background === "white") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Export from the editor canvas, preserving transparency when selected.
      ctx.drawImage(canvas, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        exportCanvas.toBlob(
          (output) =>
            output
              ? resolve(output)
              : reject(new Error("Could not export the signature.")),
          "image/png",
        );
      });

      clearResult();
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while exporting.",
      );
    } finally {
      setBusy(false);
    }
  }

  function saveFile() {
    if (!resultUrl || !resultBlob) return;

    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = "paperkit-signature.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
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
            Signature maker<span className="text-emerald-600">.</span>
          </h1>

          <p className="mt-4 text-base leading-7 text-gray-500 sm:text-lg">
            Draw your signature, customize the ink, and export a clean PNG
            for your digital documents.
          </p>
        </header>

        <section className="rounded-3xl border border-black/[0.06] bg-white p-4 shadow-[0_12px_50px_rgba(25,40,25,0.05)] sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Signature canvas</h2>
              <p className="mt-1 text-sm text-gray-500">
                Use your mouse, finger, or stylus.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Upload signature
            </button>
          </div>

          <div
            className="overflow-hidden rounded-2xl border border-gray-200"
            style={{
              backgroundImage:
                background === "transparent"
                  ? "linear-gradient(45deg,#f0f1ee 25%,transparent 25%),linear-gradient(-45deg,#f0f1ee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f0f1ee 75%),linear-gradient(-45deg,transparent 75%,#f0f1ee 75%)"
                  : "none",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0,0 10px,10px -10px,-10px 0px",
              backgroundColor: background === "white" ? "#ffffff" : "#ffffff",
            }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onLostPointerCapture={() => {
                if (drawingRef.current) stopDrawing();
              }}
              className="block w-full touch-none"
              style={{
                aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                cursor: "crosshair",
              }}
              aria-label="Draw your signature here"
            />
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Tip: Sign naturally using a mouse or stylus. For best results,
            use a tablet or touchscreen with a pen.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              uploadSignature(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />

          <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-3 block text-sm font-semibold">
                Pen color
              </label>

              <div className="flex flex-wrap items-center gap-3">
                {["#172554", "#111111", "#1d4ed8", "#047857", "#7c3aed"].map(
                  (swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={`Set pen color ${swatch}`}
                      aria-pressed={color === swatch}
                      onClick={() => {
                        setColor(swatch);
                        clearResult();
                      }}
                      className={`h-9 w-9 rounded-full border-2 transition ${
                        color === swatch
                          ? "scale-110 border-emerald-500 ring-2 ring-emerald-100"
                          : "border-white shadow-sm"
                      }`}
                      style={{ backgroundColor: swatch }}
                    />
                  ),
                )}

                <label className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-gray-200 text-xs">
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => {
                      setColor(event.target.value);
                      clearResult();
                    }}
                    className="h-12 w-12 cursor-pointer"
                    aria-label="Custom pen color"
                  />
                </label>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <label htmlFor="pen-width" className="text-sm font-semibold">
                  Pen thickness
                </label>
                <span className="text-sm text-emerald-700">{penWidth}px</span>
              </div>

              <input
                id="pen-width"
                type="range"
                min="1"
                max="12"
                step="1"
                value={penWidth}
                onChange={(event) => {
                  setPenWidth(Number(event.target.value));
                  clearResult();
                }}
                className="w-full accent-emerald-600"
              />
            </div>
          </div>

          <div className="mt-7">
            <h3 className="mb-3 text-sm font-semibold">Canvas background</h3>

            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "transparent" as const, label: "Transparent PNG" },
                { value: "white" as const, label: "White background" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setBackground(option.value);
                    clearResult();
                  }}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    background === option.value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={undo}
              disabled={strokes.length === 0}
              className="rounded-xl border border-gray-200 px-4 py-3.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↶ Undo stroke
            </button>

            <button
              type="button"
              onClick={clearSignature}
              className="rounded-xl border border-gray-200 px-4 py-3.5 text-sm font-semibold transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              Clear canvas
            </button>
          </div>

          <button
            type="button"
            onClick={downloadSignature}
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-emerald-600 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Preparing signature..." : "Prepare signature PNG ↓"}
          </button>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {resultUrl && resultBlob && saved && (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-6">
              <div className="mb-5">
                <h2 className="font-semibold">Your signature is ready!</h2>
                <p className="mt-1 text-sm text-gray-500">
                  PNG · {formatSize(resultBlob.size)}
                </p>
              </div>

              <div
                className="overflow-hidden rounded-xl border border-gray-200 p-3"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg,#f0f1ee 25%,transparent 25%),linear-gradient(-45deg,#f0f1ee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f0f1ee 75%),linear-gradient(-45deg,transparent 75%,#f0f1ee 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0,0 10px,10px -10px,-10px 0px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultUrl}
                  alt="Signature preview"
                  className="block w-full"
                />
              </div>

              <button
                type="button"
                onClick={saveFile}
                className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-4 font-semibold text-white transition hover:bg-emerald-700"
              >
                Download signature PNG ↓
              </button>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">
            More image tools
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                title: "Crop Image",
                description: "Crop images precisely.",
                href: "/crop-image",
              },
              {
                title: "Resize Image",
                description: "Change image dimensions.",
                href: "/resize-image",
              },
              {
                title: "Compress Image",
                description: "Reduce image file size.",
                href: "/compress-image",
              },
            ].map((tool) => (
              <a
                key={tool.href}
                href={tool.href}
                className="group rounded-2xl border border-black/[0.06] bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg"
              >
                <h3 className="font-semibold group-hover:text-emerald-700">
                  {tool.title}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {tool.description}
                </p>
              </a>
            ))}
          </div>
        </section>

        <p className="mt-10 text-center text-xs leading-6 text-gray-400">
          Your signature is processed locally in your browser and is not
          uploaded to a PaperKit server.
        </p>
      </div>
    </main>
  );
}
