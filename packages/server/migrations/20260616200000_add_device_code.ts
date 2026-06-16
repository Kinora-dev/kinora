import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('device_code', (t) => {
    t.text('id').primary()
    t.text('device_code').notNullable()
    t.text('user_code').notNullable()
    t.text('user_id').references('id').inTable('user').onDelete('CASCADE')
    t.timestamp('expires_at', { useTz: false }).notNullable()
    t.text('status').notNullable()
    t.timestamp('last_polled_at', { useTz: false })
    t.integer('polling_interval')
    t.text('client_id')
    t.text('scope')
    t.index(['device_code'], 'device_code_deviceCode_idx')
    t.index(['user_code'], 'device_code_userCode_idx')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('device_code')
}
