import {treaty} from '@elysiajs/eden'
import React from 'react'
import ReactDOM from 'react-dom/client'
import {Helmet} from 'react-helmet'
import {App as Server} from 'rin-server/src/server'
import App from './App'
import './index.css'
import {siteName} from './utils/constants'
import {listenSystemMode} from './utils/darkModeUtils'
import Modal from 'react-modal';

export const endpoint = process.env.API_URL || 'http://localhost:3001'
export const oauth_url = process.env.API_URL + '/user/github'
export const client = treaty<Server>(endpoint)
listenSystemMode()
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Helmet>
      <title>{siteName}</title>
    </Helmet>
    <App />
  </React.StrictMode>
)
Modal.setAppElement('#root');