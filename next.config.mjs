/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence warnings about better-sqlite3 native module
  webpack: (config) => {
    config.externals.push({
      'better-sqlite3': 'commonjs better-sqlite3',
    })
    return config
  },
}

export default nextConfig
