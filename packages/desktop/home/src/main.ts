import * as Sentry from '@sentry/electron/renderer'
import { createApp } from 'vue'
import App from './App.vue'
// Boot shared theme (auto/light/dark, storageKey shared with web + viewer).
import '@kinora/ui/theme'
import './style.css'

// DSN + gating inherited from the main process; inert when main never inited (dev/probe).
Sentry.init()

createApp(App).mount('#app')
