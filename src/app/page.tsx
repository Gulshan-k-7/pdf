import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { ToolGrid } from "@/components/ToolGrid";
export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ToolGrid />
      </main>
      <Footer />
    </>
  );
}
