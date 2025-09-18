import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccessResource, hasPermission } from "@/lib/auth-utils"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { ProcessingOrchestrator } from "@/lib/processing-orchestrator"
import { UserRole, DocumentStatus } from "@prisma/client"
import formidable from 'formidable'
import * as fs from 'fs/promises'
import * as path from 'path'

// Configure for larger file uploads
export const maxDuration = 300 // 5 minutes
export const maxFileSize = 50 * 1024 * 1024 // 50MB

const orchestrator = new ProcessingOrchestrator()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    if (!canAccessResource(session.user.role, 'documents', 'upload')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Rate limiting
    const clientIP = getClientIP(request)
    const rateLimitResult = await checkRateLimit(`upload:${session.user.id}:${clientIP}`, 'sensitive')

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before uploading another file." },
        { status: 429 }
      )
    }

    // Parse the multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const customerId = formData.get('customerId') as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 })
    }

    // Validate file size
    if (file.size > maxFileSize) {
      return NextResponse.json({
        error: `File size exceeds maximum limit of ${maxFileSize / 1024 / 1024}MB`
      }, { status: 400 })
    }

    // Validate filename
    if (!file.name || file.name.length > 255) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
    }

    // Sanitize filename
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')

    // Create uploads directory
    const uploadsDir = process.env.UPLOAD_DIR || './uploads'
    const documentsDir = path.join(uploadsDir, 'documents')
    await fs.mkdir(documentsDir, { recursive: true })

    // Generate unique filename
    const timestamp = Date.now()
    const uniqueFilename = `${timestamp}_${sanitizedFilename}`
    const filePath = path.join(documentsDir, uniqueFilename)

    // Save file to disk
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // Validate customer if provided
    if (customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId, isActive: true }
      })

      if (!customer) {
        // Clean up uploaded file
        await fs.unlink(filePath).catch(() => {})
        return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 })
      }
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        filename: sanitizedFilename,
        originalPath: filePath,
        fileSize: file.size,
        mimeType: file.type,
        customerId: customerId || undefined,
        uploadedById: session.user.id,
        status: DocumentStatus.UPLOADED
      }
    })

    // Log the upload
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPLOAD_DOCUMENT",
        resource: "DOCUMENTS",
        details: {
          documentId: document.id,
          filename: sanitizedFilename,
          fileSize: file.size,
          customerId: customerId
        }
      }
    })

    // Start processing in background (don't await)
    processDocumentAsync(document.id, filePath, sanitizedFilename, buffer, session.user.id)
      .catch(error => {
        console.error('Background processing failed:', error)
      })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        fileSize: document.fileSize,
        status: document.status,
        uploadedAt: document.createdAt,
        customerId: document.customerId
      },
      message: "File uploaded successfully. Processing started in background."
    }, { status: 201 })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: "Upload failed",
      details: error.message
    }, { status: 500 })
  }
}

// Background processing function
async function processDocumentAsync(
  documentId: string,
  filePath: string,
  fileName: string,
  buffer: Buffer,
  userId: string
) {
  try {
    console.log(`Starting background processing for document ${documentId}`)

    // Update document status to processing
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.PROCESSING }
    })

    // Process the document
    const result = await orchestrator.processDocument({
      documentId,
      filePath,
      fileName,
      buffer,
      userId
    })

    console.log(`Document ${documentId} processing completed:`, {
      success: result.success,
      confidence: result.confidence,
      customerId: result.customerId,
      templateId: result.templateId
    })

    // TODO: Send notification email/webhook here

  } catch (error) {
    console.error(`Background processing failed for document ${documentId}:`, error)

    // Update document status to failed
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.FAILED }
    }).catch(dbError => {
      console.error('Failed to update document status:', dbError)
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    if (!canAccessResource(session.user.role, 'documents', 'view')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const status = searchParams.get('status') as DocumentStatus | null
    const customerId = searchParams.get('customerId')

    const skip = (page - 1) * limit

    // Build where clause based on user role
    let where: any = {}

    // Regular users can only see their own documents
    if (session.user.role === UserRole.USER || session.user.role === UserRole.READONLY) {
      where.uploadedById = session.user.id
    }

    // Add filters
    if (status && Object.values(DocumentStatus).includes(status)) {
      where.status = status
    }

    if (customerId) {
      where.customerId = customerId
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true }
          },
          uploadedBy: {
            select: { id: true, name: true, email: true }
          },
          processingJobs: {
            select: { status: true, completedAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          csvOutputs: {
            select: { id: true, fileName: true, rowCount: true, columnCount: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.document.count({ where })
    ])

    return NextResponse.json({
      documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}