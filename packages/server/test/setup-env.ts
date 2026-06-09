import process from 'node:process'
import { TEST_ENV } from './test-env'

for (const [key, value] of Object.entries(TEST_ENV))
  process.env[key] = value
