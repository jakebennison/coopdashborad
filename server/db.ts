import { Pool, type PoolClient } from 'pg'

let pool: Pool | null = null

export const isDatabaseConfigured = () => Boolean(process.env.DATABASE_URL?.trim())

export const getPool = () => {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured.')
  }

  if (!pool) {
    const connectionString = process.env.DATABASE_URL!.trim()
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
    })
  }

  return pool
}

export const withDbClient = async <T>(run: (client: PoolClient) => Promise<T>) => {
  const client = await getPool().connect()
  try {
    return await run(client)
  } finally {
    client.release()
  }
}

export const initDatabase = async () => {
  if (!isDatabaseConfigured()) return false

  await getPool().query(`
    CREATE TABLE IF NOT EXISTS matches (
      id BIGINT PRIMARY KEY,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  return true
}
