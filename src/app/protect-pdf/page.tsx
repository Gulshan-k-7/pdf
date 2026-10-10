"use client";

import { useState } from "react";
import Link from "next/link";
import { createPdfToolkit } from "pdfstudio";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

type Mode = "protect" | "unlock";

export default function ProtectPdfPage() {
  const [mode, setMode] = useState<Mode>("protect");
  const [file, setFile] = useState<File | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState("");

  const handleFile = (selectedFile: File) => {
    setError("");
    setResult(null);

    if (selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("PDF must be smaller than 50 MB.");
      return;
    }

    setFile(selectedFile);
  };

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    handleFile(selectedFile);
    event.target.value = "";
  };

  const protectPdf = async () => {
    if (!file) {
      setError("Please select a PDF first.");
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setProcessing(true);
    setError("");
    setResult(null);

    try {
      const pdf = await createPdfToolkit();

      const encrypted = await pdf.lock(file, {
        userPassword: password,
        ownerPassword: password,
        keyLength: 256,
      });

      const blob = new Blob([encrypted], {
        type: "application/pdf",
      });

      setResult(blob);
    } catch (err) {
      console.error(err);
      setError("Unable to protect this PDF.");
    } finally {
      setProcessing(false);
    }
  };

  const unlockPdf = async () => {
    if (!file) {
      setError("Please select a PDF first.");
      return;
    }

    if (!password) {
      setError("Please enter the PDF password.");
      return;
    }

    setProcessing(true);
    setError("");
    setResult(null);

    try {
      const pdf = await createPdfToolkit();

      const unlocked = await pdf.unlock(file, {
        password,
      });

      const blob = new Blob([unlocked], {
        type: "application/pdf",
      });

      setResult(blob);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to unlock the PDF. Check that the password is correct and the PDF is valid.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!result) {
      return;
    }

    const url = URL.createObjectURL(result);

    const link = document.createElement("a");

    link.href = url;
    link.download =
      mode === "protect"
        ? "paperkit-protected.pdf"
        : "paperkit-unlocked.pdf";

    link.click();

    URL.revokeObjectURL(url);
  };

  const changeMode = (newMode: Mode) => {
    setMode(newMode);
    setFile(null);
    setPassword("");
    setConfirmPassword("");
    setResult(null);
    setError("");
  };

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <section className="mx-auto max-w-4xl px-6 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <Link
            href="/pdf"
            className="inline-flex items-center text-xs font-medium text-neutral-400 transition hover:text-neutral-900"
          >
            ← Back to PDF tools
          </Link>

          <div className="mt-7 inline-flex items-center rounded-full border border-black/[0.07] bg-white/70 px-4 py-2 text-[11px] font-medium tracking-[0.12em] text-neutral-500 shadow-sm backdrop-blur-xl">
            PDF SECURITY
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-5xl">
            Protect PDF
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-neutral-500 sm:text-base">
            Add a password to your PDF or remove the password from a
            protected PDF.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          {/* Mode selector */}

          <div className="rounded-2xl border border-black/[0.06] bg-white/70 p-1.5 shadow-sm backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => changeMode("protect")}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition ${
                  mode === "protect"
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <span>🔒</span>
                Protect PDF
              </button>

              <button
                type="button"
                onClick={() => changeMode("unlock")}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition ${
                  mode === "unlock"
                    ? "bg-neutral-950 text-white shadow-sm"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <span>🔓</span>
                Unlock PDF
              </button>
            </div>
          </div>

          {/* Upload */}

          {!file && (
            <label className="group mt-6 flex min-h-[270px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-black/[0.12] bg-white/70 p-8 text-center backdrop-blur-xl transition hover:border-black/[0.2] hover:bg-white">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleInputChange}
                className="hidden"
              />

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-2xl transition group-hover:scale-105">
                {mode === "protect" ? "🔒" : "🔓"}
              </div>

              <h2 className="mt-5 text-base font-semibold tracking-[-0.02em] text-neutral-900">
                {mode === "protect"
                  ? "Upload PDF to protect"
                  : "Upload protected PDF"}
              </h2>

              <p className="mt-2 text-sm text-neutral-500">
                {mode === "protect"
                  ? "Add a password to secure your document"
                  : "Enter the existing password to unlock it"}
              </p>

              <span className="mt-5 rounded-xl bg-neutral-950 px-5 py-2.5 text-xs font-medium text-white transition group-hover:bg-neutral-800">
                Choose PDF
              </span>

              <p className="mt-4 text-[11px] text-neutral-400">
                Maximum file size: 50 MB
              </p>
            </label>
          )}

          {/* Selected file */}

          {file && (
            <div className="mt-6 rounded-3xl border border-black/[0.06] bg-white/70 p-5 shadow-sm backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-lg text-red-500">
                  PDF
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {file.name}
                  </p>

                  <p className="mt-1 text-xs text-neutral-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <label className="cursor-pointer rounded-xl border border-black/[0.08] bg-white px-4 py-2.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50">
                  Replace
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Password section */}

          {file && (
            <div className="mt-5 rounded-3xl border border-black/[0.06] bg-white/70 p-6 shadow-sm backdrop-blur-xl">
              <div>
                <h2 className="text-sm font-semibold tracking-[-0.02em] text-neutral-900">
                  {mode === "protect"
                    ? "Create a password"
                    : "Enter PDF password"}
                </h2>

                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  {mode === "protect"
                    ? "This password will be required whenever someone opens the protected PDF."
                    : "The password will only be used locally to decrypt your PDF."}
                </p>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    mode === "protect"
                      ? "Enter password"
                      : "Enter PDF password"
                  }
                  className="h-12 w-full rounded-xl border border-black/[0.08] bg-white px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-black/[0.2] focus:ring-4 focus:ring-black/[0.03]"
                />
              </div>

              {mode === "protect" && (
                <div className="mt-4">
                  <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                    Confirm password
                  </label>

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Confirm password"
                    className="h-12 w-full rounded-xl border border-black/[0.08] bg-white px-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-black/[0.2] focus:ring-4 focus:ring-black/[0.03]"
                  />
                </div>
              )}

              {mode === "protect" && (
                <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
                  <div className="flex gap-3">
                    <span className="text-sm">🔐</span>

                    <div>
                      <p className="text-xs font-semibold text-neutral-700">
                        Permanent password protection
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-neutral-400">
                        The downloaded PDF will remain encrypted. The
                        password will be required to open it.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={
                  mode === "protect" ? protectPdf : unlockPdf
                }
                disabled={processing}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-neutral-950 px-6 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing
                  ? mode === "protect"
                    ? "Protecting PDF..."
                    : "Unlocking PDF..."
                  : mode === "protect"
                    ? "Protect PDF"
                    : "Unlock PDF"}
              </button>
            </div>
          )}

          {/* Error */}

          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Result */}

          {result && (
            <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 backdrop-blur-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    {mode === "protect"
                      ? "Your PDF is protected"
                      : "Your PDF has been unlocked"}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-emerald-700">
                    {mode === "protect"
                      ? "The downloaded PDF requires your password to open."
                      : "The downloaded PDF no longer requires a password."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={downloadResult}
                  className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  Download PDF
                </button>
              </div>
            </div>
          )}

          {/* Privacy note */}

          <div className="mt-6 text-center">
            <p className="text-[11px] leading-5 text-neutral-400">
              🔒 Your PDF and password are processed locally in your
              browser. They are not uploaded to a server.
            </p>
          </div>

          {/* Related tools */}

          <div className="mt-12 border-t border-black/[0.06] pt-8">
            <p className="text-center text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
              Related PDF tools
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Link
                href="/tools/compress-pdf"
                className="rounded-2xl border border-black/[0.06] bg-white/70 p-4 text-center transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <span className="text-lg">◌</span>
                <p className="mt-2 text-xs font-semibold text-neutral-800">
                  Compress PDF
                </p>
              </Link>

              <Link
                href="/tools/merge-pdf"
                className="rounded-2xl border border-black/[0.06] bg-white/70 p-4 text-center transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <span className="text-lg">＋</span>
                <p className="mt-2 text-xs font-semibold text-neutral-800">
                  Merge PDF
                </p>
              </Link>

              <Link
                href="/tools/split-pdf"
                className="rounded-2xl border border-black/[0.06] bg-white/70 p-4 text-center transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <span className="text-lg">↗</span>
                <p className="mt-2 text-xs font-semibold text-neutral-800">
                  Split PDF
                </p>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}