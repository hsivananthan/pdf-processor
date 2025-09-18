import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccessResource } from "@/lib/auth-utils"
import { z } from "zod"

const createCustomerSchema = z.object({
  name: z.string().min(1).max(100)
  identifierPatterns: z.array(z.object({
    type: z.enum(['text', 'regex', 'position', 'header', 'footer'])
    pattern: z.string()
    weight: z.number().min(0).max(10).default(1)
    caseSensitive: z.boolean().default(false)
  }))
  contactInfo: z.object({
    email: z.string().email().optional()
    phone: z.string().optional()
    address: z.string().optional()
  }).optional()
  accessPermissions: z.record(z.string(), z.boolean()).optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessResource(session.user.role, 'customers', 'view')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const search = searchParams.get('search')?.replace(/[^\w\s.-]/g, '').slice(0, 100) || ''

    const skip = (page - 1) * limit

    interface WhereClause {
      isActive: boolean
      name?: {
        contains: string
        
      }
    }

    const where: WhereClause = {
      isActive: true
    }

    if (search) {
      where.name = {
        contains: search
        
      }
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where
        include: {
          templates: {
            where: { isActive: true }
            select: { id: true, name: true, version: true }
          }
          documents: {
            select: { status: true }
            take: 100 // Limit for counting
          }
          _count: {
            select: {
              documents: true
              templates: true
            }
          }
        }
        skip
        take: limit
        orderBy: { name: 'asc' }
      })
      prisma.customer.count({ where })
    ])

    // Calculate processing stats for each customer
    const customersWithStats = customers.map(customer => {
      const documentStats = customer.documents.reduce((acc, doc) => {
        acc[doc.status] = (acc[doc.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        ...customer
        documentStats
        documents: undefined // Remove documents array from response
      }
    })

    return NextResponse.json({
      customers: customersWithStats
      pagination: {
        page
        limit
        total
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessResource(session.user.role, 'customers', 'create')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validation = createCustomerSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues }
        { status: 400 }
      )
    }

    const { name, identifierPatterns, contactInfo, accessPermissions } = validation.data

    // Check for duplicate customer name
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        name: {
          equals: name
        }
        isActive: true
      }
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: "Customer with this name already exists" }
        { status: 409 }
      )
    }

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        name
        identifierPatterns: identifierPatterns as object
        contactInfo: contactInfo as object
        accessPermissions: accessPermissions as object
      }
    })

    // Log customer creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id
        action: "CREATE_CUSTOMER"
        resource: "CUSTOMERS"
        details: {
          customerId: customer.id
          customerName: customer.name
          patternsCount: identifierPatterns.length
        }
      }
    })

    return NextResponse.json({
      customer
      message: "Customer created successfully"
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json({
      error: "Customer creation failed"
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}