
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import heic2any from "heic2any";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function HeicToJpgPage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState("");

  const [quality, setQuality] = useState(90);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

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
    setProgress("");
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    clearResult();

    const extension = selected.name.split(".").pop()?.toLowerCase();
    const isHeic =
      extension === "heic" ||
      extension === "heif" ||
      selected.type === "image/heic" ||
      selected.type === "image/heif";

    if (!isHeic) {
      setFile(null);
      setError("Please select a HEIC or HEIF image.");
      event.target.value = "";
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("The maximum upload size is 50 MB.");
      event.target.value = "";
      return;
    }

    setFile(selected);
    setPreviewUrl("");
    setError("");
  }

  async function handleConvert() {
    if (!file) {
      setError("Please upload a HEIC image first.");
      return;
    }

    setIsConverting(true);
    clearResult();
    setProgress("Reading your HEIC image...");

    try {
      const converted = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: quality / 100,
      });

      // heic2any can return an array when converting multiple images.
      const outputBlob = Array.isArray(converted)
        ? converted[0]
        : converted;

      if (!(outputBlob instanceof Blob) || outputBlob.size === 0) {
        throw new Error("The converter did not produce a valid JPG.");
      }

      const jpgBlob = new Blob([outputBlob], {
        type: "image/jpeg",
      });

      setResultBlob(jpgBlob);
      setResultUrl(URL.createObjectURL(jpgBlob));
      setProgress("Conversion complete!");
    } catch (err) {
      console.error("HEIC conversion error:", err);

      setError(
        "Could not convert this file. Make sure it is a valid HEIC/HEIF photo and try again."
      );
      setProgress("");
    } finally {
      setIsConverting(false);
    }
  }

  const sizeDifference =
    file && resultBlob ? file.size - resultBlob.size : 0;

  const sizeChangePercent =
    file && resultBlob && file.size > 0
      ? (sizeDifference / file.size) * 100
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
            HEIC to JPG
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Convert iPhone HEIC and HEIF photos to JPG for better
            compatibility with websites, apps, and devices.
          </p>
        </header>

        <section className="rounded-3xl border border-white bg-white/80 p-5 shadow-[0_16px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-8">
          <input
            ref={inputRef}
            type="file"
            accept=".heic,.heif,image/heic,image/heif"
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
                📱
              </span>

              <span className="text-lg font-semibold">
                Upload HEIC photo
              </span>

              <span className="mt-2 text-sm text-slate-500">
                Select a .heic or .heif file · Maximum 50 MB
              </span>

              <span className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                Choose HEIC image
              </span>
            </button>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Selected photo</p>
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {file.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatSize(file.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Change photo
                </button>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  JPG quality
                </div>

                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    {quality < 70
                      ? "Smaller file"
                      : quality < 90
                      ? "Balanced"
                      : "High quality"}
                  </span>
                  <span className="text-sm font-semibold text-emerald-700">
                    {quality}%
                  </span>
                </div>

                <input
                  type="range"
                  min="40"
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
                  <span>Smaller size</span>
                  <span>Better quality</span>
                </div>
              </div>

              <button
                type="button"
                disabled={isConverting}
                onClick={handleConvert}
                className="mt-5 flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConverting ? "Converting photo..." : "Convert to JPG"}
              </button>

              {isConverting && (
                <p className="mt-3 text-center text-sm text-slate-500">
                  {progress} This may take a little while for large photos.
                </p>
              )}
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

          {resultBlob && resultUrl && file && (
            <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold">
                    JPG conversion complete!
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Your image is ready to download.
                  </p>
                </div>

                <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  JPG
                </span>
              </div>

              <div className="mt-5 rounded-xl bg-white p-4">
                <img
                  src={resultUrl}
                  alt="Converted JPG preview"
                  className="mx-auto max-h-96 rounded-lg object-contain"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">Original HEIC</p>
                  <p className="mt-2 text-lg font-bold">
                    {formatSize(file.size)}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-500">Converted JPG</p>
                  <p className="mt-2 text-lg font-bold text-emerald-700">
                    {formatSize(resultBlob.size)}
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
                href={resultUrl}
                download={`${file.name.replace(/\.[^.]+$/, "")}.jpg`}
                className="mt-5 flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                ↓ Download JPG
              </a>

              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                Conversion happens in your browser. JPG does not support
                transparency, and some HEIC metadata may not be preserved.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-white bg-white/70 p-6">
          <h2 className="font-semibold">Explore more tools</h2>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/convert-image"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              Convert Image Format →
            </Link>

            <Link
              href="/compress-image"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              Compress Image →
            </Link>

            <Link
              href="/resize-image"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              Resize Image →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
