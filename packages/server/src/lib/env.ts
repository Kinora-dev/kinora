import process from 'node:process'
import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']),
  PORT: z.coerce.number(),
  BASE_URL: z.url(),
  AUTH_SECRET: z.string(),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.coerce.number(),
  POSTGRES_DB: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  KINORA_CLOUD: z.stringbool().default(false),
  POLAR_ACCESS_TOKEN: z.string().optional(),
  POLAR_WEBHOOK_SECRET: z.string().optional(),
  POLAR_PRODUCT_TEAM_ID: z.string().optional(),
  POLAR_PRODUCT_PRO_ID: z.string().optional(),
  STORAGE_DIR: z.string().default('.data/artifacts'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
}).refine(
  e => !e.KINORA_CLOUD || Boolean(e.POLAR_ACCESS_TOKEN && e.POLAR_WEBHOOK_SECRET && e.POLAR_PRODUCT_TEAM_ID && e.POLAR_PRODUCT_PRO_ID),
  { message: 'KINORA_CLOUD=true requires POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_PRODUCT_TEAM_ID and POLAR_PRODUCT_PRO_ID' },
)

export type Env = z.infer<typeof envSchema>

export const env = envSchema.parse(process.env)

export interface CloudConfig {
  accessToken: string
  webhookSecret: string
  teamProductId: string
  proProductId: string
}

function resolveCloud(): CloudConfig | null {
  if (!env.KINORA_CLOUD)
    return null

  const { POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_PRODUCT_TEAM_ID, POLAR_PRODUCT_PRO_ID } = env
  if (!POLAR_ACCESS_TOKEN || !POLAR_WEBHOOK_SECRET || !POLAR_PRODUCT_TEAM_ID || !POLAR_PRODUCT_PRO_ID)
    throw new Error('KINORA_CLOUD=true requires all POLAR_* env vars')

  return {
    accessToken: POLAR_ACCESS_TOKEN,
    webhookSecret: POLAR_WEBHOOK_SECRET,
    teamProductId: POLAR_PRODUCT_TEAM_ID,
    proProductId: POLAR_PRODUCT_PRO_ID,
  }
}

export const cloud = resolveCloud()

export interface S3Config {
  endpoint: string
  region: string
  bucket: string
  accessKey: string
  secretKey: string
}

function resolveS3(): S3Config | null {
  const {
    S3_ENDPOINT: endpoint,
    S3_REGION: region,
    S3_BUCKET: bucket,
    S3_ACCESS_KEY_ID: accessKey,
    S3_SECRET_ACCESS_KEY: secretKey,
  } = env
  if (!endpoint || !region || !bucket || !accessKey || !secretKey)
    return null
  return { endpoint, region, bucket, accessKey, secretKey }
}

export const s3 = resolveS3()
