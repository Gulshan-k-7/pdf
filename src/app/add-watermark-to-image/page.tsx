
"use client";

import { useEffect, useRef, useState } from "react";

type WatermarkType = "text" | "image";
type Position =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "repeat";

export default function AddWatermarkImagePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [source, setSource] = useState("");
  const [logo, setLogo] = useState("");
  const [filename, setFilename] = useState("image");
  const [type, setType] = useState<WatermarkType>("text");
  const [text, setText] = useState("© PaperKit");
  const [font, setFont] = useState("Arial");
  const [color, setColor] = useState("#ffffff");
  const [opacity, setOpacity] = useState(65);
  const [size, setSize] = useState(42);
  const [rotation, setRotation] = useState(-25);
  const [position, setPosition] = useState<Position>("bottom-right");
  const [margin, setMargin] = useState(30);
  const [quality, setQuality] = useState(92);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">(
    "image/jpeg"
  );
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    return () => {
      if (source.startsWith("blob:")) URL.revokeObjectURL(source);
      if (logo.startsWith("blob:")) URL.revokeObjectURL(logo);
    };
  }, [source, logo]);

  useEffect(() => {
    if (!source) {
      imageRef.current = null;
      setReady(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setReady(true);
    };
    img.onerror = () => {
      setError("Could not load this image.");
      setReady(false);
    };
    img.src = source;
  }, [source]);

  useEffect(() => {
    if (!logo) {
      logoRef.current = null;
      return;
    }

    const img = new Image();
    img.onload = () => {
      logoRef.current = img;
      drawPreview();
    };
    img.onerror = () => setError("Could not load the watermark logo.");
    img.src = logo;
  }, [logo]);

  useEffect(() => {
    drawPreview();
    // Preview is refreshed when watermark settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    text,
    type,
    font,
    color,
    opacity,
    size,
    rotation,
    position,
    margin,
    logo,
  ]);

  function drawWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const scaledSize = Math.max(10, size * (width / 900));

    if (position === "repeat") {
      if (type === "text" && text.trim()) {
        ctx.font = `bold ${scaledSize}px ${font}`;
        const stepX = Math.max(140, text.length * scaledSize * 0.85);
        const stepY = Math.max(100, scaledSize * 3);

        for (let y = -height; y < height * 2; y += stepY) {
          for (let x = -width; x < width * 2; x += stepX) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.fillText(text, 0, 0);
            ctx.restore();
          }
        }
      } else if (type === "image" && logoRef.current) {
        const logoImage = logoRef.current;
        const logoWidth = scaledSize * 3;
        const logoHeight =
          (logoImage.height / logoImage.width) * logoWidth;

        for (let y = 0; y < height; y += logoHeight * 2.2) {
          for (let x = 0; x < width; x += logoWidth * 1.8) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(
              logoImage,
              -logoWidth / 2,
              -logoHeight / 2,
              logoWidth,
              logoHeight
            );
            ctx.restore();
          }
        }
      }
    } else {
      let x = width - margin * (width / 900);
      let y = height - margin * (width / 900);

      if (position === "center") {
        x = width / 2;
        y = height / 2;
      } else if (position === "top-left") {
        x = margin * (width / 900);
        y = margin * (width / 900);
      } else if (position === "top-right") {
        x = width - margin * (width / 900);
        y = margin * (width / 900);
      } else if (position === "bottom-left") {
        x = margin * (width / 900);
        y = height - margin * (width / 900);
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);

      if (type === "text") {
        ctx.font = `bold ${scaledSize}px ${font}`;
        ctx.textAlign =
          position.includes("left") ? "left" : position.includes("right")
            ? "right"
            : "center";
        ctx.textBaseline =
          position.includes("top") ? "top" : position.includes("bottom")
            ? "bottom"
            : "middle";
        ctx.fillText(text || "Watermark", 0, 0);
      } else if (logoRef.current) {
        const img = logoRef.current;
        const w = scaledSize * 3;
        const h = (img.height / img.width) * w;
        ctx.drawImage(
          img,
          position.includes("left") ? 0 : position.includes("right") ? -w : -w / 2,
          position.includes("top") ? 0 : position.includes("bottom") ? -h : -h / 2,
          w,
          h
        );
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function drawPreview() {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !img.complete) return;

    const maxWidth = 1000;
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawWatermark(ctx, canvas.width, canvas.height);
  }

  function selectImage(file?: File, watermarkLogo = false) {
    if (!file) return;

    setError("");
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      setError("Please choose a supported image file.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError("Please choose an image smaller than 25 MB.");
      return;
    }

    const url = URL.createObjectURL(file);

    if (watermarkLogo) {
      setLogo(url);
      setType("image");
    } else {
      setSource(url);
      setFilename(file.name.replace(/\.[^.]+$/, "") || "image");
    }
  }

  function downloadImage() {
    const img = imageRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // JPEG cannot preserve transparency, so flatten onto white.
    if (format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0);
    drawWatermark(ctx, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not export the image. Try another format.");
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const extension =
          format === "image/png" ? "png" :
          format === "image/webp" ? "webp" : "jpg";

        a.href = url;
        a.download = `${filename}-watermarked.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      format,
      quality / 100
    );
  }

  return (
    <main className="min-h-screen bg-[#fafbf9] px-4 py-10 text-[#202820] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mb-4 inline-flex rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm text-emerald-700 shadow-sm">
            ✦ Free image tool
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Add <span className="text-emerald-600">Watermark</span>
          </h1>
          <p className="mt-4 leading-7 text-gray-500">
            Protect your photos with custom text or logo watermarks.
            Adjust the style, position, transparency, and rotation.
          </p>
        </header>

        <section className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-6 border-b border-gray-100 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <div>
                <h2 className="font-semibold">1. Upload image</h2>
                <p className="mt-1 text-sm text-gray-500">
                  JPG, PNG or WebP · Max 25 MB
                </p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-3 w-full rounded-xl border border-dashed border-gray-300 px-4 py-4 text-sm font-medium hover:border-emerald-400 hover:bg-emerald-50/50"
                >
                  + Choose image
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => selectImage(e.target.files?.[0])}
                />
                {source && (
                  <p className="mt-2 truncate text-xs text-gray-500">
                    {filename}
                  </p>
                )}
              </div>

              <div>
                <h2 className="mb-3 font-semibold">2. Watermark type</h2>
                <div className="grid grid-cols-2 gap-2">
                  {(["text", "image"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setType(item)}
                      className={`rounded-xl border px-3 py-3 text-sm font-medium capitalize ${
                        type === item
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {item === "text" ? "T Text" : "▧ Logo"}
                    </button>
                  ))}
                </div>

                {type === "text" ? (
                  <div className="mt-3 space-y-3">
                    <label className="block text-sm text-gray-600">
                      Watermark text
                      <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        maxLength={100}
                        placeholder="Your brand or copyright"
                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="block text-sm text-gray-600">
                      Font
                      <select
                        value={font}
                        onChange={(e) => setFont(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                      </select>
                    </label>
                  </div>
                ) : (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => watermarkInputRef.current?.click()}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm hover:bg-gray-50"
                    >
                      {logo ? "Choose another logo" : "Upload watermark logo"}
                    </button>
                    <input
                      ref={watermarkInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => selectImage(e.target.files?.[0], true)}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      A transparent PNG logo works best.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h2 className="mb-3 font-semibold">3. Appearance</h2>
                {type === "text" && (
                  <label className="mb-4 flex items-center justify-between text-sm text-gray-600">
                    Text color
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent"
                    />
                  </label>
                )}

                <label className="mb-4 block text-sm text-gray-600">
                  Size <span className="float-right">{size}px</span>
                  <input
                    type="range"
                    min="12"
                    max="120"
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="mt-3 w-full accent-emerald-600"
                  />
                </label>

                <label className="mb-4 block text-sm text-gray-600">
                  Opacity <span className="float-right">{opacity}%</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="mt-3 w-full accent-emerald-600"
                  />
                </label>

                <label className="mb-4 block text-sm text-gray-600">
                  Rotation <span className="float-right">{rotation}°</span>
                  <input
                    type="range"
                    min="-90"
                    max="90"
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="mt-3 w-full accent-emerald-600"
                  />
                </label>

                <label className="block text-sm text-gray-600">
                  Position
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as Position)}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3"
                  >
                    <option value="bottom-right">Bottom right</option>
                    <option value="bottom-left">Bottom left</option>
                    <option value="top-right">Top right</option>
                    <option value="top-left">Top left</option>
                    <option value="center">Center</option>
                    <option value="repeat">Repeat / tiled</option>
                  </select>
                </label>

                {position !== "repeat" && (
                  <label className="mt-4 block text-sm text-gray-600">
                    Edge margin <span className="float-right">{margin}px</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={margin}
                      onChange={(e) => setMargin(Number(e.target.value))}
                      className="mt-3 w-full accent-emerald-600"
                    />
                  </label>
                )}
              </div>

              <div>
                <h2 className="mb-3 font-semibold">4. Export format</h2>
                <select
                  value={format}
                  onChange={(e) =>
                    setFormat(e.target.value as typeof format)
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                >
                  <option value="image/jpeg">JPG</option>
                  <option value="image/png">PNG (supports transparency)</option>
                  <option value="image/webp">WebP</option>
                </select>
                {format !== "image/png" && (
                  <label className="mt-4 block text-sm text-gray-600">
                    Quality <span className="float-right">{quality}%</span>
                    <input
                      type="range"
                      min="40"
                      max="100"
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="mt-3 w-full accent-emerald-600"
                    />
                  </label>
                )}
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={!ready || (type === "image" && !logo)}
                onClick={downloadImage}
                className="w-full rounded-xl bg-emerald-600 px-4 py-4 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                ↓ Download watermarked image
              </button>
            </aside>

            <div className="min-w-0 bg-[#fafbf9] p-5 sm:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Live preview</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Changes appear as you customize your watermark.
                  </p>
                </div>
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500">
                  {ready ? "Preview ready" : "Waiting for image"}
                </span>
              </div>

              <div className="flex min-h-[350px] items-center justify-center overflow-auto rounded-2xl border border-gray-200 bg-white p-3 sm:min-h-[500px]">
                {source ? (
                  <canvas
                    ref={canvasRef}
                    className="h-auto max-h-[650px] max-w-full object-contain"
                    style={{ width: "auto" }}
                  />
                ) : (
                  <div className="max-w-xs px-6 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
                      ◈
                    </div>
                    <p className="font-semibold text-gray-700">
                      Your image preview
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      Upload an image to start adding your watermark.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-500">
                <span className="font-semibold text-gray-700">Tip:</span>{" "}
                Use a subtle watermark for photos, or a repeated pattern to
                make branding more difficult to crop out.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ["Text or logo", "Add a brand name, copyright notice, or image logo."],
            ["Customize the style", "Control size, opacity, rotation, and position."],
            ["Download your image", "Export the watermarked image in your chosen format."],
          ].map(([title, description], i) => (
            <article
              key={title}
              className="rounded-2xl border border-gray-200/80 bg-white p-5"
            >
              <span className="text-sm font-semibold text-emerald-600">
                0{i + 1}
              </span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                {description}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">More image tools</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Compress Image", "/compress-image"],
              ["Resize Image", "/resize-image"],
              ["Crop Image", "/crop-image"],
              ["Convert Image", "/convert-image"],
              ["Background Remover", "/background-remover"],
              ["JPG to PDF", "/jpg-to-pdf"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium transition hover:border-emerald-300 hover:text-emerald-700"
              >
                {label} <span className="float-right">↗</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
