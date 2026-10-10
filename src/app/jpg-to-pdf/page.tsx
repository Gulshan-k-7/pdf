
"use client";

import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { PDFDocument } from "pdf-lib";

type ImageItem = {
  id: string;
  file: File;
  preview: string;
};

type PageSize = "a4" | "letter";

export default function JpgToPdfPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<
    "portrait" | "landscape"
  >("portrait");
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [progress, setProgress] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<ImageItem[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.preview)
      );
    };
  }, []);

  function addImages(files: FileList | File[]) {
    const selectedFiles = Array.from(files);
    const validFiles = selectedFiles.filter(
      (file) =>
        file.type.startsWith("image/") &&
        file.type !== "image/svg+xml"
    );

    if (validFiles.length !== selectedFiles.length) {
      setError("Some files were skipped. Please select image files.");
    } else {
      setError("");
    }

    const newImages: ImageItem[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((previous) => [...previous, ...newImages]);
    setSuccess("");
    setProgress(0);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addImages(e.target.files);
      e.target.value = "";
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    addImages(e.dataTransfer.files);
  }

  function removeImage(id: string) {
    setImages((previous) => {
      const removed = previous.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return previous.filter((image) => image.id !== id);
    });
    setSuccess("");
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImages((previous) => {
      const next = [...previous];
      const target = index + direction;

      if (target < 0 || target >= next.length) return previous;

      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSuccess("");
  }


  async function imageToJpeg(file: File): Promise<Uint8Array> {
    const bitmap = await createImageBitmap(file);

    try {
      // Resize large images before adding them to the PDF.
      const MAX_DIMENSION = 2200;
      const scale = Math.min(
        1,
        MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
      );

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not process this image.");
      }

      // Use a white background for transparent images.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      // JPEG compression significantly reduces photo sizes.
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error("Image compression failed."));
          },
          "image/jpeg",
          0.78
        );
      });

      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      bitmap.close();
    }
  }

  async function convertToPdf() {
    if (images.length === 0 || isConverting) return;

    setIsConverting(true);
    setError("");
    setSuccess("");
    setProgress(0);

    try {
      const pdf = await PDFDocument.create();

      let width = pageSize === "a4" ? 595.28 : 612;
      let height = pageSize === "a4" ? 841.89 : 792;

      if (orientation === "landscape") {
        [width, height] = [height, width];
      }

      for (let i = 0; i < images.length; i++) {
        const jpegBytes = await imageToJpeg(images[i].file);
        const embeddedImage = await pdf.embedJpg(jpegBytes);

        const page = pdf.addPage([width, height]);
        const margin = 2;
        const availableWidth = width - margin * 2;
        const availableHeight = height - margin * 2;

        const scale = Math.min(
          availableWidth / embeddedImage.width,
          availableHeight / embeddedImage.height
        );

        const imageWidth = embeddedImage.width * scale;
        const imageHeight = embeddedImage.height * scale;

        page.drawImage(embeddedImage, {
          x: (width - imageWidth) / 2,
          y: (height - imageHeight) / 2,
          width: imageWidth,
          height: imageHeight,
        });

        setProgress(Math.round(((i + 1) / images.length) * 100));
      }

      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "paperkit-images.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess("Your PDF is ready and has been downloaded!");
    } catch (err) {
      console.error(err);
      setError(
        "Could not create the PDF. Try a different image or a smaller file."
      );
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 pb-20 pt-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/image"
          className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"
        >
          <span aria-hidden="true">←</span> Image tools
        </Link>

        <header className="mx-auto mb-10 mt-7 max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-100 bg-white text-2xl shadow-sm">
            📄
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            JPG to PDF Converter
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
            Turn your images into a PDF in seconds. Add multiple
            pictures, arrange them, and download one document.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-7">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {images.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition ${isDragging
                ? "border-violet-400 bg-violet-50"
                : "border-slate-200 bg-slate-50/70"
                }`}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                🖼️
              </div>

              <h2 className="text-lg font-semibold">
                Upload your images
              </h2>

              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Choose JPG, PNG, WebP, or other browser-supported
                image formats. You can select multiple images.
              </p>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Choose images
              </button>

              <p className="mt-4 text-xs text-slate-400">
                Or drag and drop your images here
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Your images
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {images.length} image{images.length !== 1 ? "s" : ""}{" "}
                    · PDF pages follow this order
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium transition hover:bg-slate-50"
                >
                  + Add images
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    <div className="relative flex h-36 items-center justify-center bg-slate-50 p-2">
                      <img
                        src={image.preview}
                        alt={image.file.name}
                        className="max-h-full max-w-full object-contain"
                      />

                      <button
                        type="button"
                        aria-label={`Remove ${image.file.name}`}
                        onClick={() => removeImage(image.id)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-lg text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-600"
                      >
                        ×
                      </button>

                      <span className="absolute bottom-2 left-2 rounded-lg bg-white/95 px-2 py-1 text-xs font-medium shadow-sm">
                        Page {index + 1}
                      </span>
                    </div>

                    <div className="p-3">
                      <p
                        title={image.file.name}
                        className="truncate text-xs font-medium text-slate-700"
                      >
                        {image.file.name}
                      </p>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveImage(index, -1)}
                          className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ←
                        </button>

                        <button
                          type="button"
                          disabled={index === images.length - 1}
                          onClick={() => moveImage(index, 1)}
                          className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 border-t border-slate-100 pt-6">
                <h3 className="font-semibold">PDF settings</h3>

                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="page-size"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Page size
                    </label>
                    <select
                      id="page-size"
                      value={pageSize}
                      onChange={(e) =>
                        setPageSize(e.target.value as PageSize)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400"
                    >
                      <option value="a4">A4</option>
                      <option value="letter">US Letter</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="orientation"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Page orientation
                    </label>
                    <select
                      id="orientation"
                      value={orientation}
                      onChange={(e) =>
                        setOrientation(
                          e.target.value as "portrait" | "landscape"
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-400"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </div>

                {isConverting && (
                  <div className="mt-6">
                    <div className="mb-2 flex justify-between text-sm text-slate-500">
                      <span>Creating your PDF...</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-violet-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}

                {success && (
                  <p
                    role="status"
                    className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
                  >
                    {success}
                  </p>
                )}

                <button
                  type="button"
                  onClick={convertToPdf}
                  disabled={images.length === 0 || isConverting}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isConverting
                    ? "Creating PDF..."
                    : "↓  Convert & Download PDF"}
                </button>

                <p className="mt-3 text-center text-xs text-slate-400">
                  Your images are processed locally in your browser.
                </p>
              </div>
            </>
          )}
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Multiple images",
              description: "Combine several pictures into one PDF.",
            },
            {
              title: "Your preferred order",
              description: "Move images up or down before converting.",
            },
            {
              title: "Private processing",
              description: "Images are not sent to your server by this tool.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-white p-5"
            >
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {item.description}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-8 text-center text-sm text-slate-500">
          Need another tool?{" "}
          <Link
            href="/pdf"
            className="font-medium text-violet-700 hover:underline"
          >
            Explore PDF tools
          </Link>
        </div>
      </div>
    </main>
  );
}
