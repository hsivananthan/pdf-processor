import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Public routes that don't require authentication
    const publicRoutes = ['/auth/signin', '/auth/signup', '/auth/error', '/']
    if (publicRoutes.includes(pathname)) {
      return NextResponse.next()
    }

    // Check if user is authenticated
    if (!token) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    // Admin-only routes
    const adminRoutes = ['/admin', '/users', '/audit-logs']
    if (adminRoutes.some(route => pathname.startsWith(route))) {
      if (token.role !== UserRole.ADMIN) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }

    // Manager and Admin routes
    const managerRoutes = ['/templates', '/customers', '/reports']
    if (managerRoutes.some(route => pathname.startsWith(route))) {
      if (token.role !== UserRole.ADMIN && token.role !== UserRole.MANAGER) {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }

    // Log access for audit purposes
    if (pathname.startsWith('/api/')) {
      // Add user ID to headers for API routes
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-user-id', token.id)
      requestHeaders.set('x-user-role', token.role)

      return NextResponse.next({
        request: {
          headers: requestHeaders
        }
      })
    }

    return NextResponse.next()
  }
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Allow public routes
        const publicRoutes = ['/auth/signin', '/auth/signup', '/auth/error', '/']
        if (publicRoutes.includes(pathname)) {
          return true
        }

        // Require authentication for all other routes
        return !!token
      }
    }
  }
)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)'
  ]
}