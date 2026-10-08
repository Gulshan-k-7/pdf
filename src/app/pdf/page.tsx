import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ToolGrid } from "@/components/ToolGrid";
export default function PdfPage() {
  return (
    <>
      <Navbar />
      <main className="page-shell">
        <Hero />
        <ToolGrid category="pdf" />
      </main>
      <Footer />
    </>
  );
}
