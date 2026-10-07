"use client";
import Link from "next/link";

const navLinks = [
  { name: "PDF", href: "/pdf" },
  { name: "Image", href: "/image" },
  { name: "About", href: "/about" },
];

export function Navbar() {
  return (
    <header className="w-full  backdrop-blur-xl">
      <nav className="mx-auto flex h-14  max-w-7xl items-center justify-between px-6 sm:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="text-[21px] font-semibold tracking-[-0.04em] text-neutral-950"
        >
          paperkit
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-7 sm:gap-9">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-[13px] font-medium tracking-[0.01em] text-neutral-500 transition-colors duration-200 hover:text-neutral-950"
            >
              {link.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}