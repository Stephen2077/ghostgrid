import { createRoot } from 'react-dom/client'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <TooltipProvider>
    <App />
    <Toaster position="bottom-right" />
  </TooltipProvider>,
)
