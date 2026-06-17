import type { Knex } from 'knex'

// better-auth admin plugin: role on user (+ ban fields) and impersonatedBy on session.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user', (t) => {
    t.text('role')
    t.boolean('banned').defaultTo(false)
    t.text('ban_reason')
    t.timestamp('ban_expires', { useTz: false })
  })
  await knex.schema.alterTable('session', (t) => {
    t.text('impersonated_by')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('user', (t) => {
    t.dropColumn('role')
    t.dropColumn('banned')
    t.dropColumn('ban_reason')
    t.dropColumn('ban_expires')
  })
  await knex.schema.alterTable('session', (t) => {
    t.dropColumn('impersonated_by')
  })
}
