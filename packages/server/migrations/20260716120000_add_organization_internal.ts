import type { Knex } from 'knex'

// Operator flag: mark dogfood/test orgs so platform-admin metrics can exclude them.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('organization', (t) => {
    t.boolean('internal').notNullable().defaultTo(false)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('organization', (t) => {
    t.dropColumn('internal')
  })
}
