import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true = listen on every network address of this computer, so phones and laptops on the same Wi-Fi
  // can open the site at http://<this computer's IP>:<port>. Vite prints those addresses as "Network:" on start.
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
})
