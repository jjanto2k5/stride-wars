import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
  ],
  server: {
    host: true, // Expose to the network (same as --host)
    proxy: {
      // Whenever the frontend asks for "/api", Vite secretly routes it to your backend
      '/api': {
        target: 'http://localhost:5000/',
        changeOrigin: true,
        secure: false, // Tells Vite it's okay that the backend doesn't have SSL
      }
    }
  }
})
