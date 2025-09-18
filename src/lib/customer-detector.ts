import { prisma } from '@/lib/prisma'
import { Customer } from '@prisma/client'

export interface CustomerDetectionResult {
  customerId: string | null
  customerName: string | null
  confidence: number
  matchedPatterns: string[]
  detectionMethod: 'exact_match' | 'fuzzy_match' | 'pattern_match' | 'ml_classification'
}

export interface DetectionPattern {
  type: 'text' | 'regex' | 'position' | 'header' | 'footer'
  pattern: string
  weight: number
  caseSensitive?: boolean
}

export class CustomerDetector {
  private customers: Customer[] = []
  private patterns: Map<string, DetectionPattern[]> = new Map()

  async initialize(): Promise<void> {
    try {
      // Load all active customers and their identification patterns
      this.customers = await prisma.customer.findMany({
        where: { isActive: true }
      })

      // Parse and store identification patterns for each customer
      this.customers.forEach(customer => {
        try {
          const patterns = this.parseIdentifierPatterns(customer.identifierPatterns as any)
          this.patterns.set(customer.id, patterns)
        } catch (error) {
          console.error(`Failed to parse patterns for customer ${customer.name}:`, error)
        }
      })

      console.log(`Initialized customer detector with ${this.customers.length} customers`)
    } catch (error) {
      console.error('Failed to initialize customer detector:', error)
      throw new Error('Customer detector initialization failed')
    }
  }

  async detectCustomer(extractedText: string, fileName?: string): Promise<CustomerDetectionResult> {
    const results: CustomerDetectionResult[] = []

    // Try different detection methods
    for (const customer of this.customers) {
      const patterns = this.patterns.get(customer.id) || []

      // 1. Exact text matching
      const exactMatch = this.checkExactMatch(extractedText, customer, patterns)
      if (exactMatch.confidence > 0) {
        results.push(exactMatch)
      }

      // 2. Pattern matching (regex, headers, etc.)
      const patternMatch = this.checkPatternMatch(extractedText, customer, patterns)
      if (patternMatch.confidence > 0) {
        results.push(patternMatch)
      }

      // 3. Fuzzy matching for company names
      const fuzzyMatch = this.checkFuzzyMatch(extractedText, customer)
      if (fuzzyMatch.confidence > 0) {
        results.push(fuzzyMatch)
      }

      // 4. Filename-based detection
      if (fileName) {
        const filenameMatch = this.checkFilenameMatch(fileName, customer, patterns)
        if (filenameMatch.confidence > 0) {
          results.push(filenameMatch)
        }
      }
    }

    // Return the best match or null if no confident match found
    if (results.length === 0) {
      return {
        customerId: null,
        customerName: null,
        confidence: 0,
        matchedPatterns: [],
        detectionMethod: 'exact_match'
      }
    }

    // Sort by confidence and return the best match
    results.sort((a, b) => b.confidence - a.confidence)
    return results[0]
  }

  private parseIdentifierPatterns(patternsData: any): DetectionPattern[] {
    const patterns: DetectionPattern[] = []

    try {
      // Handle different pattern formats
      if (Array.isArray(patternsData)) {
        patternsData.forEach(pattern => {
          if (typeof pattern === 'string') {
            patterns.push({
              type: 'text',
              pattern: pattern,
              weight: 1.0
            })
          } else if (typeof pattern === 'object') {
            patterns.push({
              type: pattern.type || 'text',
              pattern: pattern.pattern || pattern.value,
              weight: pattern.weight || 1.0,
              caseSensitive: pattern.caseSensitive || false
            })
          }
        })
      } else if (typeof patternsData === 'object') {
        // Handle object format like { companyName: "ACME Corp", accountNumber: "AC-*" }
        Object.entries(patternsData).forEach(([key, value]) => {
          if (typeof value === 'string') {
            patterns.push({
              type: key.includes('regex') ? 'regex' : 'text',
              pattern: value,
              weight: key.includes('name') ? 2.0 : 1.0
            })
          }
        })
      }
    } catch (error) {
      console.error('Error parsing identifier patterns:', error)
    }

    return patterns
  }

  private checkExactMatch(text: string, customer: Customer, patterns: DetectionPattern[]): CustomerDetectionResult {
    const matchedPatterns: string[] = []
    let totalWeight = 0
    let matchedWeight = 0

    for (const pattern of patterns.filter(p => p.type === 'text')) {
      totalWeight += pattern.weight

      const searchText = pattern.caseSensitive ? text : text.toLowerCase()
      const searchPattern = pattern.caseSensitive ? pattern.pattern : pattern.pattern.toLowerCase()

      if (searchText.includes(searchPattern)) {
        matchedPatterns.push(pattern.pattern)
        matchedWeight += pattern.weight
      }
    }

    const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0

    return {
      customerId: confidence > 0.5 ? customer.id : null,
      customerName: confidence > 0.5 ? customer.name : null,
      confidence,
      matchedPatterns,
      detectionMethod: 'exact_match'
    }
  }

  private checkPatternMatch(text: string, customer: Customer, patterns: DetectionPattern[]): CustomerDetectionResult {
    const matchedPatterns: string[] = []
    let totalWeight = 0
    let matchedWeight = 0

    for (const pattern of patterns.filter(p => p.type === 'regex')) {
      totalWeight += pattern.weight

      try {
        const regex = new RegExp(pattern.pattern, pattern.caseSensitive ? 'g' : 'gi')
        const matches = text.match(regex)

        if (matches && matches.length > 0) {
          matchedPatterns.push(pattern.pattern)
          matchedWeight += pattern.weight
        }
      } catch (error) {
        console.error(`Invalid regex pattern: ${pattern.pattern}`, error)
      }
    }

    // Check header/footer patterns
    const lines = text.split('\n')
    const headerLines = lines.slice(0, Math.min(5, lines.length))
    const footerLines = lines.slice(-Math.min(5, lines.length))

    for (const pattern of patterns.filter(p => p.type === 'header' || p.type === 'footer')) {
      totalWeight += pattern.weight
      const searchLines = pattern.type === 'header' ? headerLines : footerLines
      const searchText = searchLines.join(' ')

      const text_to_search = pattern.caseSensitive ? searchText : searchText.toLowerCase()
      const pattern_to_find = pattern.caseSensitive ? pattern.pattern : pattern.pattern.toLowerCase()

      if (text_to_search.includes(pattern_to_find)) {
        matchedPatterns.push(pattern.pattern)
        matchedWeight += pattern.weight
      }
    }

    const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0

    return {
      customerId: confidence > 0.6 ? customer.id : null,
      customerName: confidence > 0.6 ? customer.name : null,
      confidence,
      matchedPatterns,
      detectionMethod: 'pattern_match'
    }
  }

  private checkFuzzyMatch(text: string, customer: Customer): CustomerDetectionResult {
    const customerName = customer.name.toLowerCase()
    const words = customerName.split(/\s+/)

    let matchedWords = 0
    const matchedPatterns: string[] = []

    for (const word of words) {
      if (word.length > 2) { // Only check meaningful words
        if (text.toLowerCase().includes(word)) {
          matchedWords++
          matchedPatterns.push(word)
        }
      }
    }

    const confidence = words.length > 0 ? (matchedWords / words.length) * 0.8 : 0 // Max 0.8 for fuzzy

    return {
      customerId: confidence > 0.5 ? customer.id : null,
      customerName: confidence > 0.5 ? customer.name : null,
      confidence,
      matchedPatterns,
      detectionMethod: 'fuzzy_match'
    }
  }

  private checkFilenameMatch(fileName: string, customer: Customer, patterns: DetectionPattern[]): CustomerDetectionResult {
    const matchedPatterns: string[] = []
    let confidence = 0

    // Check if filename contains customer-specific patterns
    const fileNameLower = fileName.toLowerCase()
    const customerNameWords = customer.name.toLowerCase().split(/\s+/)

    for (const word of customerNameWords) {
      if (word.length > 2 && fileNameLower.includes(word)) {
        matchedPatterns.push(word)
        confidence += 0.3
      }
    }

    // Check filename against patterns
    for (const pattern of patterns) {
      const patternLower = pattern.pattern.toLowerCase()
      if (fileNameLower.includes(patternLower)) {
        matchedPatterns.push(pattern.pattern)
        confidence += 0.4
      }
    }

    confidence = Math.min(confidence, 0.9) // Cap at 0.9 for filename-based detection

    return {
      customerId: confidence > 0.5 ? customer.id : null,
      customerName: confidence > 0.5 ? customer.name : null,
      confidence,
      matchedPatterns,
      detectionMethod: 'fuzzy_match'
    }
  }

  async addCustomerPattern(customerId: string, pattern: DetectionPattern): Promise<void> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId }
      })

      if (!customer) {
        throw new Error('Customer not found')
      }

      const currentPatterns = this.parseIdentifierPatterns(customer.identifierPatterns as any)
      currentPatterns.push(pattern)

      await prisma.customer.update({
        where: { id: customerId },
        data: {
          identifierPatterns: currentPatterns as any
        }
      })

      // Update in-memory patterns
      this.patterns.set(customerId, currentPatterns)

    } catch (error) {
      console.error('Failed to add customer pattern:', error)
      throw error
    }
  }

  async learnFromCorrection(documentText: string, correctCustomerId: string, fileName?: string): Promise<void> {
    try {
      // Extract potential new patterns from the document that correctly identifies this customer
      const newPatterns = this.extractPotentialPatterns(documentText, fileName)

      // Add the most distinctive patterns to the customer
      for (const pattern of newPatterns.slice(0, 3)) { // Limit to top 3 patterns
        await this.addCustomerPattern(correctCustomerId, pattern)
      }

      console.log(`Learned ${newPatterns.length} new patterns for customer ${correctCustomerId}`)
    } catch (error) {
      console.error('Failed to learn from correction:', error)
    }
  }

  private extractPotentialPatterns(text: string, fileName?: string): DetectionPattern[] {
    const patterns: DetectionPattern[] = []

    // Extract potential company names from headers
    const lines = text.split('\n')
    const headerLines = lines.slice(0, 5)

    for (const line of headerLines) {
      const trimmed = line.trim()
      if (trimmed.length > 5 && trimmed.length < 50) {
        // Look for lines that might be company names
        if (/^[A-Z][A-Za-z\s&,.]+$/.test(trimmed)) {
          patterns.push({
            type: 'header',
            pattern: trimmed,
            weight: 1.5
          })
        }
      }
    }

    // Extract account numbers or IDs
    const accountPatterns = [
      /Account[:\s]+([A-Z0-9\-]{3,15})/gi,
      /ID[:\s]+([A-Z0-9\-]{3,15})/gi,
      /Reference[:\s]+([A-Z0-9\-]{3,15})/gi
    ]

    for (const pattern of accountPatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        patterns.push({
          type: 'regex',
          pattern: match[1],
          weight: 2.0
        })
      }
    }

    return patterns
  }

  getDetectionStats(): { totalCustomers: number, totalPatterns: number } {
    let totalPatterns = 0
    this.patterns.forEach(patterns => {
      totalPatterns += patterns.length
    })

    return {
      totalCustomers: this.customers.length,
      totalPatterns
    }
  }
}