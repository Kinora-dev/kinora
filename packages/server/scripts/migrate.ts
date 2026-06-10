import type { Knex } from 'knex'
import { resolve } from 'node:path'
import process from 'node:process'
import knex from 'knex'
import { pino, stdSerializers } from 'pino'
import { env } from '../src/lib/env.js'

const logger = pino({
  level: 'info',
  serializers: {
    err: stdSerializers.err,
  },
})

const migrationsDirectory = resolve(import.meta.dirname, '../migrations')

const isDev = env.NODE_ENV === 'development'
// .mjs: the build (tsdown) emits ESM migrations as .mjs in dist.
const loadExtensions = ['.js', '.mjs']

if (isDev) {
  loadExtensions.push('.ts')
}

const config: Knex.Config = {
  client: 'pg',
  connection: {
    password: env.POSTGRES_PASSWORD,
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
    database: env.POSTGRES_DB,
    charset: 'utf8mb4',
  },
  migrations: {
    directory: migrationsDirectory,
    loadExtensions,
  },
}

const migratorConfig = {
  extension: 'ts',
  disableMigrationsListValidation: true,
}

const knexWithConfig = knex(config)

async function make(name: string) {
  try {
    const fileName = await knexWithConfig.migrate.make(name, migratorConfig)

    logger.info(`Migration file created at ${fileName}!`)
  }
  catch (err) {
    logger.error(err, `Unable to create migration file named ${name}`)

    throw err
  }
}

async function latest(): Promise<void> {
  const totalStart = new Date()

  try {
    await knexWithConfig.migrate.latest(migratorConfig)

    logger.info('Migration to latest succeeded!')
  }
  catch (err) {
    logger.error(
      'You might need to read http://knexjs.org/#Notes-about-locks You can unlock the knex_migrations table with pnpm migrate unlock',
    )
    logger.error(
      {
        type: 'error',
        err,
      },
      'Migration process failed',
    )

    throw err
  }
  finally {
    const totalEnd = new Date()

    logger.info(
      {
        type: 'run',
        start: totalStart.toISOString(),
        end: totalEnd.toISOString(),
        duration: totalEnd.valueOf() - totalStart.valueOf(),
      },
      'Migration process finished',
    )
  }
}

async function unlock() {
  try {
    await knexWithConfig.migrate.forceFreeMigrationsLock(migratorConfig)

    logger.info('Unlock succeed!')
  }
  catch (error) {
    logger.error('You might need to read http://knexjs.org/#Notes-about-locks')

    throw error
  }
}

async function rollback() {
  try {
    await knexWithConfig.migrate.rollback(migratorConfig)

    logger.info('Rollback succeed!')
  }
  catch (err) {
    logger.error(err, 'Rollback failed')

    throw err
  }
}

async function currentVersion() {
  try {
    const version = await knexWithConfig.migrate.currentVersion(migratorConfig)

    logger.info(`Current version is ${version}`)
  }
  catch (err) {
    logger.error(err, 'Unable to get current version')

    throw err
  }
}

function printHelp(): Promise<void> {
  return new Promise((resolve) => {
    console.log('make\t\t-\tCreate a migration file')
    console.log('rollback\t-\tRollback to previous batch of migrations')
    console.log('version\t\t-\tShow current version')
    console.log('latest\t\t-\tUpdate database to the latest migration')
    console.log('unlock\t\t-\tUnlock the knex_migrations table')
    console.log('help\t\t-\tShow this help\n')

    resolve()
  })
}

async function go(args: string[]) {
  switch (args[0]) {
    case 'make': {
      if (!args[1]) {
        throw new Error('Please provide a name for the migration, e.g., pnpm migrate make add_users_table')
      }

      return make(args[1])
    }
    case 'rollback': {
      return rollback()
    }
    case 'version': {
      return currentVersion()
    }
    case 'latest': {
      return latest()
    }
    case 'unlock': {
      return unlock()
    }
    default: {
      return printHelp()
    }
  }
}

go(process.argv.slice(2))
  .then(() => {
    if (knexWithConfig) {
      return knexWithConfig.destroy()
    }
  })
  .catch((err) => {
    logger.error(err, `Error: ${err}`)
    process.exit(1)
  })
