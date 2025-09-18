import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccessResource } from "@/lib/auth-utils"
import { UserRole } from "@prisma/client"
import { z } from "zod"

const createTemplateSchema = z.object({
  customerId: z.string().cuid()
  name: z.string().min(1).max(100)
  description: z.string().optional()
  extractionRules: z.array(z.object({
    fieldName: z.string()
    extractionType: z.enum(['regex', 'position', 'table', 'keyword', 'calculation'])
    pattern: z.string().optional()
    position: z.object({
      page: z.number().optional()
      x: z.number().optional()
      y: z.number().optional()
      width: z.number().optional()
      height: z.number().optional()
    }).optional()
    tableConfig: z.object({
      tableIndex: z.number()
      columnIndex: z.number()
      rowIndex: z.number().optional()
      headerName: z.string().optional()
    }).optional()
    keywordConfig: z.object({
      keywords: z.array(z.string())
      searchRadius: z.number()
      direction: z.enum(['before', 'after', 'same_line'])
    }).optional()
    calculationConfig: z.object({
      operation: z.enum(['sum', 'multiply', 'subtract', 'divide'])
      sourceFields: z.array(z.string())
      formula: z.string().optional()
    }).optional()
    validation: z.object({
      dataType: z.enum(['string', 'number', 'date', 'currency', 'percentage'])
      required: z.boolean()
      minLength: z.number().optional()
      maxLength: z.number().optional()
      pattern: z.string().optional()
    }).optional()
  }))
  fieldMappings: z.record(z.string())
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessResource(session.user.role, 'templates', 'view')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))

    const skip = (page - 1) * limit

    const where: any = {
      isActive: true
    }

    if (customerId) {
      where.customerId = customerId
    }

    const [templates, total] = await Promise.all([
      prisma.documentTemplate.findMany({
        where
        include: {
          customer: {
            select: { id: true, name: true }
          }
          createdBy: {
            select: { id: true, name: true, email: true }
          }
          hardcodedMappings: {
            where: { isActive: true }
            orderBy: { priority: 'desc' }
          }
          extractionFields: true
          _count: {
            select: {
              documents: true
            }
          }
        }
        skip
        take: limit
        orderBy: { createdAt: 'desc' }
      })
      prisma.documentTemplate.count({ where })
    ])

    return NextResponse.json({
      templates
      pagination: {
        page
        limit
        total
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessResource(session.user.role, 'templates', 'create')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validation = createTemplateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues }
        { status: 400 }
      )
    }

    const { customerId, name, description, extractionRules, fieldMappings } = validation.data

    // Verify customer exists and user has access
    const customer = await prisma.customer.findUnique({
      where: { id: customerId, isActive: true }
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Check for duplicate template name for the same customer
    const existingTemplate = await prisma.documentTemplate.findFirst({
      where: {
        customerId
        name
        isActive: true
      }
    })

    if (existingTemplate) {
      return NextResponse.json(
        { error: "Template with this name already exists for this customer" }
        { status: 409 }
      )
    }

    // Create template in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the main template
      const template = await tx.documentTemplate.create({
        data: {
          customerId
          name
          description
          extractionRules: extractionRules as any
          fieldMappings: fieldMappings as any
          createdById: session.user.id
        }
      })

      // Create extraction fields
      if (extractionRules.length > 0) {
        await tx.extractionField.createMany({
          data: extractionRules.map(rule => ({
            templateId: template.id
            fieldName: rule.fieldName
            dataType: rule.validation?.dataType || 'string'
            validationRules: rule.validation as any
            isRequired: rule.validation?.required || false
            extractionZone: {
              type: rule.extractionType
              config: rule.tableConfig || rule.keywordConfig || rule.calculationConfig || {}
            }
          }))
        })
      }

      return template
    })

    // Log template creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id
        action: "CREATE_TEMPLATE"
        resource: "TEMPLATES"
        details: {
          templateId: result.id
          templateName: result.name
          customerId: result.customerId
          extractionRulesCount: extractionRules.length
        }
      }
    })

    return NextResponse.json({
      template: result
      message: "Template created successfully"
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({
      error: "Template creation failed"
      details: error.message
    }, { status: 500 })
  }
}