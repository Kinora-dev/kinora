import * as Sentry from '@sentry/vue'
import { createApp } from 'vue'
import Workbench from './ui/Workbench.vue'
import './style.css'

const app = createApp(Workbench)

// DSN baked per consumer build (web -> frontend project, desktop -> desktop project); absent in self-host/dev -> tree-shaken.
if (import.meta.env.PROD && import.meta.env.VITE_KINORA_SENTRY_DSN) {
  Sentry.init({
    app,
    dsn: import.meta.env.VITE_KINORA_SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}

app.mount('#app')
