import { createStowlineClient } from '@stowline/sdk'
import { stowlineConfig } from './env'

export const stowline = stowlineConfig
  ? createStowlineClient({ apiKey: stowlineConfig.apiKey, baseUrl: stowlineConfig.apiUrl })
  : null

export const feedbackEnabled = stowline !== null
