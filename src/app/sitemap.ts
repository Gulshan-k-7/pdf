import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "localhost:3000";

  const pages = [
    "",
    "/pdf",
    "/image",
    "/compress-pdf",
    "/merge-pdf",
    "/split-pdf",
    "/delete-pdf-pages",
    "/reorder-pdf-pages",
    "/rotate-pdf-pages",
    "/protect-pdf",
    "/edit-pdf",
    "/jpg-to-pdf",
    "/pdf-to-jpg",

    "/compress-image",
    "/compress-image-to-50kb",
    "/compress-image-to-100kb",
  ];

  return pages.map((page) => ({
    url: `${baseUrl}${page}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: page === "" ? 1 : 0.7,
  }));
}