import { PDFProcessor, ExtractedData } from './pdf-processor'
import { CustomerDetector, CustomerDetectionResult } from './customer-detector'
import { TemplateEngine, ProcessingResult } from './template-engine'
import { prisma } from './prisma'
import { DocumentStatus, JobStatus } from '@prisma/client'
import * as csv from 'csv-writer'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface ProcessingRequest {
  documentId: string
  filePath: string
  fileName: string
  buffer: Buffer
  userId: string
}

export interface ProcessingResponse {
  success: boolean
  documentId: string
  processingJobId: string
  customerId?: string
  templateId?: string
  csvFilePath?: string
  extractedData?: Record<string, any>
  confidence: number
  errors: string[]
  warnings: string[]
  processingTime: number
}

export class ProcessingOrchestrator {
  private pdfProcessor: PDFProcessor
  private customerDetector: CustomerDetector
  private templateEngine: TemplateEngine
  private isInitialized = false

  constructor() {
    this.pdfProcessor = new PDFProcessor()
    this.customerDetector = new CustomerDetector()
    this.templateEngine = new TemplateEngine()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Initializing processing orchestrator...')

      await Promise.all([
        this.pdfProcessor.initialize()
        this.customerDetector.initialize()
        this.templateEngine.initialize()
      ])

      this.isInitialized = true
      console.log('Processing orchestrator initialized successfully')
    } catch (error) {
      console.error('Failed to initialize processing orchestrator:', error)
      throw error
    }
  }

  async processDocument(request: ProcessingRequest): Promise<ProcessingResponse> {
    const startTime = Date.now()
    const response: ProcessingResponse = {
      success: false
      documentId: request.documentId
      processingJobId: ''
      confidence: 0
      errors: []
      warnings: []
      processingTime: 0
    }

    // Create processing job
    const processingJob = await prisma.processingJob.create({
      data: {
        documentId: request.documentId
        status: JobStatus.RUNNING
        processedById: request.userId
        startedAt: new Date()
      }
    })

    response.processingJobId = processingJob.id

    try {
      await this.initialize()

      // Step 1: Extract text and data from PDF
      console.log(`Processing PDF: ${request.fileName}`)
      const extractedData = await this.pdfProcessor.processPDF(request.buffer)

      if (!extractedData.text || extractedData.text.length < 10) {
        throw new Error('Insufficient text extracted from PDF')
      }

      // Step 2: Detect customer
      console.log('Detecting customer...')
      const customerDetection = await this.customerDetector.detectCustomer(
        extractedData.text
        request.fileName
      )

      if (!customerDetection.customerId) {
        response.warnings.push('Could not automatically detect customer')

        // Update document with unknown customer
        await prisma.document.update({
          where: { id: request.documentId }
          data: {
            status: DocumentStatus.COMPLETED
            confidenceScore: 0
            detectionLog: {
              customerDetection
              extractedLength: extractedData.text.length
              confidence: 0
            }
          }
        })

        // Create basic CSV without template processing
        const csvData = await this.createBasicCSV(extractedData, request)
        response.csvFilePath = csvData.filePath
        response.extractedData = csvData.data
        response.confidence = 0.3
        response.success = true

      } else {
        console.log(`Customer detected: ${customerDetection.customerName} (confidence: ${customerDetection.confidence})`)

        // Step 3: Select appropriate template
        const template = await this.templateEngine.selectTemplate(
          customerDetection.customerId
          extractedData.text
        )

        if (!template) {
          response.warnings.push('No template found for detected customer')

          // Create basic CSV for known customer without template
          const csvData = await this.createBasicCSV(extractedData, request, customerDetection.customerId)
          response.csvFilePath = csvData.filePath
          response.extractedData = csvData.data
          response.confidence = customerDetection.confidence * 0.5
          response.success = true

        } else {
          console.log(`Using template: ${template.name}`)

          // Step 4: Process document with template
          const processingResult = await this.templateEngine.processDocument(
            template
            extractedData.text
            {
              tables: await this.pdfProcessor.extractTables(extractedData.text)
              keyValuePairs: await this.pdfProcessor.detectKeyValuePairs(extractedData.text)
              dates: await this.pdfProcessor.extractDates(extractedData.text)
              numbers: await this.pdfProcessor.extractNumbers(extractedData.text)
            }
          )

          // Step 5: Generate CSV
          const csvFilePath = await this.generateCSV(
            processingResult.extractedData
            template
            request
          )

          // Update response
          response.success = processingResult.success
          response.customerId = customerDetection.customerId
          response.templateId = template.id
          response.csvFilePath = csvFilePath
          response.extractedData = processingResult.extractedData
          response.confidence = (customerDetection.confidence + processingResult.confidence) / 2
          response.errors = processingResult.errors
          response.warnings = [...response.warnings, ...processingResult.warnings]

          // Update document in database
          await prisma.document.update({
            where: { id: request.documentId }
            data: {
              customerId: customerDetection.customerId
              templateId: template.id
              status: response.success ? DocumentStatus.COMPLETED : DocumentStatus.FAILED
              confidenceScore: response.confidence
              detectionLog: {
                customerDetection
                templateSelection: {
                  templateId: template.id
                  templateName: template.name
                }
                processingResult
                extractedLength: extractedData.text.length
              }
            }
          })

          // Create CSV output record
          if (csvFilePath) {
            const stats = await fs.stat(csvFilePath)
            await prisma.csvOutput.create({
              data: {
                documentId: request.documentId
                filePath: csvFilePath
                fileName: path.basename(csvFilePath)
                rowCount: Object.keys(processingResult.extractedData).length
                columnCount: 2, // Field name and value
                fileSize: stats.size
              }
            })
          }
        }
      }

      // Update processing job
      await prisma.processingJob.update({
        where: { id: processingJob.id }
        data: {
          status: response.success ? JobStatus.COMPLETED : JobStatus.FAILED
          completedAt: new Date()
          extractionLog: {
            customerDetection
            extractedDataLength: extractedData.text.length
            confidence: response.confidence
            errors: response.errors
            warnings: response.warnings
          }
        }
      })

    } catch (error) {
      console.error('Document processing failed:', error)
      response.errors.push(error.message)

      // Update processing job with error
      await prisma.processingJob.update({
        where: { id: processingJob.id }
        data: {
          status: JobStatus.FAILED
          errorMessage: error.message
          completedAt: new Date()
        }
      })

      // Update document status
      await prisma.document.update({
        where: { id: request.documentId }
        data: {
          status: DocumentStatus.FAILED
        }
      })
    }

    response.processingTime = Date.now() - startTime
    return response
  }

  private async createBasicCSV(
    extractedData: ExtractedData
    request: ProcessingRequest
    customerId?: string
  ): Promise<{ filePath: string; data: Record<string, any> }> {
    // Extract basic information
    const keyValuePairs = await this.pdfProcessor.detectKeyValuePairs(extractedData.text)
    const dates = await this.pdfProcessor.extractDates(extractedData.text)
    const numbers = await this.pdfProcessor.extractNumbers(extractedData.text)

    const basicData = {
      document_name: request.fileName
      extraction_date: new Date().toISOString()
      total_pages: extractedData.metadata.totalPages
      customer_id: customerId || 'unknown'
      ...keyValuePairs
    }

    if (dates.length > 0) {
      basicData.detected_dates = dates.map(d => d.toISOString()).join('; ')
    }

    if (numbers.currency.length > 0) {
      basicData.currency_amounts = numbers.currency.join('; ')
    }

    const csvFilePath = await this.generateCSV(basicData, null, request)
    return { filePath: csvFilePath, data: basicData }
  }

  private async generateCSV(
    data: Record<string, any>
    template: any
    request: ProcessingRequest
  ): Promise<string> {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = process.env.UPLOAD_DIR || './uploads'
      const csvDir = path.join(uploadsDir, 'csv')
      await fs.mkdir(csvDir, { recursive: true })

      // Generate CSV filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `${request.fileName.replace('.pdf', '')}_${timestamp}.csv`
      const csvFilePath = path.join(csvDir, fileName)

      // Prepare CSV data
      const csvRecords = Object.entries(data).map(([field, value]) => ({
        field_name: field
        field_value: this.formatValue(value)
        data_type: this.determineDataType(value)
      }))

      // Create CSV writer
      const csvWriter = csv.createObjectCsvWriter({
        path: csvFilePath
        header: [
          { id: 'field_name', title: 'Field Name' }
          { id: 'field_value', title: 'Field Value' }
          { id: 'data_type', title: 'Data Type' }
        ]
      })

      // Write CSV file
      await csvWriter.writeRecords(csvRecords)

      console.log(`CSV generated: ${csvFilePath}`)
      return csvFilePath

    } catch (error) {
      console.error('CSV generation failed:', error)
      throw new Error(`CSV generation failed: ${error.message}`)
    }
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return ''
    }

    if (Array.isArray(value)) {
      return value.join('; ')
    }

    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  }

  private determineDataType(value: any): string {
    if (value === null || value === undefined) {
      return 'null'
    }

    if (typeof value === 'number') {
      return 'number'
    }

    if (typeof value === 'boolean') {
      return 'boolean'
    }

    if (Array.isArray(value)) {
      return 'array'
    }

    if (typeof value === 'object') {
      return 'object'
    }

    const strValue = String(value)

    // Check for date
    if (!isNaN(Date.parse(strValue))) {
      return 'date'
    }

    // Check for currency
    if (/^\$?\d+\.?\d*$/.test(strValue.replace(/,/g, ''))) {
      return 'currency'
    }

    // Check for percentage
    if (/^\d+\.?\d*%$/.test(strValue)) {
      return 'percentage'
    }

    // Check for number
    if (!isNaN(parseFloat(strValue))) {
      return 'number'
    }

    return 'string'
  }

  async reprocessDocument(documentId: string, userId: string, templateId?: string): Promise<ProcessingResponse> {
    try {
      // Get the original document
      const document = await prisma.document.findUnique({
        where: { id: documentId }
      })

      if (!document) {
        throw new Error('Document not found')
      }

      // Read the original file
      const buffer = await fs.readFile(document.originalPath)

      // Create a new processing request
      const request: ProcessingRequest = {
        documentId
        filePath: document.originalPath
        fileName: document.filename
        buffer
        userId
      }

      // If specific template is requested, override customer detection
      if (templateId) {
        const template = await this.templateEngine.getTemplate(templateId)
        if (template) {
          // Create a reprocessing history entry
          await prisma.reprocessingHistory.create({
            data: {
              documentId
              version: await this.getNextVersion(documentId)
              changesMade: {
                action: 'manual_template_override'
                templateId
                templateName: template.name
                triggeredBy: userId
              }
              triggeredBy: userId
            }
          })
        }
      }

      // Process the document
      const result = await this.processDocument(request)

      return result

    } catch (error) {
      console.error('Document reprocessing failed:', error)
      throw error
    }
  }

  private async getNextVersion(documentId: string): Promise<number> {
    const latestVersion = await prisma.reprocessingHistory.findFirst({
      where: { documentId }
      orderBy: { version: 'desc' }
    })

    return (latestVersion?.version || 0) + 1
  }

  async getProcessingStats(): Promise<{
    totalProcessed: number
    successRate: number
    averageConfidence: number
    topErrors: string[]
  }> {
    try {
      const jobs = await prisma.processingJob.findMany({
        where: {
          status: { in: [JobStatus.COMPLETED, JobStatus.FAILED] }
        }
        include: {
          document: true
        }
      })

      const totalProcessed = jobs.length
      const successful = jobs.filter(job => job.status === JobStatus.COMPLETED).length
      const successRate = totalProcessed > 0 ? successful / totalProcessed : 0

      const documents = await prisma.document.findMany({
        where: {
          confidenceScore: { not: null }
        }
      })

      const averageConfidence = documents.length > 0
        ? documents.reduce((sum, doc) => sum + (doc.confidenceScore || 0), 0) / documents.length
        : 0

      const failedJobs = jobs.filter(job => job.status === JobStatus.FAILED)
      const errorCounts: Record<string, number> = {}

      failedJobs.forEach(job => {
        if (job.errorMessage) {
          errorCounts[job.errorMessage] = (errorCounts[job.errorMessage] || 0) + 1
        }
      })

      const topErrors = Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([error]) => error)

      return {
        totalProcessed
        successRate
        averageConfidence
        topErrors
      }

    } catch (error) {
      console.error('Failed to get processing stats:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    await this.pdfProcessor.cleanup()
  }
}