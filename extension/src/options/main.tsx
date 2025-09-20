import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '../styles/theme.css'
import '../styles/tailwind.css'
import { Toaster } from '@/components/ui/sonner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster richColors closeButton />
  </StrictMode>
)
