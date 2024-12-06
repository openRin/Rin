import { treaty } from '@elysiajs/eden'
import i18n from "i18next"
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Helmet } from 'react-helmet'
import Backend from 'i18next-http-backend';
import { initReactI18next } from "react-i18next"
import Modal from 'react-modal'
import { App as Server } from 'rin-server/src/server'
import App from './App'
import './index.css'
import './components.css'
import { siteName } from './utils/constants'
import { listenSystemMode } from './utils/darkModeUtils'
import LanguageDetector from 'i18next-browser-languagedetector';
export const endpoint = process.env.API_URL || 'http://localhost:3001'
export const oauth_url = process.env.API_URL + '/user/github'
export const client = treaty<Server>(endpoint)
listenSystemMode()
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    // the translations
    // (tip move them in a JSON file and import them,
    // or even better, manage them via a UI: https://react.i18next.com/guides/multiple-translation-files#manage-your-translations-with-a-management-gui)
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    }
  });
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Helmet>
      <title>{siteName}</title>
    </Helmet>
    <App />
  </React.StrictMode>
)
Modal.setAppElement('#root');