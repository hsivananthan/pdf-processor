import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH || "12")
  const maxLength = parseInt(process.env.PASSWORD_MAX_LENGTH || "128")

  // Length validation
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`)
  }

  if (password.length > maxLength) {
    errors.push(`Password must not exceed ${maxLength} characters`)
  }

  // Character complexity requirements
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number")
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character")
  }

  // Common password patterns check
  const commonPatterns = [
    /(.)\1{3,}/, // More than 3 repeated characters
    /123456|654321|qwerty|password|admin|letmein/i, // Common passwords
    /^[0-9]+$/, // Only numbers
    /^[a-zA-Z]+$/, // Only letters
  ]

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push("Password contains common patterns and is not secure")
      break
    }
  }

  // Sequential character check
  const hasSequential = /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)
  if (hasSequential) {
    errors.push("Password should not contain sequential characters")
  }

  return {
    isValid: errors.length === 0
    errors
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    [UserRole.READONLY]: 0
    [UserRole.USER]: 1
    [UserRole.MANAGER]: 2
    [UserRole.ADMIN]: 3
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

export function canAccessResource(userRole: UserRole, resource: string, action: string): boolean {
  const permissions = {
    [UserRole.ADMIN]: ['*']
    [UserRole.MANAGER]: [
      'templates.*'
      'users.view'
      'users.edit'
      'documents.*'
      'reports.*'
      'customers.*'
    ]
    [UserRole.USER]: [
      'documents.upload'
      'documents.download'
      'documents.view'
      'profile.*'
      'templates.view'
    ]
    [UserRole.READONLY]: [
      'documents.view'
      'reports.view'
      'profile.view'
    ]
  }

  const userPermissions = permissions[userRole] || []

  // Check for wildcard permission
  if (userPermissions.includes('*')) {
    return true
  }

  // Check for exact permission
  const permission = `${resource}.${action}`
  if (userPermissions.includes(permission)) {
    return true
  }

  // Check for resource wildcard
  const resourceWildcard = `${resource}.*`
  if (userPermissions.includes(resourceWildcard)) {
    return true
  }

  return false
}