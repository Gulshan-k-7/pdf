"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

type PageThumbnail = {
    pageNumber: number;
    image: string;
};

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DeletePagesPage() {
    const inputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);

    const [pageCount, setPageCount] = useState(0);

    const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);

    const [deletedPages, setDeletedPages] = useState<number[]>(
        [],
    );

    const [loadingPages, setLoadingPages] = useState(false);

    const [processing, setProcessing] = useState(false);

    const [progress, setProgress] = useState(0);

    const [result, setResult] = useState<Blob | null>(null);

    const [error, setError] = useState("");

    const generateThumbnails = async (
        selectedFile: File,
    ) => {
        setLoadingPages(true);
        setError("");

        try {
            const arrayBuffer =
                await selectedFile.arrayBuffer();

            const pdf = await pdfjsLib.getDocument({
                data: arrayBuffer,
            }).promise;

            const totalPages = pdf.numPages;

            setPageCount(totalPages);

            const generatedThumbnails: PageThumbnail[] = [];

            for (
                let pageNumber = 1;
                pageNumber <= totalPages;
                pageNumber++
            ) {
                const page = await pdf.getPage(pageNumber);

                const viewport = page.getViewport({
                    scale: 0.7,
                });

                const canvas =
                    document.createElement("canvas");

                const context = canvas.getContext("2d");

                if (!context) {
                    continue;
                }

                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);

                await page.render({
                    canvas,
                    canvasContext: context,
                    viewport,
                    background: "white",
                }).promise;

                const image = canvas.toDataURL(
                    "image/jpeg",
                    0.75,
                );

                generatedThumbnails.push({
                    pageNumber,
                    image,
                });

                page.cleanup();

                setProgress(
                    Math.round(
                        (pageNumber / totalPages) * 100,
                    ),
                );
            }

            setThumbnails(generatedThumbnails);
        } catch (err) {
            console.error(err);

            setError(
                "Unable to read this PDF. Please try another file.",
            );
        } finally {
            setLoadingPages(false);
            setProgress(0);
        }
    };

    const handleFile = async (selectedFile: File) => {
        setError("");
        setResult(null);
        setDeletedPages([]);
        setThumbnails([]);
        setPageCount(0);

        if (selectedFile.type !== "application/pdf") {
            setError("Please select a PDF file.");
            return;
        }

        if (selectedFile.size > MAX_FILE_SIZE) {
            setError("Maximum file size is 50 MB.");
            return;
        }

        setFile(selectedFile);

        await generateThumbnails(selectedFile);
    };

    const handleInputChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const selectedFile =
            event.target.files?.[0];

        if (selectedFile) {
            handleFile(selectedFile);
        }
    };

    const togglePage = (pageNumber: number) => {
        setDeletedPages((current) => {
            if (current.includes(pageNumber)) {
                return current.filter(
                    (page) => page !== pageNumber,
                );
            }

            return [...current, pageNumber].sort(
                (a, b) => a - b,
            );
        });
    };

    const selectAllPages = () => {
        const allPages = Array.from(
            { length: pageCount },
            (_, index) => index + 1,
        );

        setDeletedPages(allPages);
    };

    const clearSelection = () => {
        setDeletedPages([]);
    };

    const deleteSelectedPages = async () => {
        if (!file) return;

        if (deletedPages.length === 0) {
            setError("Select at least one page to delete.");
            return;
        }

        if (deletedPages.length === pageCount) {
            setError(
                "You cannot delete every page. Keep at least one page.",
            );
            return;
        }

        try {
            setProcessing(true);
            setError("");

            const arrayBuffer =
                await file.arrayBuffer();

            const sourcePdf =
                await PDFDocument.load(arrayBuffer);

            const newPdf =
                await PDFDocument.create();

            const pagesToKeep = Array.from(
                { length: pageCount },
                (_, index) => index + 1,
            ).filter(
                (pageNumber) =>
                    !deletedPages.includes(pageNumber),
            );

            const pageIndexes = pagesToKeep.map(
                (pageNumber) => pageNumber - 1,
            );

            const copiedPages =
                await newPdf.copyPages(
                    sourcePdf,
                    pageIndexes,
                );

            copiedPages.forEach((page) => {
                newPdf.addPage(page);
            });

            const newPdfBytes = await newPdf.save({
                useObjectStreams: true,
                addDefaultPage: false,
            });

            const blob = new Blob([newPdfBytes], {
                type: "application/pdf",
            });

            setResult(blob);
        } catch (err) {
            console.error(err);

            setError(
                "Something went wrong while deleting the pages.",
            );
        } finally {
            setProcessing(false);
        }
    };

    const downloadPdf = () => {
        if (!result) return;

        const url = URL.createObjectURL(result);

        const link = document.createElement("a");

        link.href = url;
        link.download = "paperkit-pages-deleted.pdf";

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);
    };
    const [previewPage, setPreviewPage] = useState<PageThumbnail | null>(null);

    const reset = () => {
        setFile(null);
        setPageCount(0);
        setThumbnails([]);
        setDeletedPages([]);
        setResult(null);
        setError("");
        setProgress(0);

        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    PDF TOOL
                </p>

                <h1 className="text-4xl font-semibold tracking-[-0.055em] text-neutral-950 sm:text-5xl">
                    Delete PDF Pages
                </h1>

                <p className="mx-auto mt-4 max-w-lg text-sm leading-6 tracking-[-0.01em] text-neutral-500 sm:text-base">
                    Select the pages you don't need and remove them
                    from your PDF.
                </p>
            </div>

            <div className="mx-auto mt-12 max-w-5xl">
                {!file && (
                    <>
                        <button
                            type="button"
                            onClick={() =>
                                inputRef.current?.click()
                            }
                            className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-black/[0.1] bg-white/60 px-6 py-12 text-center shadow-sm shadow-black/[0.02] backdrop-blur-xl transition-all duration-200 hover:border-black/[0.18] hover:bg-white"
                        >
                            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-xl font-semibold text-red-600">
                                ×
                            </div>

                            <strong className="text-base font-semibold tracking-[-0.02em] text-neutral-900">
                                Upload your PDF
                            </strong>

                            <span className="mt-2 text-sm text-neutral-400">
                                Select the pages you want to delete
                            </span>

                            <span className="mt-7 inline-flex h-11 items-center rounded-xl bg-neutral-950 px-6 text-sm font-medium text-white">
                                Choose PDF
                            </span>

                            <small className="mt-4 text-[11px] tracking-[0.02em] text-neutral-400">
                                PDF files up to 50 MB
                            </small>
                        </button>

                        <input
                            ref={inputRef}
                            type="file"
                            accept="application/pdf"
                            onChange={handleInputChange}
                            className="hidden"
                        />
                    </>
                )}

                {file && !result && (
                    <div className="rounded-3xl border border-black/[0.06] bg-white/70 p-5 shadow-sm shadow-black/[0.03] backdrop-blur-xl sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[11px] font-semibold text-red-600">
                                    PDF
                                </div>

                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-neutral-900">
                                        {file.name}
                                    </p>

                                    <p className="mt-1 text-xs text-neutral-400">
                                        {formatBytes(file.size)} ·{" "}
                                        {pageCount}{" "}
                                        {pageCount === 1
                                            ? "page"
                                            : "pages"}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={reset}
                                className="self-start text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-900 sm:self-auto"
                            >
                                Choose another
                            </button>
                        </div>

                        {loadingPages && (
                            <div className="mt-8">
                                <div className="mb-2 flex items-center justify-between text-[11px] text-neutral-400">
                                    <span>
                                        Preparing pages...
                                    </span>

                                    <span>
                                        {progress}%
                                    </span>
                                </div>

                                <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                                    <div
                                        className="h-full rounded-full bg-neutral-950 transition-all duration-200"
                                        style={{
                                            width: `${progress}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {!loadingPages &&
                            thumbnails.length > 0 && (
                                <>
                                    <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold tracking-[-0.02em] text-neutral-900">
                                                Select pages to delete
                                            </p>

                                            <p className="mt-1 text-xs text-neutral-400">
                                                Tap a page to mark it for deletion.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={selectAllPages}
                                                className="rounded-xl border border-black/[0.07] bg-white px-4 py-2.5 text-xs font-medium text-neutral-600 transition-all hover:border-black/[0.15] hover:text-neutral-900"
                                            >
                                                Select all
                                            </button>

                                            <button
                                                type="button"
                                                onClick={clearSelection}
                                                className="rounded-xl border border-black/[0.07] bg-white px-4 py-2.5 text-xs font-medium text-neutral-600 transition-all hover:border-black/[0.15] hover:text-neutral-900"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                        {thumbnails.map((page) => (
                                            <div
                                                key={page.pageNumber}
                                                className={`group relative overflow-hidden rounded-2xl border bg-white ${deletedPages.includes(page.pageNumber)
                                                        ? "border-red-400 ring-2 ring-red-100"
                                                        : "border-black/[0.08]"
                                                    }`}
                                            >
                                                <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                                                    <img
                                                        src={page.image}
                                                        alt={`Page ${page.pageNumber}`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] p-3">
                                                    <span className="text-xs font-medium text-neutral-500">
                                                        Page {page.pageNumber}
                                                    </span>

                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewPage(page)}
                                                            className="flex h-9 items-center justify-center rounded-lg border border-black/[0.08] bg-white px-3 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
                                                        >
                                                            View
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => togglePage(page.pageNumber)}
                                                            className={`flex h-9 items-center justify-center rounded-lg px-3 text-xs font-medium transition ${deletedPages.includes(page.pageNumber)
                                                                    ? "bg-red-500 text-white hover:bg-red-600"
                                                                    : "bg-neutral-950 text-white hover:bg-neutral-800"
                                                                }`}
                                                        >
                                                            {deletedPages.includes(page.pageNumber) ? "Selected" : "Select"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="sticky bottom-4 z-10 mt-8">
                                        <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white/90 p-3 shadow-xl shadow-black/[0.08] backdrop-blur-xl sm:flex-row sm:items-center">
                                            <div className="flex-1 px-2">
                                                <p className="text-sm font-semibold text-neutral-900">
                                                    {deletedPages.length}{" "}
                                                    {deletedPages.length === 1
                                                        ? "page"
                                                        : "pages"}{" "}
                                                    selected for deletion
                                                </p>

                                                <p className="mt-1 text-[11px] text-neutral-400">
                                                    {pageCount -
                                                        deletedPages.length}{" "}
                                                    {pageCount -
                                                        deletedPages.length ===
                                                        1
                                                        ? "page"
                                                        : "pages"}{" "}
                                                    will remain.
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={
                                                    deleteSelectedPages
                                                }
                                                disabled={
                                                    deletedPages.length === 0 ||
                                                    processing ||
                                                    deletedPages.length ===
                                                    pageCount
                                                }
                                                className="flex h-12 items-center justify-center rounded-xl bg-red-500 px-7 text-sm font-medium text-white transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {processing
                                                    ? "Deleting pages..."
                                                    : "Delete selected pages"}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                        {error && (
                            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                                {error}
                            </div>
                        )}

                        <p className="mt-6 text-center text-[11px] leading-5 text-neutral-400">
                            Your PDF stays in your browser and is not
                            uploaded.
                        </p>
                    </div>
                )}

                {result && file && (
                    <div className="mx-auto max-w-2xl rounded-3xl border border-black/[0.06] bg-white/70 p-6 text-center shadow-sm shadow-black/[0.03] backdrop-blur-xl">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-600">
                            ✓
                        </div>

                        <h2 className="mt-5 text-xl font-semibold tracking-[-0.035em] text-neutral-950">
                            Pages deleted successfully
                        </h2>

                        <p className="mt-2 text-sm text-neutral-500">
                            Your new PDF is ready to download.
                        </p>

                        <div className="mx-auto mt-7 grid max-w-md grid-cols-3 gap-2">
                            <div className="rounded-xl bg-neutral-50 px-3 py-4">
                                <span className="block text-[10px] uppercase tracking-[0.08em] text-neutral-400">
                                    Original
                                </span>

                                <strong className="mt-1 block text-sm font-semibold text-neutral-900">
                                    {pageCount}
                                </strong>
                            </div>

                            <div className="rounded-xl bg-neutral-50 px-3 py-4">
                                <span className="block text-[10px] uppercase tracking-[0.08em] text-neutral-400">
                                    Deleted
                                </span>

                                <strong className="mt-1 block text-sm font-semibold text-red-500">
                                    {deletedPages.length}
                                </strong>
                            </div>

                            <div className="rounded-xl bg-neutral-50 px-3 py-4">
                                <span className="block text-[10px] uppercase tracking-[0.08em] text-neutral-400">
                                    Remaining
                                </span>

                                <strong className="mt-1 block text-sm font-semibold text-neutral-900">
                                    {pageCount -
                                        deletedPages.length}
                                </strong>
                            </div>
                        </div>

                        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
                            <button
                                type="button"
                                onClick={downloadPdf}
                                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-neutral-950 text-sm font-medium text-white transition-all hover:bg-neutral-800"
                            >
                                Download PDF
                            </button>

                            <button
                                type="button"
                                onClick={reset}
                                className="flex h-12 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-6 text-sm font-medium text-neutral-700 transition-all hover:border-black/[0.15] hover:bg-neutral-50"
                            >
                                Delete from another PDF
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <section className="mx-auto mt-20 max-w-4xl">
                <div className="mb-6 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                        YOU MAY ALSO NEED
                    </p>

                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-neutral-950">
                        More PDF tools
                    </h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Link
                        href="/tools/split-pdf"
                        className="group rounded-2xl border border-black/[0.06] bg-white/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                            ✂
                        </div>

                        <h3 className="mt-4 text-sm font-semibold text-neutral-900">
                            Split PDF
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-neutral-400">
                            Extract selected pages into a new PDF.
                        </p>
                    </Link>

                    <Link
                        href="/tools/merge-pdf"
                        className="group rounded-2xl border border-black/[0.06] bg-white/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                            +
                        </div>

                        <h3 className="mt-4 text-sm font-semibold text-neutral-900">
                            Merge PDF
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-neutral-400">
                            Combine multiple PDF files into one.
                        </p>
                    </Link>

                    <Link
                        href="/tools/compress-pdf"
                        className="group rounded-2xl border border-black/[0.06] bg-white/60 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-black/[0.04]"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                            ↓
                        </div>

                        <h3 className="mt-4 text-sm font-semibold text-neutral-900">
                            Compress PDF
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-neutral-400">
                            Reduce the size of your PDF.
                        </p>
                    </Link>
                </div>
            </section>
            {previewPage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    onClick={() => setPreviewPage(null)}
                >
                    <div
                        className="relative max-h-[95vh] max-w-5xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <img
                            src={previewPage.image}
                            alt={`Page ${previewPage.pageNumber}`}
                            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
                        />

                        <button
                            type="button"
                            onClick={() => setPreviewPage(null)}
                            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-xl text-white backdrop-blur-md transition hover:bg-black/80"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
