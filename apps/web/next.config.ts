import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable trailing slashes for better compatibility
  trailingSlash: false,
  
  // Set base path if needed (leave empty for root deployment)
  basePath: "",
  
  // Output configuration
  output: "standalone",
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  
  // Environment variables that should be available in the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

export default nextConfig;