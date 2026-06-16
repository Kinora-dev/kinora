import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('subscription', (t) => {
    t.timestamp('state_changed_at', { useTz: false })
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('subscription', (t) => {
    t.dropColumn('state_changed_at')
  })
}
