import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: true,             // Auto-opens browser
    historyApiFallback: true, // ✅ Enables deep linking (e.g., /manualreview won't redirect)
  },
})
