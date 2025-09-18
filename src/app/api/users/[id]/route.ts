import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hashPassword, validatePassword, hasPermission } from "@/lib/auth-utils"
import { UserRole } from "@prisma/client"
import { z } from "zod"

const updateUserSchema = z.object({
  email: z.string().email().optional()
  password: z.string().min(8).optional()
  name: z.string().optional()
  role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.USER, UserRole.READONLY]).optional()
  isActive: z.boolean().optional()
})

export async function GET(
  request: NextRequest
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Users can view their own profile, managers/admins can view any user
    const canView = session.user.id === id || hasPermission(session.user.role, UserRole.MANAGER)

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: id }
      select: {
        id: true
        email: true
        name: true
        role: true
        isActive: true
        lastLogin: true
        createdAt: true
        updatedAt: true
        failedAttempts: true
        lockedUntil: true
        _count: {
          select: {
            documents: true
            processingJobs: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user })

  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validation = updateUserSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues }
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Permission checks
    const isOwnProfile = session.user.id === id
    const isAdmin = session.user.role === UserRole.ADMIN
    const isManager = session.user.role === UserRole.MANAGER

    // Users can only edit their own profile (limited fields)
    if (isOwnProfile && !isAdmin && !isManager) {
      const allowedFields = ['name', 'password']
      const requestedFields = Object.keys(validation.data)
      const hasRestrictedFields = requestedFields.some(field => !allowedFields.includes(field))

      if (hasRestrictedFields) {
        return NextResponse.json({ error: "Forbidden: Can only edit name and password" }, { status: 403 })
      }
    }

    // Only admins can edit role and isActive
    if (!isAdmin && (validation.data.role !== undefined || validation.data.isActive !== undefined)) {
      return NextResponse.json({ error: "Forbidden: Only admins can edit role and active status" }, { status: 403 })
    }

    // Managers and admins can edit other users (except admins can't be edited by managers)
    if (!isOwnProfile && !isAdmin && (!isManager || existingUser.role === UserRole.ADMIN)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updateData: any = { ...validation.data }

    // Hash password if provided
    if (updateData.password) {
      const passwordValidation = validatePassword(updateData.password)
      if (!passwordValidation.isValid) {
        return NextResponse.json(
          { error: "Password validation failed", details: passwordValidation.errors }
          { status: 400 }
        )
      }
      updateData.passwordHash = await hashPassword(updateData.password)
      delete updateData.password

      // Reset failed attempts when password is changed
      updateData.failedAttempts = 0
      updateData.lockedUntil = null
    }

    // Check for email uniqueness if email is being updated
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: updateData.email }
      })

      if (emailExists) {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: id }
      data: updateData
      select: {
        id: true
        email: true
        name: true
        role: true
        isActive: true
        lastLogin: true
        createdAt: true
        updatedAt: true
      }
    })

    // Log user update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id
        action: "UPDATE_USER"
        resource: "USERS"
        details: {
          targetUserId: id
          changes: Object.keys(validation.data)
          isOwnProfile
        }
      }
    })

    return NextResponse.json({ user: updatedUser })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can delete users
    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Prevent self-deletion
    if (session.user.id === id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: id }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Soft delete by deactivating instead of hard delete to preserve audit trail
    await prisma.user.update({
      where: { id: id }
      data: {
        isActive: false
        // Optionally anonymize email to prevent conflicts
        email: `deleted_${Date.now()}_${user.email}`
      }
    })

    // Log user deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id
        action: "DELETE_USER"
        resource: "USERS"
        details: {
          targetUserId: id
          targetUserEmail: user.email
        }
      }
    })

    return NextResponse.json({ message: "User deleted successfully" })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}