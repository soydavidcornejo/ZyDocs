import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Para fotos de perfil de Google
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // O tu límite preferido
    },
  },
  // Optimizaciones para carga de página
  reactStrictMode: true,
  swcMinify: true, // Minimización SWC para mejor rendimiento
  poweredByHeader: false, // Eliminar cabecera X-Powered-By por seguridad
  // Configuración de rutas
  async redirects() {
    return [
      {
        source: '/organization/:organizationId',
        destination: '/organization/:organizationId/wiki',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
