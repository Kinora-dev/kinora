import process from 'node:process'
import { TEST_ENV } from './test-env'

// First setup file: populate process.env before any test module imports env.ts.
// Direct assignment overrides Vite's built-in process.env.BASE_URL ('/'), which fails z.url().
for (const [key, value] of Object.entries(TEST_ENV))
  process.env[key] = value
