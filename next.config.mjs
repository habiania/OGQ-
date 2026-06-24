/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@napi-rs/canvas"],
  experimental: {
    // 24장 이미지 생성은 시간이 걸리므로 서버 액션 바디 제한을 넉넉히
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
