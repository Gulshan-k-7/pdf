import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { ToolGrid } from "@/components/ToolGrid";
export default function ImagePage() {
  return (
    <>
      <Navbar />
      <main className="page-shell">
        <Hero/>
        <ToolGrid category="image" />
      </main>
      <Footer />
    </>
  );
}
