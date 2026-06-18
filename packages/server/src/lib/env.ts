import process from 'node:process'
import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']),
  PORT: z.coerce.number(),
  BASE_URL: z.url(),
  WEB_ORIGIN: z.string(),
  // Share the session cookie across subdomains (e.g. .kinora.dev for app/api). Unset = host-only (single-origin self-host).
  COOKIE_DOMAIN: z.string().optional(),
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
  // Ingest requests per minute per client IP (DoS backstop; sharded CI spreads across IPs). Raise for pathological suites.
  INGEST_RATE_LIMIT: z.coerce.number().int().positive().default(600),
  // Max JSON body (MB) for POST /runs. Bounds parse-cost OOM; trace.zip artifact uploads keep their own larger limit.
  INGEST_MAX_JSON_MB: z.coerce.number().int().positive().default(25),
  STORAGE_DIR: z.string().default('.data/artifacts'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
}).refine(
  e => !e.KINORA_CLOUD || Boolean(e.POLAR_ACCESS_TOKEN && e.POLAR_WEBHOOK_SECRET && e.POLAR_PRODUCT_TEAM_ID && e.POLAR_PRODUCT_PRO_ID),
  { message: 'KINORA_CLOUD=true requires POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_PRODUCT_TEAM_ID and POLAR_PRODUCT_PRO_ID' },
).refine(
  // Cross-subdomain cookies are a prod concern (app./api.); dev runs on localhost where
  // the two ports already share host-only cookies, so COOKIE_DOMAIN can stay empty there.
  e => !(e.KINORA_CLOUD && e.NODE_ENV === 'production') || Boolean(e.COOKIE_DOMAIN),
  { message: 'KINORA_CLOUD=true in production requires COOKIE_DOMAIN (e.g. .kinora.dev)' },
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

export interface SlackAppConfig {
  clientId: string
  clientSecret: string
}

// "Add to Slack" OAuth app; null falls back to the manual webhook-URL paste
function resolveSlackApp(): SlackAppConfig | null {
  const { SLACK_CLIENT_ID: clientId, SLACK_CLIENT_SECRET: clientSecret } = env
  if (!clientId || !clientSecret)
    return null
  return { clientId, clientSecret }
}

export const slackApp = resolveSlackApp()

export interface SmtpConfig {
  host: string
  port: number
  user?: string
  pass?: string
  from: string
}

// Generic SMTP so self-hosters can plug any provider; null disables email flows.
function resolveSmtp(): SmtpConfig | null {
  const { SMTP_HOST: host, SMTP_PORT: port, SMTP_USER: user, SMTP_PASS: pass, SMTP_FROM: from } = env
  if (!host || !port || !from)
    return null
  return { host, port, user, pass, from }
}

export const smtp = resolveSmtp()
