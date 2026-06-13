import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('alert_channel', (t) => {
    t.text('id').primary()
    t.text('project_id').notNullable().references('id').inTable('project').onDelete('CASCADE')
    t.text('kind').notNullable()
    t.text('target').notNullable()
    t.text('policy').notNullable().defaultTo('on-failure')
    t.boolean('enabled').notNullable().defaultTo(true)
    t.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
    t.index(['project_id'], 'alert_channel_projectId_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('alert_channel')
}
