
/** @type {import("next").NextConfig} */
const config = {
  serverExternalPackages: ["postgres", "web-push", "nodemailer", "pdf-lib", "@pdf-lib/fontkit"],
  // the PDF route reads the embedded font from disk
  outputFileTracingIncludes: { "/api/pdf": ["./assets/fonts/**"] },
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ] }];
  },
};
export default config;
