import type { NextConfig } from "next";
import os from "os";

// 动态获取本机的所有局域网 IPv4 地址，防止因 IP 变更导致 Network 链接失效
const getLocalIPs = () => {
  const interfaces = os.networkInterfaces();
  const ips: string[] = ["localhost", "127.0.0.1"];
  for (const name of Object.keys(interfaces)) {
    const networkInterface = interfaces[name];
    if (networkInterface) {
      for (const net of networkInterface) {
        // 过滤 IPv4 且不是回环地址
        if (net.family === "IPv4" && !net.internal) {
          ips.push(net.address);
        }
      }
    }
  }
  return ips;
};

const nextConfig: NextConfig & { allowedDevOrigins?: string[] } = {
  // Enable standalone output for optimized Docker deployment
  output: "standalone",

  // 允许局域网 IP 访问 Next.js 开发服务（解决局域网 Network 访问时被安全策略拦截，导致 HMR 报错的问题）
  allowedDevOrigins: getLocalIPs(),

  // 禁用 Next.js 开发状态指示器（隐藏右上角带 "N" 的开发调试小圆圈）
  devIndicators: false,

  // Experimental features
  // Type assertion needed: proxyClientMaxBodySize is valid in Next.js 15 but types lag behind
  experimental: {
    // Increase proxy body size limit for file uploads (default is 10MB)
    // This allows larger files to be uploaded through the /api/* rewrite proxy to FastAPI
    proxyClientMaxBodySize: '100mb',
  } as NextConfig['experimental'],

  // API Rewrites: Proxy /api/* requests to FastAPI backend
  // This simplifies reverse proxy configuration - users only need to proxy to port 8502
  // Next.js handles internal routing to the API backend on port 5055
  async rewrites() {
    // INTERNAL_API_URL: Where Next.js server-side should proxy API requests
    // Default: http://localhost:5055 (single-container deployment)
    // Override for multi-container: INTERNAL_API_URL=http://api-service:5055
    const internalApiUrl = process.env.INTERNAL_API_URL || 'http://localhost:5055'

    console.log(`[Next.js Rewrites] Proxying /api/* to ${internalApiUrl}/api/*`)

    return [
      {
        source: '/api/:path*',
        destination: `${internalApiUrl}/api/:path*`,
      },
    ]
  },
};

export default nextConfig;
