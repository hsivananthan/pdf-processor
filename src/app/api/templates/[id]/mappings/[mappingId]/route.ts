import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccessResource } from "@/lib/auth-utils"
import { z } from "zod"

const updateMappingSchema = z.object({
  sourcePattern: z.string().min(1).max(200).optional()
  targetValue: z.string().min(1).max(200).optional()
  fieldName: z.string().min(1).max(100).optional()
  priority: z.number().min(0).max(10).optional()
  isActive: z.boolean().optional()
})

export async function GET(
  request: NextRequest
  { params }: { params: Promise<{ id: string; mappingId: string }> }
) {
  const { id, mappingId } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessResource(session.user.role, 'templates', 'view')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const mapping = await prisma.hardcodedMapping.findUnique({
      where: {
        id: mappingId
        templateId: id
      }
      include: {
        template: {
          select: { id: true, name: true, customerId: true }
        }
      }
    })

    if (!mapping) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 })
    }

    return NextResponse.json({ mapping })

  } catch (error) {
    console.error('Error fetching mapping:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest
  { params }: { params: Promise<{ id: string; mappingId: string }> }
) {
  const { id, mappingId } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessResource(session.user.role, 'templates', 'edit')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validation = updateMappingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues }
        { status: 400 }
      )
    }

    // Verify mapping exists
    const existingMapping = await prisma.hardcodedMapping.findUnique({
      where: {
        id: mappingId
        templateId: id
      }
    })

    if (!existingMapping) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 })
    }

    const updateData = validation.data

    // Check for duplicate if sourcePattern or fieldName is being updated
    if (updateData.sourcePattern || updateData.fieldName) {
      const checkPattern = updateData.sourcePattern || existingMapping.sourcePattern
      const checkField = updateData.fieldName || existingMapping.fieldName

      const duplicateMapping = await prisma.hardcodedMapping.findFirst({
        where: {
          templateId: id
          fieldName: checkField
          sourcePattern: {
            equals: checkPattern
            
          }
          isActive: true
          id: { not: mappingId }
        }
      })

      if (duplicateMapping) {
        return NextResponse.json(
          { error: "A mapping with this pattern already exists for this field" }
          { status: 409 }
        )
      }
    }

    // Update mapping
    const updatedMapping = await prisma.hardcodedMapping.update({
      where: { id: mappingId }
      data: updateData
    })

    // Log mapping update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id
        action: "UPDATE_MAPPING"
        resource: "TEMPLATES"
        details: {
          templateId: id
          mappingId: mappingId
          changes: Object.keys(updateData)
          oldValues: {
            sourcePattern: existingMapping.sourcePattern
            targetValue: existingMapping.targetValue
            fieldName: existingMapping.fieldName
            priority: existingMapping.priority
            isActive: existingMapping.isActive
          }
          newValues: updateData
        }
      }
    })

    return NextResponse.json({
      mapping: updatedMapping
      message: "Mapping updated successfully"
    })

  } catch (error) {
    console.error('Error updating mapping:', error)
    return NextResponse.json({
      error: "Mapping update failed"
      details: error.message
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest
  { params }: { params: Promise<{ id: string; mappingId: string }> }
) {
  const { id, mappingId } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!canAccessResource(session.user.role, 'templates', 'edit')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify mapping exists
    const mapping = await prisma.hardcodedMapping.findUnique({
      where: {
        id: mappingId
        templateId: id
      }
    })

    if (!mapping) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 })
    }

    // Soft delete by setting isActive to false
    await prisma.hardcodedMapping.update({
      where: { id: mappingId }
      data: { isActive: false }
    })

    // Log mapping deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id
        action: "DELETE_MAPPING"
        resource: "TEMPLATES"
        details: {
          templateId: id
          mappingId: mappingId
          sourcePattern: mapping.sourcePattern
          targetValue: mapping.targetValue
          fieldName: mapping.fieldName
        }
      }
    })

    return NextResponse.json({
      message: "Mapping deleted successfully"
    })

  } catch (error) {
    console.error('Error deleting mapping:', error)
    return NextResponse.json({
      error: "Mapping deletion failed"
      details: error.message
    }, { status: 500 })
  }
}