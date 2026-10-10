"use client";

import Link from "next/link";
import { ChangeEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type Point = { x: number; y: number };
type Mark = { id: string; type: "text" | "draw" | "highlight" | "signature" | "image"; points?: Point[]; x: number; y: number; text?: string; color: string; width: number; height?: number; fontSize?: number; bold?: boolean; italic?: boolean; image?: string; imageType?: "png" | "jpg" };
type PageMark = { page: number; mark: Mark };
type Thumb = { page: number; src: string };
type Tool = "select" | "text" | "draw" | "highlight" | "signature" | "image";
type Transform = { id: string; mode: "move" | "resize"; pointerX: number; pointerY: number; x: number; y: number; width: number; height: number };

const LIMIT = 50 * 1024 * 1024;
const initialColor = "#2563eb";

function colorParts(hex: string) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255) as [number, number, number];
}

export default function EditPdfPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const selectedTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const activeStroke = useRef<Point[] | null>(null);
  const activeTextBox = useRef<Point | null>(null);
  const activeTransform = useRef<Transform | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [marks, setMarks] = useState<PageMark[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [textBoxPreview, setTextBoxPreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [color, setColor] = useState(initialColor);
  const [fontSize, setFontSize] = useState(22);
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    marks.filter((entry) => entry.page === page).forEach(({ mark }) => {
      const px = (point: Point) => ({ x: point.x * canvas.width, y: point.y * canvas.height });
      ctx.save();
      if (mark.points?.length) {
        ctx.beginPath();
        const first = px(mark.points[0]);
        ctx.moveTo(first.x, first.y);
        mark.points.slice(1).forEach((point) => { const p = px(point); ctx.lineTo(p.x, p.y); });
        ctx.strokeStyle = mark.type === "highlight" ? "rgba(250, 204, 21, .42)" : mark.color;
        ctx.lineWidth = Math.max(2, mark.width * canvas.width);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }
      ctx.restore();
    });
  }, [marks, page]);

  const renderPage = useCallback(async (number: number) => {
    if (!pdfBytes) return;
    setRendering(true);
    try {
      const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
      const pdfPage = await pdf.getPage(number);
      const viewport = pdfPage.getViewport({ scale: 1.65 });
      const canvas = pdfCanvasRef.current;
      const overlay = overlayRef.current;
      if (!canvas || !overlay) return;
      canvas.width = viewport.width; canvas.height = viewport.height;
      overlay.width = viewport.width; overlay.height = viewport.height;
      await pdfPage.render({ canvas, viewport }).promise;
      drawOverlay();
    } catch { setError("This PDF page could not be displayed. Try another file."); }
    finally { setRendering(false); }
  }, [pdfBytes, drawOverlay]);

  useEffect(() => { void renderPage(page); }, [page, renderPage]);
  useEffect(() => { drawOverlay(); }, [drawOverlay]);
  useEffect(() => {
    const selected = marks.find((entry) => entry.page === page && entry.mark.id === selectedMarkId && entry.mark.type === "text");
    if (selected) selectedTextAreaRef.current?.focus();
  }, [selectedMarkId, marks, page]);

  async function loadFile(selected: File) {
    setError(""); setNotice("");
    if (selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) { setError("Choose a PDF file to get started."); return; }
    if (selected.size > LIMIT) { setError("This file is larger than 50 MB. Choose a smaller PDF."); return; }
    setBusy(true);
    try {
      const bytes = await selected.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      setFile(selected); setPdfBytes(bytes); setPageCount(pdf.numPages); setPage(1); setMarks([]); setThumbs([]);
      const previews: Thumb[] = [];
      for (let index = 1; index <= pdf.numPages; index++) {
        const item = await pdf.getPage(index);
        const viewport = item.getViewport({ scale: 0.34 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width; canvas.height = viewport.height;
        await item.render({ canvas, viewport }).promise;
        previews.push({ page: index, src: canvas.toDataURL("image/jpeg", 0.72) });
      }
      setThumbs(previews);
    } catch { setError("We couldn’t open this PDF. It may be password-protected or damaged."); setFile(null); setPdfBytes(null); }
    finally { setBusy(false); }
  }

  function normalizedPoint(event: PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!file) return;
    const point = normalizedPoint(event);
    if (tool === "text") {
      event.currentTarget.setPointerCapture(event.pointerId);
      activeTextBox.current = point;
      setTextBoxPreview({ x: point.x, y: point.y, width: 0, height: 0 });
    } else if (tool === "select") {
      setSelectedMarkId(null);
    } else if (tool === "draw" || tool === "highlight" || tool === "signature") {
      event.currentTarget.setPointerCapture(event.pointerId);
      activeStroke.current = [point];
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (activeTextBox.current) {
      const start = activeTextBox.current;
      const end = normalizedPoint(event);
      setTextBoxPreview({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) });
      return;
    }
    if (!activeStroke.current) return;
    activeStroke.current.push(normalizedPoint(event));
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawOverlay();
    const points = activeStroke.current;
    ctx.beginPath(); ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
    points.slice(1).forEach((point) => ctx.lineTo(point.x * canvas.width, point.y * canvas.height));
    ctx.strokeStyle = tool === "highlight" ? "rgba(250, 204, 21, .42)" : color;
    ctx.lineWidth = tool === "highlight" ? 22 : tool === "signature" ? 4 : 3;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
  }

  function handlePointerUp(event?: PointerEvent<HTMLCanvasElement>) {
    if (activeTextBox.current) {
      const start = activeTextBox.current;
      const end = event ? normalizedPoint(event) : start;
      activeTextBox.current = null;
      const width = Math.max(0.22, Math.abs(end.x - start.x));
      const height = Math.max(0.08, Math.abs(end.y - start.y));
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const id = crypto.randomUUID();
      setMarks((current) => [...current, { page, mark: { id, type: "text", x: Math.min(x, 1 - width), y: Math.min(y, 1 - height), width, height, text: "", color, fontSize, bold, italic } }]);
      setSelectedMarkId(id);
      setTextBoxPreview(null);
      setTool("select");
      return;
    }
    if (!activeStroke.current) return;
    const points = activeStroke.current;
    activeStroke.current = null;
    const type: Mark["type"] = tool === "signature" ? "signature" : tool === "highlight" ? "highlight" : "draw";
    setMarks((current) => [...current, { page, mark: { id: crypto.randomUUID(), type, points, x: 0, y: 0, color, width: tool === "highlight" ? 0.022 : tool === "signature" ? 0.004 : 0.003 } }]);
  }

  function beginTransform(event: React.PointerEvent<HTMLElement>, mark: Mark, mode: Transform["mode"]) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedMarkId(mark.id);
    const bounds = pdfCanvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    activeTransform.current = { id: mark.id, mode, pointerX: event.clientX, pointerY: event.clientY, x: mark.x, y: mark.y, width: mark.width, height: mark.height ?? 0.08 };
  }

  function updateTransform(event: React.PointerEvent<HTMLElement>) {
    const active = activeTransform.current;
    const bounds = pdfCanvasRef.current?.getBoundingClientRect();
    if (!active || !bounds) return;
    const dx = (event.clientX - active.pointerX) / bounds.width;
    const dy = (event.clientY - active.pointerY) / bounds.height;
    setMarks((current) => current.map((entry) => {
      if (entry.mark.id !== active.id) return entry;
      const mark = { ...entry.mark };
      if (active.mode === "move") {
        mark.x = Math.max(0, Math.min(1 - mark.width, active.x + dx));
        mark.y = Math.max(0, Math.min(1 - (mark.height ?? 0), active.y + dy));
      } else {
        mark.width = Math.max(0.06, Math.min(1 - active.x, active.width + dx));
        mark.height = Math.max(0.05, Math.min(1 - active.y, active.height + dy));
      }
      return { ...entry, mark };
    }));
  }

  function endTransform() { activeTransform.current = null; }

  async function loadImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]; event.target.value = "";
    if (!selected) return;
    if (!selected.type.startsWith("image/")) { setError("Choose a PNG or JPG image."); return; }
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(selected); });
    const type = selected.type === "image/png" ? "png" : "jpg";
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => { const image = new Image(); image.onload = () => resolve({ width: image.width, height: image.height }); image.onerror = reject; image.src = data; });
    const canvas = pdfCanvasRef.current;
    if (!canvas) { setError("Open a PDF page before adding an image."); return; }
    const width = 0.3;
    const height = Math.min(0.6, width * dimensions.height / dimensions.width * canvas.width / canvas.height);
    const id = crypto.randomUUID();
    setMarks((current) => [...current, { page, mark: { id, type: "image", x: (1 - width) / 2, y: (1 - height) / 2, width, height, image: data, imageType: type, color } }]);
    setSelectedMarkId(id); setTool("select"); setNotice("Image added. Drag it to move, or use the corner handle to resize.");
  }

  async function exportPdf() {
    if (!pdfBytes) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const pdfDocument = await PDFDocument.load(pdfBytes);
      for (const { page: pageNumber, mark } of marks) {
        const target = pdfDocument.getPage(pageNumber - 1);
        const { width, height } = target.getSize();
        if (mark.type === "text") {
          const [r, g, b] = colorParts(mark.color);
          const fontName = mark.bold ? (mark.italic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold) : (mark.italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica);
          const textFont = await pdfDocument.embedFont(fontName);
          const size = mark.fontSize ?? fontSize;
          const maxWidth = mark.width * width;
          const lines: string[] = [];
          (mark.text ?? "").split("\n").forEach((paragraph) => {
            let line = "";
            for (const word of paragraph.split(/\s+/).filter(Boolean)) {
              const candidate = line ? `${line} ${word}` : word;
              if (line && textFont.widthOfTextAtSize(candidate, size) > maxWidth) { lines.push(line); line = word; }
              else line = candidate;
            }
            lines.push(line);
          });
          lines.forEach((line, index) => {
            const y = height - mark.y * height - size * (index + 1.05);
            if (y > height - (mark.y + (mark.height ?? 0.08)) * height - size) {
              target.drawText(line, { x: mark.x * width, y, size, font: textFont, color: rgb(r, g, b) });
            }
          });
        } else if (mark.type === "image" && mark.image) {
          const raw = mark.image.split(",")[1];
          const bytes = Uint8Array.from(atob(raw), (character) => character.charCodeAt(0));
          const embedded = mark.imageType === "png" ? await pdfDocument.embedPng(bytes) : await pdfDocument.embedJpg(bytes);
          const imageWidth = width * mark.width;
          const imageHeight = mark.height ? mark.height * height : imageWidth * embedded.height / embedded.width;
          target.drawImage(embedded, { x: mark.x * width, y: height - mark.y * height - imageHeight, width: imageWidth, height: imageHeight });
        } else if (mark.points?.length) {
          const [r, g, b] = mark.type === "highlight" ? [1, 0.82, 0.05] : colorParts(mark.color);
          for (let index = 1; index < mark.points.length; index++) {
            const from = mark.points[index - 1]; const to = mark.points[index];
            target.drawLine({ start: { x: from.x * width, y: height - from.y * height }, end: { x: to.x * width, y: height - to.y * height }, thickness: Math.max(1, mark.width * width), color: rgb(r, g, b), opacity: mark.type === "highlight" ? 0.34 : 1, lineCap: 1 });
          }
        }
      }
      const savedPdf = Uint8Array.from(await pdfDocument.save());
      const blob = new Blob([savedPdf.buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${file?.name.replace(/\.pdf$/i, "") ?? "document"}-edited.pdf`; anchor.click(); URL.revokeObjectURL(url);
      setNotice("Your edited PDF has been downloaded.");
    } catch { setError("The edited PDF couldn’t be created. Please try again with this file."); }
    finally { setBusy(false); }
  }

  const toolButton = (value: Tool, label: string, icon: string) => <button type="button" onClick={() => { setTool(value); setNotice(""); }} className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition ${tool === value ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}><span aria-hidden="true">{icon}</span>{label}</button>;
  const selectedText = marks.find((entry) => entry.page === page && entry.mark.id === selectedMarkId && entry.mark.type === "text")?.mark;
  const updateSelectedText = (updates: Partial<Mark>) => {
    if (!selectedText) return;
    setMarks((current) => current.map((entry) => entry.mark.id === selectedText.id ? { ...entry, mark: { ...entry.mark, ...updates } } : entry));
  };

  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#eff6ff_0%,_#f8fafc_42%,_#fff_100%)] px-4 py-10 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-white bg-white/80 text-2xl shadow-lg shadow-blue-100/70">✎</div><p className="mb-2 text-sm font-semibold uppercase tracking-[.18em] text-blue-600">PaperKit PDF tools</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Edit PDF</h1><p className="mx-auto mt-3 max-w-2xl text-slate-600">Add text, draw, highlight, sign, and place images right on your PDF page.</p></div>
      {!file ? <section className="mx-auto max-w-3xl rounded-3xl border border-white/80 bg-white/75 p-6 shadow-xl shadow-slate-200/60 backdrop-blur-xl sm:p-10">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="group flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 px-6 text-center transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60"><span className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-white text-3xl shadow-sm">📄</span><span className="text-xl font-semibold">{busy ? "Opening your PDF…" : "Choose a PDF to edit"}</span><span className="mt-2 text-sm text-slate-500">Click to browse or drop your file here · Up to 50 MB</span><span className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">Select PDF</span></button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void loadFile(selected); event.target.value = ""; }} />
        <p className="mt-5 text-center text-sm text-slate-500">🔒 Your document stays on this device and is processed in your browser.</p>
      </section> : <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-lg shadow-slate-200/50 backdrop-blur-xl"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Pages</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{pageCount}</span></div><div className="grid max-h-[68vh] grid-cols-2 gap-3 overflow-y-auto pr-1">{thumbs.map((thumb) => <button key={thumb.page} onClick={() => setPage(thumb.page)} className={`overflow-hidden rounded-xl border-2 bg-white p-1 transition ${page === thumb.page ? "border-blue-500 shadow-md shadow-blue-100" : "border-slate-100 hover:border-blue-200"}`}><img src={thumb.src} alt={`Page ${thumb.page}`} className="w-full rounded-md"/><span className={`block py-1 text-xs font-medium ${page === thumb.page ? "text-blue-700" : "text-slate-500"}`}>Page {thumb.page}</span></button>)}</div>
          <button type="button" onClick={() => { setFile(null); setPdfBytes(null); setThumbs([]); setMarks([]); setNotice(""); }} className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Choose another PDF</button>
        </aside>
        <section className="min-w-0 rounded-3xl border border-white/80 bg-white/75 p-4 shadow-lg shadow-slate-200/50 backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold">{file.name}</h2><p className="text-sm text-slate-500">Page {page} of {pageCount} · {marks.length} edit{marks.length === 1 ? "" : "s"}</p></div><button type="button" onClick={() => void exportPdf()} disabled={busy || marks.length === 0} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? "Preparing…" : "Download edited PDF"}</button></div>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white bg-white/80 p-2 shadow-sm">{toolButton("select", "Select", "↖")}{toolButton("text", "Text box", "T")}{toolButton("draw", "Draw", "✎")}{toolButton("highlight", "Highlight", "▰")}{toolButton("signature", "Signature", "〰")}{toolButton("image", "Image", "▧")}<span className="mx-1 hidden h-7 w-px bg-slate-200 sm:block"/><label className="flex items-center gap-2 px-2 text-xs text-slate-500">Color<input aria-label="Text or drawing color" type="color" value={selectedText?.color ?? color} onChange={(event) => { setColor(event.target.value); updateSelectedText({ color: event.target.value }); }} className="h-8 w-9 cursor-pointer rounded-lg border-0 bg-transparent" /></label>{(tool === "text" || selectedText) && <><label className="flex items-center gap-2 px-2 text-xs text-slate-500">Size<input aria-label="Text size" type="number" min={10} max={72} value={selectedText?.fontSize ?? fontSize} onChange={(event) => { const size = Math.min(72, Math.max(10, Number(event.target.value))); setFontSize(size); updateSelectedText({ fontSize: size }); }} className="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700" /></label><button type="button" aria-pressed={selectedText?.bold ?? bold} onClick={() => { const value = !(selectedText?.bold ?? bold); setBold(value); updateSelectedText({ bold: value }); }} className={`h-9 w-9 rounded-lg font-bold ${selectedText?.bold ?? bold ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>B</button><button type="button" aria-pressed={selectedText?.italic ?? italic} onClick={() => { const value = !(selectedText?.italic ?? italic); setItalic(value); updateSelectedText({ italic: value }); }} className={`h-9 w-9 rounded-lg italic ${selectedText?.italic ?? italic ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>I</button></>}{selectedMarkId && <button type="button" onClick={() => { setMarks((current) => current.filter((entry) => entry.mark.id !== selectedMarkId)); setSelectedMarkId(null); }} className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Delete selected</button>}</div>
          {tool === "image" && <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900"><span>Choose a picture to add it once to the page. You can move and resize it afterward.</span><button type="button" onClick={() => imageRef.current?.click()} className="rounded-lg bg-white px-3 py-1.5 font-semibold text-blue-700 shadow-sm">Choose image</button><input ref={imageRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => void loadImage(event)} /></div>}
          <p className="mb-3 text-xs text-slate-500">{tool === "text" ? "Drag on the page to draw a text box, then type directly inside it." : tool === "select" ? "Select an item to move it. Drag its corner handle to resize." : tool === "image" ? "Choose a picture to add it centered on the page, then drag or resize it." : tool === "signature" ? "Draw your signature with your mouse, trackpad, or finger." : tool === "highlight" ? "Drag over the text or area you want to highlight." : "Draw directly on the page."}</p>
          {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}
          <div className="relative mx-auto w-fit max-w-full overflow-auto rounded-xl bg-slate-200/70 p-3 shadow-inner">{rendering && <div className="absolute inset-0 z-10 grid place-items-center bg-white/70 text-sm text-slate-600">Rendering page…</div>}<div className="relative mx-auto w-fit"><canvas ref={pdfCanvasRef} className="block h-auto max-h-[72vh] max-w-full rounded-sm bg-white shadow-lg"/><canvas ref={overlayRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} className={`absolute inset-0 h-full w-full touch-none ${tool === "text" ? "cursor-crosshair" : tool === "select" ? "cursor-default" : "cursor-crosshair"}`} />{textBoxPreview && <div className="pointer-events-none absolute border-2 border-dashed border-blue-500 bg-blue-100/20" style={{ left: `${textBoxPreview.x * 100}%`, top: `${textBoxPreview.y * 100}%`, width: `${textBoxPreview.width * 100}%`, height: `${textBoxPreview.height * 100}%` }} />}{marks.filter((entry) => entry.page === page && (entry.mark.type === "text" || entry.mark.type === "image")).map(({ mark }) => { const selected = mark.id === selectedMarkId; return <div key={mark.id} className={`pointer-events-none absolute ${selected ? "z-10" : "z-[1]"}`} style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, width: `${mark.width * 100}%`, height: `${(mark.height ?? 0.08) * 100}%` }}>{mark.type === "image" && mark.image ? <div onPointerDown={(event) => beginTransform(event, mark, "move")} onPointerMove={updateTransform} onPointerUp={endTransform} onPointerCancel={endTransform} className={`pointer-events-auto relative h-full w-full cursor-move ${selected ? "outline outline-2 outline-blue-500" : ""}`}><img src={mark.image} alt="Added image" draggable={false} className="h-full w-full select-none object-fill" />{selected && <button type="button" aria-label="Resize image" onPointerDown={(event) => beginTransform(event, mark, "resize")} onPointerMove={updateTransform} onPointerUp={endTransform} onPointerCancel={endTransform} className="absolute -bottom-2 -right-2 h-5 w-5 touch-none rounded-full border-2 border-white bg-blue-600 shadow" />}</div> : <div className={`pointer-events-none relative h-full w-full ${selected ? "rounded-sm outline outline-2 outline-blue-500" : ""}`}><textarea ref={selected ? selectedTextAreaRef : null} value={mark.text ?? ""} placeholder="Type your text…" onFocus={() => setSelectedMarkId(mark.id)} onChange={(event) => setMarks((current) => current.map((entry) => entry.mark.id === mark.id ? { ...entry, mark: { ...entry.mark, text: event.target.value } } : entry))} style={{ color: mark.color, fontSize: `${mark.fontSize ?? fontSize}px`, fontWeight: mark.bold ? 700 : 400, fontStyle: mark.italic ? "italic" : "normal" }} className="pointer-events-auto absolute inset-0 h-full w-full resize-none overflow-hidden border-0 bg-transparent p-1 leading-tight outline-none placeholder:text-slate-400/80" /><div onPointerDown={(event) => beginTransform(event, mark, "move")} onPointerMove={updateTransform} onPointerUp={endTransform} onPointerCancel={endTransform} className={`pointer-events-auto absolute -top-7 left-0 cursor-move select-none rounded-t-md bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white ${selected ? "" : "hidden"}`}>↕ Move text box</div>{selected && <button type="button" aria-label="Resize text box" onPointerDown={(event) => beginTransform(event, mark, "resize")} onPointerMove={updateTransform} onPointerUp={endTransform} onPointerCancel={endTransform} className="pointer-events-auto absolute -bottom-2 -right-2 h-5 w-5 touch-none rounded-full border-2 border-white bg-blue-600 shadow" />}</div>}</div>; })}</div></div>
          <div className="mt-5 flex items-center justify-between"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-40">← Previous</button><span className="text-sm text-slate-500">{page} / {pageCount}</span><button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page >= pageCount} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-40">Next →</button></div>
        </section>
      </div>}
      {error && !file && <p role="alert" className="mx-auto mt-4 max-w-3xl rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="mt-10 border-t border-slate-200/70 pt-7 text-center"><p className="mb-3 text-sm font-medium text-slate-500">Explore more PDF tools</p><div className="flex flex-wrap justify-center gap-3">{[["Compress PDF", "/tools/compress-pdf"], ["Merge PDF", "/tools/merge-pdf"], ["Split PDF", "/tools/split-pdf"], ["PDF to JPG", "/tools/pdf-to-jpg"]].map(([label, href]) => <Link key={href} href={href} className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700">{label} ↗</Link>)}</div></div>
    </div>
  </main>;
}
