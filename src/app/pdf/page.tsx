import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ToolGrid } from "@/components/ToolGrid";
export default function PdfPage() {
  return (
    <>
      <Navbar />
      <main className="page-shell">
        <div className="section-heading">
          <p className="eyebrow">PDF WORKSPACE</p>
          <h1>PDF tools, all in one place.</h1>
          <p>Simple tools to help you organize and prepare your documents.</p>
        </div>
        <ToolGrid category="pdf" />
      </main>
      <Footer />
    </>
  );
}
