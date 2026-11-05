import type { NextConfig } from "next";

const config: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./prisma/supabase-ca.crt"],
  },
};

export default config;
