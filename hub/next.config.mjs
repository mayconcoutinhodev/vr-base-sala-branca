/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@vr/core',
    '@vr/module-sdk',
    '@vr/module-hub-world',
    '@vr/module-training-room',
    '@vr/module-inventory',
  ],
};

export default nextConfig;
