import { Pool } from "pg"

// Create a new pool using the connection string
const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_lSxTym5v4FuJ@ep-twilight-sunset-a14pm7xl-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
})

// Helper function to run queries
export async function query(text, params) {
  try {
    const start = Date.now()
    const result = await pool.query(text, params)
    const duration = Date.now() - start
    return result
  } catch (error) {
    console.error("Query error:", error)
    throw error
  }
}

// User-related database functions
export async function getUserByPhone(phone) {
  const result = await query("SELECT * FROM users WHERE phone_number = $1", [phone])
  return result.rows[0]
}

export async function createUser(name, phone, passwordHash) {
  const result = await query(
    "INSERT INTO users (name, phone_number, password) VALUES ($1, $2, $3) RETURNING id, name, phone_number, created_at",
    [name, phone, passwordHash],
  )
  return result.rows[0]
}

// Test the database connection
export async function testConnection() {
  try {
    const result = await query("SELECT NOW()")
    return true
  } catch (error) {
    console.error("Database connection failed:", error)
    return false
  }
}
