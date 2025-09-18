import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Create a rate limiter that allows 10 requests per 10 seconds for login attempts
export const loginRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "60 s"), // 5 attempts per minute
  analytics: true,
})

// Create a rate limiter for general API requests
export const apiRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "60 s"), // 100 requests per minute
  analytics: true,
})

// Create a stricter rate limiter for sensitive operations
export const sensitiveRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 requests per minute
  analytics: true,
})

// Fallback in-memory rate limiter when Redis is not available
class MemoryRateLimit {
  private requests: Map<string, number[]> = new Map()
  private limit: number
  private window: number

  constructor(limit: number, windowSeconds: number) {
    this.limit = limit
    this.window = windowSeconds * 1000 // Convert to milliseconds
  }

  async limit(identifier: string): Promise<{ success: boolean; remaining: number }> {
    const now = Date.now()
    const userRequests = this.requests.get(identifier) || []

    // Filter out old requests outside the window
    const validRequests = userRequests.filter(time => now - time < this.window)

    if (validRequests.length >= this.limit) {
      return { success: false, remaining: 0 }
    }

    // Add current request
    validRequests.push(now)
    this.requests.set(identifier, validRequests)

    return { success: true, remaining: this.limit - validRequests.length }
  }
}

// Fallback rate limiters
export const fallbackLoginRateLimit = new MemoryRateLimit(5, 60)
export const fallbackApiRateLimit = new MemoryRateLimit(100, 60)
export const fallbackSensitiveRateLimit = new MemoryRateLimit(10, 60)

export async function checkRateLimit(
  identifier: string,
  type: 'login' | 'api' | 'sensitive' = 'api'
): Promise<{ success: boolean; remaining: number; reset?: Date }> {
  try {
    let rateLimit
    let fallback

    switch (type) {
      case 'login':
        rateLimit = loginRateLimit
        fallback = fallbackLoginRateLimit
        break
      case 'sensitive':
        rateLimit = sensitiveRateLimit
        fallback = fallbackSensitiveRateLimit
        break
      default:
        rateLimit = apiRateLimit
        fallback = fallbackApiRateLimit
    }

    // Try Redis-based rate limiting first
    try {
      const result = await rateLimit.limit(identifier)
      return {
        success: result.success,
        remaining: result.remaining,
        reset: result.reset
      }
    } catch (error) {
      console.warn('Redis rate limiting failed, falling back to memory:', error)
      // Fall back to in-memory rate limiting
      return await fallback.limit(identifier)
    }
  } catch (error) {
    console.error('Rate limiting error:', error)
    // If all rate limiting fails, allow the request but log the error
    return { success: true, remaining: 0 }
  }
}

export function getClientIP(request: Request): string {
  // Try to get the real IP from headers (when behind proxy)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const connectingIP = request.headers.get('cf-connecting-ip') // Cloudflare

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (connectingIP) {
    return connectingIP
  }

  // Fallback to a default IP if we can't determine it
  return '127.0.0.1'
}