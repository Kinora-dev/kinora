import { createApp } from 'vue'
import App from './App.vue'
// Boot shared theme (auto/light/dark, storageKey shared with web + viewer).
import '@kinora/ui/theme'
import './style.css'

createApp(App).mount('#app')
