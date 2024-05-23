import { treaty } from '@elysiajs/eden'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as Server } from 'rin-server/src/server'
import App from './App'
import './index.css'
import 'remixicon/fonts/remixicon.css'
const endpoint = process.env.API_URL || 'http://localhost:3001'
export const client = treaty<Server>(endpoint)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
