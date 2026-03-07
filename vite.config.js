import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler'],
        ],
      },
    }),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api-ch': {
        target: 'https://api.company-information.service.gov.uk',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-ch/, ''),
      },
    },
  },
})
