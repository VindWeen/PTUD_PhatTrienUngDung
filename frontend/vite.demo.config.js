import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.js';

export default mergeConfig(base, defineConfig({
  // Ignore shell/.env API overrides so recording writes always use the demo proxy.
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('/api/v1'),
    'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('api'),
  },
  server: {
    host: '127.0.0.1', port: 5175, strictPort: true,
    proxy: { '/api/v1': { target: 'http://127.0.0.1:5001', changeOrigin: true, secure: false } },
  },
}));
