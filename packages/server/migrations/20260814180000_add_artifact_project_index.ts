import type { Knex } from 'knex'

// The storage quota sums an org's artifact sizes on every upload; without this it seq-scans.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('artifact', (t) => {
    t.index(['project_id'], 'artifact_projectId_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('artifact', (t) => {
    t.dropIndex(['project_id'], 'artifact_projectId_idx')
  })
}
