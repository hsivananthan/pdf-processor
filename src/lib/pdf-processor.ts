import pdfParse from 'pdf-parse'
import Tesseract from 'tesseract.js'
import { createWorker } from 'tesseract.js'

export interface ExtractedData {
  text: string
  pages: PageData[]
  metadata: {
    totalPages: number
    author?: string
    creator?: string
    creationDate?: Date
    modificationDate?: Date
  }
  confidence: number
}

export interface PageData {
  pageNumber: number
  text: string
  tables?: TableData[]
  images?: ImageData[]
  confidence: number
}

export interface TableData {
  rows: string[][]
  headers?: string[]
  position: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface ImageData {
  base64: string
  position: {
    x: number
    y: number
    width: number
    height: number
  }
  extractedText?: string
}

export class PDFProcessor {
  private tesseractWorker: Tesseract.Worker | null = null

  async initialize(): Promise<void> {
    try {
      this.tesseractWorker = await createWorker('eng')
      await this.tesseractWorker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,!?@#$%^&*()_+-=[]{}|;:\'",.<>/?`~\\'
      })
    } catch (error) {
      console.error('Failed to initialize Tesseract worker:', error)
      throw new Error('OCR initialization failed')
    }
  }

  async processPDF(buffer: Buffer): Promise<ExtractedData> {
    try {
      // First, try to extract text directly from PDF
      const directExtraction = await this.extractTextDirectly(buffer)

      // If direct extraction yields good results, use it
      if (directExtraction.text.length > 100 && this.isTextMeaningful(directExtraction.text)) {
        return {
          ...directExtraction,
          confidence: 0.95
        }
      }

      // Otherwise, fall back to OCR
      console.log('Direct text extraction insufficient, using OCR...')
      return await this.extractTextWithOCR(buffer)

    } catch (error) {
      console.error('PDF processing failed:', error)
      throw new Error(`PDF processing failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  private async extractTextDirectly(buffer: Buffer): Promise<ExtractedData> {
    try {
      const data = await pdfParse(buffer)

      const pages: PageData[] = []
      const textPerPage = data.text.split('\f') // Form feed character separates pages

      textPerPage.forEach((pageText, index) => {
        if (pageText.trim()) {
          pages.push({
            pageNumber: index + 1,
            text: pageText.trim(),
            confidence: 0.95
          })
        }
      })

      return {
        text: data.text,
        pages,
        metadata: {
          totalPages: data.numpages,
          author: data.info?.Author,
          creator: data.info?.Creator,
          creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
          modificationDate: data.info?.ModDate ? new Date(data.info.ModDate) : undefined
        },
        confidence: 0.95
      }
    } catch (error) {
      throw new Error(`Direct text extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  private async extractTextWithOCR(buffer: Buffer): Promise<ExtractedData> {
    if (!this.tesseractWorker) {
      await this.initialize()
    }

    try {
      // Convert PDF to images first (this would require pdf2pic in a real implementation)
      // For now, we'll work with the assumption that we have image data

      const { data } = await this.tesseractWorker!.recognize(buffer)

      const pages: PageData[] = [{
        pageNumber: 1,
        text: data.text,
        confidence: data.confidence / 100
      }]

      return {
        text: data.text,
        pages,
        metadata: {
          totalPages: 1 // This would be determined from the PDF conversion
        },
        confidence: data.confidence / 100
      }
    } catch (error) {
      throw new Error(`OCR extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  private isTextMeaningful(text: string): boolean {
    // Check if the extracted text contains meaningful content
    const words = text.split(/\s+/).filter(word => word.length > 2)
    const meaningfulWords = words.filter(word => /^[a-zA-Z]+$/.test(word))

    // At least 50% of words should be alphabetic and meaningful
    return meaningfulWords.length / words.length > 0.5
  }

  async extractTables(text: string): Promise<TableData[]> {
    const tables: TableData[] = []

    // Simple table detection based on common patterns
    const lines = text.split('\n')
    let currentTable: string[][] = []
    let isInTable = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Detect table-like structures (multiple columns separated by spaces/tabs)
      if (this.looksLikeTableRow(line)) {
        const columns = this.parseTableRow(line)
        currentTable.push(columns)
        isInTable = true
      } else if (isInTable && currentTable.length > 0) {
        // End of table detected
        if (currentTable.length >= 2) { // At least 2 rows to be considered a table
          tables.push({
            rows: currentTable,
            headers: currentTable[0], // First row as headers
            position: { x: 0, y: i - currentTable.length, width: 100, height: currentTable.length }
          })
        }
        currentTable = []
        isInTable = false
      }
    }

    // Handle table at end of document
    if (currentTable.length >= 2) {
      tables.push({
        rows: currentTable,
        headers: currentTable[0],
        position: { x: 0, y: lines.length - currentTable.length, width: 100, height: currentTable.length }
      })
    }

    return tables
  }

  private looksLikeTableRow(line: string): boolean {
    // Check if line has multiple columns (at least 2 separated by multiple spaces or tabs)
    const potentialColumns = line.split(/\s{2,}|\t+/).filter(col => col.trim().length > 0)
    return potentialColumns.length >= 2
  }

  private parseTableRow(line: string): string[] {
    // Split by multiple spaces or tabs and clean up
    return line.split(/\s{2,}|\t+/)
      .map(col => col.trim())
      .filter(col => col.length > 0)
  }

  async detectKeyValuePairs(text: string): Promise<Record<string, string>> {
    const keyValuePairs: Record<string, string> = {}
    const lines = text.split('\n')

    for (const line of lines) {
      // Common patterns for key-value pairs
      const patterns = [
        /^([^:]+):\s*(.+)$/, // "Key: Value"
        /^([^=]+)=\s*(.+)$/, // "Key = Value"
        /^([A-Z][A-Za-z\s]+)\s+([A-Za-z0-9\s\-$.,]+)$/, // "Invoice Number INV-123"
      ]

      for (const pattern of patterns) {
        const match = line.trim().match(pattern)
        if (match) {
          const key = match[1].trim().toLowerCase().replace(/\s+/g, '_')
          const value = match[2].trim()

          if (value.length > 0 && value.length < 200) { // Reasonable value length
            keyValuePairs[key] = value
          }
          break
        }
      }
    }

    return keyValuePairs
  }

  async extractDates(text: string): Promise<Date[]> {
    const dates: Date[] = []

    // Common date patterns
    const datePatterns = [
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g, // MM/DD/YYYY or MM-DD-YYYY
      /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g, // YYYY/MM/DD or YYYY-MM-DD
      /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/gi, // DD Month YYYY
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/gi, // Month DD, YYYY
    ]

    for (const pattern of datePatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        try {
          const dateStr = match[0]
          const parsedDate = new Date(dateStr)

          if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900 && parsedDate.getFullYear() < 2100) {
            dates.push(parsedDate)
          }
        } catch (error) {
          // Skip invalid dates
        }
      }
    }

    return [...new Set(dates.map(d => d.getTime()))].map(time => new Date(time)) // Remove duplicates
  }

  async extractNumbers(text: string): Promise<{ currency: number[], percentages: number[], general: number[] }> {
    const numbers = {
      currency: [] as number[],
      percentages: [] as number[],
      general: [] as number[]
    }

    // Currency patterns
    const currencyPattern = /[\$£€¥]\s*?([\d,]+\.?\d*)/g
    let match
    while ((match = currencyPattern.exec(text)) !== null) {
      const value = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(value)) {
        numbers.currency.push(value)
      }
    }

    // Percentage patterns
    const percentagePattern = /([\d,]+\.?\d*)\s*%/g
    while ((match = percentagePattern.exec(text)) !== null) {
      const value = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(value)) {
        numbers.percentages.push(value)
      }
    }

    // General numbers
    const generalPattern = /\b([\d,]+\.?\d*)\b/g
    while ((match = generalPattern.exec(text)) !== null) {
      const value = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(value) && value > 0) {
        numbers.general.push(value)
      }
    }

    return numbers
  }

  async cleanup(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate()
      this.tesseractWorker = null
    }
  }
}