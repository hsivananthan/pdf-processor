import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Setting up PDF Processor database...')

  try {
    // Create admin user
    console.log('👤 Creating admin user...')
    const adminPassword = await bcrypt.hash('Admin123!@#', 12)

    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@pdfprocessor.com' },
      update: {},
      create: {
        email: 'admin@pdfprocessor.com',
        passwordHash: adminPassword,
        name: 'System Administrator',
        role: UserRole.ADMIN,
        isActive: true
      }
    })

    console.log(`✅ Admin user created: ${adminUser.email}`)

    // Create sample manager user
    console.log('👤 Creating manager user...')
    const managerPassword = await bcrypt.hash('Manager123!@#', 12)

    const managerUser = await prisma.user.upsert({
      where: { email: 'manager@pdfprocessor.com' },
      update: {},
      create: {
        email: 'manager@pdfprocessor.com',
        passwordHash: managerPassword,
        name: 'Template Manager',
        role: UserRole.MANAGER,
        isActive: true
      }
    })

    console.log(`✅ Manager user created: ${managerUser.email}`)

    // Create sample regular user
    console.log('👤 Creating regular user...')
    const userPassword = await bcrypt.hash('User123!@#', 12)

    const regularUser = await prisma.user.upsert({
      where: { email: 'user@pdfprocessor.com' },
      update: {},
      create: {
        email: 'user@pdfprocessor.com',
        passwordHash: userPassword,
        name: 'Document Processor',
        role: UserRole.USER,
        isActive: true
      }
    })

    console.log(`✅ Regular user created: ${regularUser.email}`)

    // Create sample customers
    console.log('🏢 Creating sample customers...')

    const acmeCustomer = await prisma.customer.upsert({
      where: { id: 'sample-acme-customer' },
      update: {},
      create: {
        id: 'sample-acme-customer',
        name: 'ACME Corporation',
        identifierPatterns: [
          {
            type: 'text',
            pattern: 'ACME Corporation',
            weight: 2.0,
            caseSensitive: false
          },
          {
            type: 'text',
            pattern: 'ACME Corp',
            weight: 1.5,
            caseSensitive: false
          },
          {
            type: 'regex',
            pattern: 'Account[:\\s]+AC-\\d+',
            weight: 1.8,
            caseSensitive: false
          },
          {
            type: 'header',
            pattern: 'ACME',
            weight: 1.0,
            caseSensitive: false
          }
        ],
        contactInfo: {
          email: 'billing@acme.com',
          phone: '+1-555-123-4567',
          address: '123 Business St, Corporate City, CC 12345'
        },
        isActive: true
      }
    })

    const globalTechCustomer = await prisma.customer.upsert({
      where: { id: 'sample-globaltech-customer' },
      update: {},
      create: {
        id: 'sample-globaltech-customer',
        name: 'GlobalTech Industries',
        identifierPatterns: [
          {
            type: 'text',
            pattern: 'GlobalTech Industries',
            weight: 2.0,
            caseSensitive: false
          },
          {
            type: 'text',
            pattern: 'GTI',
            weight: 1.2,
            caseSensitive: false
          },
          {
            type: 'regex',
            pattern: 'Invoice[:\\s]+GTI-\\d+',
            weight: 1.8,
            caseSensitive: false
          }
        ],
        contactInfo: {
          email: 'accounts@globaltech.com',
          phone: '+1-555-987-6543',
          address: '456 Innovation Ave, Tech Valley, TV 67890'
        },
        isActive: true
      }
    })

    console.log(`✅ Sample customers created: ${acmeCustomer.name}, ${globalTechCustomer.name}`)

    // Create sample templates
    console.log('📋 Creating sample templates...')

    const invoiceTemplate = await prisma.documentTemplate.create({
      data: {
        customerId: acmeCustomer.id,
        name: 'ACME Invoice Template',
        description: 'Standard invoice processing template for ACME Corporation',
        createdById: managerUser.id,
        extractionRules: [
          {
            fieldName: 'invoice_number',
            extractionType: 'keyword',
            keywordConfig: {
              keywords: ['Invoice #', 'Invoice Number:', 'INV-'],
              searchRadius: 2,
              direction: 'same_line'
            },
            validation: {
              dataType: 'string',
              required: true,
              pattern: '^[A-Z0-9-]+$'
            }
          },
          {
            fieldName: 'invoice_date',
            extractionType: 'keyword',
            keywordConfig: {
              keywords: ['Date:', 'Invoice Date:', 'Issued:'],
              searchRadius: 2,
              direction: 'same_line'
            },
            validation: {
              dataType: 'date',
              required: true
            }
          },
          {
            fieldName: 'total_amount',
            extractionType: 'keyword',
            keywordConfig: {
              keywords: ['Total:', 'Amount Due:', 'Balance:'],
              searchRadius: 3,
              direction: 'after'
            },
            validation: {
              dataType: 'currency',
              required: true
            }
          },
          {
            fieldName: 'customer_name',
            extractionType: 'keyword',
            keywordConfig: {
              keywords: ['Bill To:', 'Customer:', 'Client:'],
              searchRadius: 3,
              direction: 'after'
            },
            validation: {
              dataType: 'string',
              required: false,
              maxLength: 100
            }
          }
        ],
        fieldMappings: {
          document_type: 'invoice',
          processed_by: 'acme_template_v1',
          currency: 'USD'
        },
        version: 1,
        isActive: true
      }
    })

    // Create hardcoded mappings for the invoice template
    await prisma.hardcodedMapping.createMany({
      data: [
        {
          templateId: invoiceTemplate.id,
          sourcePattern: 'freight',
          targetValue: 'SHIPPING_COST',
          fieldName: 'expense_type',
          priority: 2
        },
        {
          templateId: invoiceTemplate.id,
          sourcePattern: 'shipping',
          targetValue: 'SHIPPING_COST',
          fieldName: 'expense_type',
          priority: 2
        },
        {
          templateId: invoiceTemplate.id,
          sourcePattern: 'delivery',
          targetValue: 'SHIPPING_COST',
          fieldName: 'expense_type',
          priority: 1
        },
        {
          templateId: invoiceTemplate.id,
          sourcePattern: 'tax',
          targetValue: 'TAX_AMOUNT',
          fieldName: 'expense_type',
          priority: 3
        },
        {
          templateId: invoiceTemplate.id,
          sourcePattern: 'service',
          targetValue: 'SERVICE_FEE',
          fieldName: 'expense_type',
          priority: 1
        },
        {
          templateId: invoiceTemplate.id,
          sourcePattern: 'consultation',
          targetValue: 'CONSULTING_FEE',
          fieldName: 'expense_type',
          priority: 1
        }
      ]
    })

    // Create extraction fields
    await prisma.extractionField.createMany({
      data: [
        {
          templateId: invoiceTemplate.id,
          fieldName: 'invoice_number',
          dataType: 'string',
          isRequired: true,
          validationRules: { pattern: '^[A-Z0-9-]+$' }
        },
        {
          templateId: invoiceTemplate.id,
          fieldName: 'invoice_date',
          dataType: 'date',
          isRequired: true,
          validationRules: {}
        },
        {
          templateId: invoiceTemplate.id,
          fieldName: 'total_amount',
          dataType: 'currency',
          isRequired: true,
          validationRules: {}
        },
        {
          templateId: invoiceTemplate.id,
          fieldName: 'customer_name',
          dataType: 'string',
          isRequired: false,
          validationRules: { maxLength: 100 }
        }
      ]
    })

    console.log(`✅ Sample template created: ${invoiceTemplate.name}`)

    // Create another template for GlobalTech
    const purchaseOrderTemplate = await prisma.documentTemplate.create({
      data: {
        customerId: globalTechCustomer.id,
        name: 'GlobalTech Purchase Order Template',
        description: 'Purchase order processing template for GlobalTech Industries',
        createdById: managerUser.id,
        extractionRules: [
          {
            fieldName: 'po_number',
            extractionType: 'keyword',
            keywordConfig: {
              keywords: ['PO #', 'Purchase Order:', 'PO Number:'],
              searchRadius: 2,
              direction: 'same_line'
            },
            validation: {
              dataType: 'string',
              required: true
            }
          },
          {
            fieldName: 'vendor_name',
            extractionType: 'keyword',
            keywordConfig: {
              keywords: ['Vendor:', 'Supplier:', 'From:'],
              searchRadius: 2,
              direction: 'after'
            },
            validation: {
              dataType: 'string',
              required: true
            }
          },
          {
            fieldName: 'order_total',
            extractionType: 'keyword',
            keywordConfig: {
              keywords: ['Total:', 'Grand Total:', 'Amount:'],
              searchRadius: 3,
              direction: 'same_line'
            },
            validation: {
              dataType: 'currency',
              required: true
            }
          }
        ],
        fieldMappings: {
          document_type: 'purchase_order',
          processed_by: 'globaltech_po_template_v1'
        },
        version: 1,
        isActive: true
      }
    })

    console.log(`✅ Sample template created: ${purchaseOrderTemplate.name}`)

    // Log initial setup
    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'INITIAL_SETUP',
        resource: 'SYSTEM',
        details: {
          usersCreated: 3,
          customersCreated: 2,
          templatesCreated: 2,
          setupTimestamp: new Date()
        }
      }
    })

    console.log('📊 Creating sample processing statistics...')

    // You could add sample documents and processing jobs here if needed
    // For now, we'll just set up the foundational data

    console.log('✅ Database setup completed successfully!')
    console.log('')
    console.log('📝 Sample Login Credentials:')
    console.log('  Admin:   admin@pdfprocessor.com / Admin123!@#')
    console.log('  Manager: manager@pdfprocessor.com / Manager123!@#')
    console.log('  User:    user@pdfprocessor.com / User123!@#')
    console.log('')
    console.log('🏢 Sample Customers Created:')
    console.log('  - ACME Corporation (with Invoice Template)')
    console.log('  - GlobalTech Industries (with Purchase Order Template)')
    console.log('')
    console.log('🔧 Hardcoded Mappings Examples:')
    console.log('  - "freight" → "SHIPPING_COST"')
    console.log('  - "tax" → "TAX_AMOUNT"')
    console.log('  - "service" → "SERVICE_FEE"')
    console.log('')
    console.log('🚀 Ready to start processing PDFs!')

  } catch (error) {
    console.error('❌ Setup failed:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })