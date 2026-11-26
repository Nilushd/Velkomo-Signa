import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Velkomo Signa",
    short_name: "Signa",
    description: "Forms and approvals for your property",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F7FC",
    theme_color: "#0B1F4D",
    icons: [
      { src: "/android-chrome-192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
