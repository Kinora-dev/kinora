import type { Counts, NormTest, RunReport } from '@kinora/core'
import { relations } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { user } from './auth-schemas'

type GitMeta = NonNullable<RunReport['meta']['git']>
type CiMeta = NonNullable<RunReport['meta']['ci']>

export const project = pgTable('project', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [
  index('project_userId_idx').on(table.userId),
  unique('project_user_slug_uniq').on(table.userId, table.slug),
])

export const run = pgTable('run', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at').notNull(),
  duration: integer('duration').notNull(),
  counts: jsonb('counts').$type<Counts>().notNull(),
  countsByTag: jsonb('counts_by_tag').$type<Record<string, Counts>>().notNull().default({}),
  playwrightVersion: text('playwright_version'),
  git: jsonb('git').$type<GitMeta>(),
  ci: jsonb('ci').$type<CiMeta>(),
  shards: integer('shards'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [index('run_projectId_idx').on(table.projectId)])

export const test = pgTable('test', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => run.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  testKey: text('test_key').notNull(),
  title: text('title').notNull(),
  titlePath: jsonb('title_path').$type<string[]>().notNull(),
  file: text('file').notNull(),
  line: integer('line').notNull(),
  column: integer('column').notNull(),
  projectName: text('project_name').notNull(),
  status: text('status').notNull(),
  ok: boolean('ok').notNull(),
  duration: integer('duration').notNull(),
  retries: integer('retries').notNull(),
  tags: jsonb('tags').$type<string[]>().notNull(),
  annotations: jsonb('annotations').$type<NormTest['annotations']>().notNull(),
  errors: jsonb('errors').$type<NormTest['errors']>().notNull(),
  attachments: jsonb('attachments').$type<NormTest['attachments']>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [
  index('test_runId_idx').on(table.runId),
  index('test_project_key_idx').on(table.projectId, table.testKey),
])

export const artifact = pgTable('artifact', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  runId: text('run_id').notNull().references(() => run.id, { onDelete: 'cascade' }),
  testId: text('test_id').references(() => test.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  contentType: text('content_type').notNull(),
  storageKey: text('storage_key').notNull(),
  sha1: text('sha1'),
  size: integer('size'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [index('artifact_runId_idx').on(table.runId)])

// Cached Polar billing state, synced from the customer.state_changed webhook.
export const subscription = pgTable('subscription', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  polarCustomerId: text('polar_customer_id').notNull(),
  tier: text('tier').$type<'free' | 'team' | 'pro' | 'enterprise'>().notNull().default('free'),
  status: text('status'),
  productId: text('product_id'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
})

// One Slack channel per project for run/regression notifications.
export const slackIntegration = pgTable('slack_integration', {
  projectId: text('project_id').primaryKey().references(() => project.id, { onDelete: 'cascade' }),
  webhookUrl: text('webhook_url').notNull(),
  policy: text('policy').$type<'always' | 'on-failure' | 'on-regression'>().notNull().default('on-failure'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
})

export const projectRelations = relations(project, ({ one, many }) => ({
  user: one(user, { fields: [project.userId], references: [user.id] }),
  runs: many(run),
}))

export const runRelations = relations(run, ({ one, many }) => ({
  project: one(project, { fields: [run.projectId], references: [project.id] }),
  tests: many(test),
  artifacts: many(artifact),
}))

export const testRelations = relations(test, ({ one, many }) => ({
  run: one(run, { fields: [test.runId], references: [run.id] }),
  project: one(project, { fields: [test.projectId], references: [project.id] }),
  artifacts: many(artifact),
}))

export const artifactRelations = relations(artifact, ({ one }) => ({
  run: one(run, { fields: [artifact.runId], references: [run.id] }),
  test: one(test, { fields: [artifact.testId], references: [test.id] }),
}))
