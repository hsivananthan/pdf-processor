import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { UserRole } from "@prisma/client"
import { getDatabaseConfig, testDatabaseConnection } from "@/lib/database-config"

/**
 * GET /api/settings/database
 * Get current database configuration (without sensitive data)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can view database settings
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const config = getDatabaseConfig()

    return NextResponse.json({
      configured: !!process.env.DATABASE_URL,
      config: {
        provider: config.provider,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        ssl: config.ssl,
        pooling: config.pooling
      },
      environment: process.env.NODE_ENV,
      // Show if using default or custom database URL
      source: process.env.DATABASE_URL ? 'environment' : 'not_configured'
    })
  } catch (error) {
    console.error('Error fetching database config:', error)
    return NextResponse.json({
      error: "Failed to fetch database configuration"
    }, { status: 500 })
  }
}

/**
 * POST /api/settings/database/test
 * Test database connection
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can test database connection
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await testDatabaseConnection()

    // Log the test attempt
    if (result.success) {
      console.log('Database connection test successful')
    } else {
      console.error('Database connection test failed:', result.message)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error testing database connection:', error)
    return NextResponse.json({
      success: false,
      message: "Failed to test database connection",
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}