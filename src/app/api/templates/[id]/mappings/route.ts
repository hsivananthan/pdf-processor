import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccessResource } from "@/lib/auth-utils"
import { z } from "zod"

const createMappingSchema = z.object({
  sourcePattern: z.string().min(1).max(200),
  targetValue: z.string().min(1).max(200),
  fieldName: z.string().min(1).max(100),
  priority: z.number().min(0).max(10).default(0)
})

const updateMappingSchema = createMappingSchema.partial()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessResource(session.user.role, 'templates', 'view')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify template exists
    const template = await prisma.documentTemplate.findUnique({
      where: { id: id, isActive: true }
    })

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Get all mappings for this template
    const mappings = await prisma.hardcodedMapping.findMany({
      where: {
        templateId: id,
        isActive: true
      },
      orderBy: [
        { priority: 'desc' },
        { fieldName: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Group mappings by field name
    const mappingsByField = mappings.reduce((acc, mapping) => {
      if (!acc[mapping.fieldName]) {
        acc[mapping.fieldName] = []
      }
      acc[mapping.fieldName].push(mapping)
      return acc
    }, {} as Record<string, typeof mappings>)

    return NextResponse.json({
      templateId: id,
      templateName: template.name,
      mappings,
      mappingsByField,
      totalMappings: mappings.length,
      fieldCount: Object.keys(mappingsByField).length
    })

  } catch (error) {
    console.error('Error fetching mappings:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessResource(session.user.role, 'templates', 'edit')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validation = createMappingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      )
    }

    // Verify template exists
    const template = await prisma.documentTemplate.findUnique({
      where: { id: id, isActive: true }
    })

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const { sourcePattern, targetValue, fieldName, priority } = validation.data

    // Check for duplicate mapping (same pattern for same field)
    const existingMapping = await prisma.hardcodedMapping.findFirst({
      where: {
        templateId: id,
        fieldName,
        sourcePattern: {
          equals: sourcePattern
        },
        isActive: true
      }
    })

    if (existingMapping) {
      return NextResponse.json(
        { error: "A mapping with this pattern already exists for this field" },
        { status: 409 }
      )
    }

    // Create new mapping
    const mapping = await prisma.hardcodedMapping.create({
      data: {
        templateId: id,
        sourcePattern,
        targetValue,
        fieldName,
        priority
      }
    })

    // Log mapping creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_MAPPING",
        resource: "TEMPLATES",
        details: {
          templateId: id,
          mappingId: mapping.id,
          fieldName,
          sourcePattern,
          targetValue
        }
      }
    })

    return NextResponse.json({
      mapping,
      message: "Mapping created successfully"
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating mapping:', error)
    return NextResponse.json({
      error: "Mapping creation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}