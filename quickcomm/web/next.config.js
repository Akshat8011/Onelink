/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.grofers.com" },
      { protocol: "https", hostname: "cdn.zeptonow.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "media-assets.swiggy.com" },
    ],
  },
}

module.exports = nextConfig
