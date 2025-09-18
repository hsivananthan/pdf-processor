#!/usr/bin/env node

/**
 * Script to create the first admin user for the PDF processor application
 * Run this after deploying to create your initial admin account
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    console.log('🚀 Creating admin user...')

    // Admin user details
    const adminEmail = 'admin@example.com'
    const adminPassword = 'AdminPassword123!'
    const adminName = 'System Administrator'

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (existingAdmin) {
      console.log('❗ Admin user already exists with email:', adminEmail)
      console.log('📧 Email:', adminEmail)
      console.log('🔑 Use your existing password or reset it')
      return
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(adminPassword, 12)

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: adminName,
        role: 'ADMIN',
        isActive: true
      }
    })

    console.log('✅ Admin user created successfully!')
    console.log('📧 Email:', adminEmail)
    console.log('🔑 Password:', adminPassword)
    console.log('👤 Role: ADMIN')
    console.log('')
    console.log('🔐 IMPORTANT: Change this password after first login!')
    console.log('🌐 Login at: https://your-app-url.vercel.app/auth/signin')

  } catch (error) {
    console.error('❌ Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()