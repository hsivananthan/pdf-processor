/**
 * Database Configuration Management
 * This module handles database connection configuration
 * All sensitive data is stored in environment variables
 */

import { z } from 'zod'

// Database connection configuration schema
const DatabaseConfigSchema = z.object({
  provider: z.enum(['postgresql', 'mysql', 'sqlite']),
  connectionString: z.string().url().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().default(true),
  pooling: z.boolean().default(true)
})

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>

/**
 * Get current database configuration from environment
 * Never expose passwords in API responses
 */
export function getDatabaseConfig(): Partial<DatabaseConfig> {
  const url = process.env.DATABASE_URL

  if (!url) {
    return {
      provider: 'postgresql',
      ssl: true,
      pooling: true
    }
  }

  try {
    const urlObj = new URL(url)

    return {
      provider: urlObj.protocol.replace(':', '') as 'postgresql' | 'mysql' | 'sqlite',
      host: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port) : undefined,
      database: urlObj.pathname.replace('/', ''),
      username: urlObj.username,
      // Never return password
      password: undefined,
      ssl: urlObj.searchParams.get('sslmode') === 'require',
      pooling: urlObj.hostname.includes('pooler')
    }
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error)
    return {
      provider: 'postgresql',
      ssl: true,
      pooling: true
    }
  }
}

/**
 * Test database connection
 * Returns connection status without exposing sensitive data
 */
export async function testDatabaseConnection(): Promise<{
  success: boolean
  message: string
  details?: {
    provider: string
    host: string
    database: string
    ssl: boolean
    pooling: boolean
  }
}> {
  try {
    // Import prisma dynamically to test connection
    const { prisma } = await import('@/lib/prisma')

    // Try a simple query
    await prisma.$queryRaw`SELECT 1`

    const config = getDatabaseConfig()

    return {
      success: true,
      message: 'Database connection successful',
      details: {
        provider: config.provider || 'unknown',
        host: config.host || 'unknown',
        database: config.database || 'unknown',
        ssl: config.ssl || false,
        pooling: config.pooling || false
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Database connection failed'
    }
  }
}

/**
 * Validate database URL format
 */
export function validateDatabaseUrl(url: string): {
  isValid: boolean
  error?: string
} {
  try {
    const urlObj = new URL(url)

    // Check protocol
    if (!['postgresql:', 'postgres:', 'mysql:', 'sqlite:'].includes(urlObj.protocol)) {
      return {
        isValid: false,
        error: 'Invalid database protocol. Use postgresql://, mysql://, or sqlite://'
      }
    }

    // Check required components for non-SQLite
    if (urlObj.protocol !== 'sqlite:') {
      if (!urlObj.hostname) {
        return {
          isValid: false,
          error: 'Database host is required'
        }
      }

      if (!urlObj.pathname || urlObj.pathname === '/') {
        return {
          isValid: false,
          error: 'Database name is required'
        }
      }

      if (!urlObj.username) {
        return {
          isValid: false,
          error: 'Database username is required'
        }
      }
    }

    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid database URL format'
    }
  }
}

/**
 * Get database connection status for display
 */
export function getConnectionStatus(): {
  configured: boolean
  provider: string
  status: 'connected' | 'disconnected' | 'error' | 'not_configured'
} {
  const url = process.env.DATABASE_URL

  if (!url) {
    return {
      configured: false,
      provider: 'Not configured',
      status: 'not_configured'
    }
  }

  const config = getDatabaseConfig()

  return {
    configured: true,
    provider: config.provider || 'unknown',
    status: 'connected' // This would be determined by actual connection test
  }
}