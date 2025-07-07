import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* existing config options here */
  output: 'standalone',

    outputFileTracingIncludes: {
      '*': [
        'public/**/*',
        '.next/static/**/*',
      ],
    },

};

export default nextConfig;