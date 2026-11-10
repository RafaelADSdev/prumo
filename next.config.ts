import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: [
    "pdfjs-dist",
    "tesseract.js",
    "@napi-rs/canvas",
    "sharp",
  ],
  outputFileTracingIncludes: {
    "/*": ["./prisma/supabase-ca.crt"],
    "/api/ai/conversations/**": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm}/**/*",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js-core/*",
      "./node_modules/@tesseract.js-data/por/4.0.0/por.traineddata.gz",
    ],
  },
};

export default config;
