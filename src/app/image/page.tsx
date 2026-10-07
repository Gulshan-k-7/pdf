import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ToolGrid } from "@/components/ToolGrid";
export default function ImagePage() {
  return (
    <>
      <Navbar />
      <main className="page-shell">
        <div className="section-heading">
          <p className="eyebrow">IMAGE WORKSPACE</p>
          <h1>Make more of your images.</h1>
          <p>Handy image tools are coming soon. Start with our PDF tools today.</p>
        </div>
        <ToolGrid category="image" />
      </main>
      <Footer />
    </>
  );
}
