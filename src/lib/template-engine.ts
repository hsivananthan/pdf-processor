import { prisma } from '@/lib/prisma'
import { DocumentTemplate, HardcodedMapping, ExtractionField } from '@prisma/client'

export interface TemplateWithMappings extends DocumentTemplate {
  hardcodedMappings: HardcodedMapping[]
  extractionFields: ExtractionField[]
}

export interface ExtractionRule {
  fieldName: string
  extractionType: 'regex' | 'position' | 'table' | 'keyword' | 'calculation'
  pattern?: string
  position?: {
    page?: number
    x?: number
    y?: number
    width?: number
    height?: number
  }
  tableConfig?: {
    tableIndex: number
    columnIndex: number
    rowIndex?: number
    headerName?: string
  }
  keywordConfig?: {
    keywords: string[]
    searchRadius: number
    direction: 'before' | 'after' | 'same_line'
  }
  calculationConfig?: {
    operation: 'sum' | 'multiply' | 'subtract' | 'divide'
    sourceFields: string[]
    formula?: string
  }
  validation?: {
    dataType: 'string' | 'number' | 'date' | 'currency' | 'percentage'
    required: boolean
    minLength?: number
    maxLength?: number
    pattern?: string
  }
}

export interface ProcessingResult {
  success: boolean
  extractedData: Record<string, any>
  confidence: number
  errors: string[]
  warnings: string[]
  processingTime: number
}

export class TemplateEngine {
  private templates: Map<string, TemplateWithMappings> = new Map()

  async initialize(): Promise<void> {
    try {
      const templates = await prisma.documentTemplate.findMany({
        where: { isActive: true },
        include: {
          hardcodedMappings: {
            where: { isActive: true },
            orderBy: { priority: 'desc' }
          },
          extractionFields: true
        }
      })

      this.templates.clear()
      templates.forEach(template => {
        this.templates.set(template.id, template)
      })

      console.log(`Loaded ${templates.length} active templates`)
    } catch (error) {
      console.error('Failed to initialize template engine:', error)
      throw new Error('Template engine initialization failed')
    }
  }

  async selectTemplate(customerId: string, extractedText: string): Promise<TemplateWithMappings | null> {
    // Get all templates for the customer
    const customerTemplates = Array.from(this.templates.values())
      .filter(template => template.customerId === customerId)

    if (customerTemplates.length === 0) {
      return null
    }

    // If only one template, use it
    if (customerTemplates.length === 1) {
      return customerTemplates[0]
    }

    // Score templates based on how well they match the document
    const templateScores = await Promise.all(
      customerTemplates.map(async template => ({
        template,
        score: await this.scoreTemplate(template, extractedText)
      }))
    )

    // Sort by score and return the best match
    templateScores.sort((a, b) => b.score - a.score)

    return templateScores[0]?.score > 0.3 ? templateScores[0].template : customerTemplates[0]
  }

  private async scoreTemplate(template: TemplateWithMappings, text: string): Promise<number> {
    let score = 0
    let totalChecks = 0

    try {
      const extractionRules = template.extractionRules as any as ExtractionRule[]

      for (const rule of extractionRules) {
        totalChecks++

        switch (rule.extractionType) {
          case 'keyword':
            if (rule.keywordConfig) {
              const found = rule.keywordConfig.keywords.some(keyword =>
                text.toLowerCase().includes(keyword.toLowerCase())
              )
              if (found) score++
            }
            break

          case 'regex':
            if (rule.pattern) {
              try {
                const regex = new RegExp(rule.pattern, 'gi')
                if (regex.test(text)) score++
              } catch (e) {
                // Invalid regex, skip
              }
            }
            break

          case 'position':
            // Position-based extraction assumes the document has consistent structure
            // This is a simplified check - in practice, you'd need PDF coordinate analysis
            score += 0.5
            break
        }
      }

      // Check if template-specific keywords exist in the document
      const templateName = template.name.toLowerCase()
      if (templateName.includes('invoice') && text.toLowerCase().includes('invoice')) {
        score += 2
      }
      if (templateName.includes('receipt') && text.toLowerCase().includes('receipt')) {
        score += 2
      }
      if (templateName.includes('statement') && text.toLowerCase().includes('statement')) {
        score += 2
      }

      totalChecks += 3 // For the template name checks

    } catch (error) {
      console.error('Error scoring template:', error)
    }

    return totalChecks > 0 ? score / totalChecks : 0
  }

  async processDocument(
    template: TemplateWithMappings,
    extractedText: string,
    extractedData: any
  ): Promise<ProcessingResult> {
    const startTime = Date.now()
    const result: ProcessingResult = {
      success: false,
      extractedData: {},
      confidence: 0,
      errors: [],
      warnings: [],
      processingTime: 0
    }

    try {
      const extractionRules = template.extractionRules as any as ExtractionRule[]
      let totalFields = 0
      let successfulExtractions = 0

      // Process each extraction rule
      for (const rule of extractionRules) {
        totalFields++

        try {
          const extractedValue = await this.extractField(rule, extractedText, extractedData)

          if (extractedValue !== null && extractedValue !== undefined) {
            // Apply hardcoded mappings
            const mappedValue = this.applyHardcodedMappings(
              template.hardcodedMappings,
              rule.fieldName,
              extractedValue
            )

            // Validate the extracted value
            const validationResult = this.validateField(rule, mappedValue)

            if (validationResult.isValid) {
              result.extractedData[rule.fieldName] = mappedValue
              successfulExtractions++
            } else {
              result.warnings.push(`Validation failed for ${rule.fieldName}: ${validationResult.errors.join(', ')}`)
              result.extractedData[rule.fieldName] = mappedValue // Include anyway with warning
            }
          } else {
            if (rule.validation?.required) {
              result.errors.push(`Required field '${rule.fieldName}' could not be extracted`)
            } else {
              result.warnings.push(`Optional field '${rule.fieldName}' could not be extracted`)
            }
          }
        } catch (error) {
          result.errors.push(`Error extracting field '${rule.fieldName}': ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }

      // Calculate confidence based on successful extractions
      result.confidence = totalFields > 0 ? successfulExtractions / totalFields : 0
      result.success = result.errors.length === 0 && result.confidence > 0.5

    } catch (error) {
      result.errors.push(`Template processing failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    result.processingTime = Date.now() - startTime
    return result
  }

  private async extractField(
    rule: ExtractionRule,
    text: string,
    extractedData: any
  ): Promise<any> {
    switch (rule.extractionType) {
      case 'regex':
        return this.extractWithRegex(rule, text)

      case 'keyword':
        return this.extractWithKeyword(rule, text)

      case 'table':
        return this.extractFromTable(rule, extractedData.tables || [])

      case 'position':
        return this.extractFromPosition(rule, text)

      case 'calculation':
        return this.calculateValue(rule, extractedData)

      default:
        throw new Error(`Unknown extraction type: ${rule.extractionType}`)
    }
  }

  private extractWithRegex(rule: ExtractionRule, text: string): string | null {
    if (!rule.pattern) return null

    try {
      const regex = new RegExp(rule.pattern, 'gi')
      const match = text.match(regex)
      return match ? match[0] : null
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${rule.pattern}`)
    }
  }

  private extractWithKeyword(rule: ExtractionRule, text: string): string | null {
    if (!rule.keywordConfig) return null

    const lines = text.split('\n')
    const { keywords, searchRadius, direction } = rule.keywordConfig

    for (const keyword of keywords) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const keywordIndex = line.toLowerCase().indexOf(keyword.toLowerCase())

        if (keywordIndex !== -1) {
          switch (direction) {
            case 'same_line':
              const afterKeyword = line.substring(keywordIndex + keyword.length).trim()
              const match = afterKeyword.match(/^[:\s]*(.+)$/)
              return match ? match[1].trim() : null

            case 'after':
              for (let j = i + 1; j <= Math.min(i + searchRadius, lines.length - 1); j++) {
                const nextLine = lines[j].trim()
                if (nextLine) return nextLine
              }
              break

            case 'before':
              for (let j = i - 1; j >= Math.max(i - searchRadius, 0); j--) {
                const prevLine = lines[j].trim()
                if (prevLine) return prevLine
              }
              break
          }
        }
      }
    }

    return null
  }

  private extractFromTable(rule: ExtractionRule, tables: any[]): string | null {
    if (!rule.tableConfig || tables.length === 0) return null

    const { tableIndex, columnIndex, rowIndex, headerName } = rule.tableConfig

    if (tableIndex >= tables.length) return null

    const table = tables[tableIndex]

    if (headerName) {
      // Find column by header name
      const headerRow = table.headers || table.rows[0]
      const colIndex = headerRow.findIndex((header: string) =>
        header.toLowerCase().includes(headerName.toLowerCase())
      )

      if (colIndex !== -1 && table.rows.length > 1) {
        return table.rows[1][colIndex] || null // First data row
      }
    } else if (columnIndex !== undefined) {
      // Use specific column and row indices
      const targetRow = rowIndex !== undefined ? rowIndex : 1 // Default to first data row
      if (table.rows.length > targetRow && table.rows[targetRow].length > columnIndex) {
        return table.rows[targetRow][columnIndex] || null
      }
    }

    return null
  }

  private extractFromPosition(rule: ExtractionRule, text: string): string | null {
    if (!rule.position) return null

    // This is a simplified position-based extraction
    // In a real implementation, you'd use PDF coordinate information
    const lines = text.split('\n')

    if (rule.position.page) {
      // For now, assume single page or use line numbers as approximation
      const startLine = Math.max(0, (rule.position.y || 0) - 2)
      const endLine = Math.min(lines.length, startLine + (rule.position.height || 1))

      return lines.slice(startLine, endLine).join(' ').trim()
    }

    return null
  }

  private calculateValue(rule: ExtractionRule, extractedData: Record<string, any>): number | null {
    if (!rule.calculationConfig) return null

    const { operation, sourceFields, formula } = rule.calculationConfig

    if (formula) {
      // Simple formula evaluation (in production, use a proper expression parser)
      try {
        let expression = formula
        for (const [field, value] of Object.entries(extractedData)) {
          expression = expression.replace(new RegExp(`\\{${field}\\}`, 'g'), String(value || 0))
        }
        return eval(expression) // WARNING: eval is dangerous in production - use a safe expression parser
      } catch (error) {
        throw new Error(`Formula evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    // Simple operations
    const values = sourceFields
      .map(field => parseFloat(extractedData[field] || 0))
      .filter(val => !isNaN(val))

    if (values.length === 0) return null

    switch (operation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0)
      case 'multiply':
        return values.reduce((product, val) => product * val, 1)
      case 'subtract':
        return values.reduce((diff, val, index) => index === 0 ? val : diff - val)
      case 'divide':
        return values.reduce((quotient, val, index) => index === 0 ? val : quotient / val)
      default:
        return null
    }
  }

  private applyHardcodedMappings(
    mappings: HardcodedMapping[],
    fieldName: string,
    value: any
  ): any {
    const fieldMappings = mappings.filter(m => m.fieldName === fieldName)

    for (const mapping of fieldMappings) {
      const sourcePattern = mapping.sourcePattern.toLowerCase()
      const valueStr = String(value).toLowerCase()

      // Check if the pattern matches
      if (valueStr.includes(sourcePattern) ||
          (sourcePattern.includes('*') && this.matchWildcard(valueStr, sourcePattern))) {
        return mapping.targetValue
      }
    }

    return value
  }

  private matchWildcard(text: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')

    try {
      const regex = new RegExp(`^${regexPattern}$`, 'i')
      return regex.test(text)
    } catch (error) {
      return false
    }
  }

  private validateField(rule: ExtractionRule, value: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!rule.validation) {
      return { isValid: true, errors: [] }
    }

    const { dataType, required, minLength, maxLength, pattern } = rule.validation

    // Required check
    if (required && (value === null || value === undefined || value === '')) {
      errors.push('Field is required but no value was extracted')
      return { isValid: false, errors }
    }

    if (value === null || value === undefined || value === '') {
      return { isValid: true, errors: [] } // Optional field, no value is OK
    }

    // Data type validation
    switch (dataType) {
      case 'number':
        if (isNaN(parseFloat(value))) {
          errors.push('Value must be a number')
        }
        break

      case 'date':
        if (isNaN(Date.parse(value))) {
          errors.push('Value must be a valid date')
        }
        break

      case 'currency':
        if (!/^\$?\d+\.?\d*$/.test(String(value).replace(/,/g, ''))) {
          errors.push('Value must be a valid currency amount')
        }
        break

      case 'percentage':
        const numVal = parseFloat(String(value).replace('%', ''))
        if (isNaN(numVal) || numVal < 0 || numVal > 100) {
          errors.push('Value must be a valid percentage')
        }
        break
    }

    // Length validation
    const strValue = String(value)
    if (minLength && strValue.length < minLength) {
      errors.push(`Value must be at least ${minLength} characters long`)
    }
    if (maxLength && strValue.length > maxLength) {
      errors.push(`Value must not exceed ${maxLength} characters`)
    }

    // Pattern validation
    if (pattern) {
      try {
        const regex = new RegExp(pattern)
        if (!regex.test(strValue)) {
          errors.push('Value does not match required pattern')
        }
      } catch (error) {
        errors.push('Invalid validation pattern')
      }
    }

    return { isValid: errors.length === 0, errors }
  }

  async getTemplate(templateId: string): Promise<TemplateWithMappings | null> {
    return this.templates.get(templateId) || null
  }

  getTemplateStats(): { totalTemplates: number; customerTemplates: Record<string, number> } {
    const customerTemplates: Record<string, number> = {}

    this.templates.forEach(template => {
      customerTemplates[template.customerId] = (customerTemplates[template.customerId] || 0) + 1
    })

    return {
      totalTemplates: this.templates.size,
      customerTemplates
    }
  }
}