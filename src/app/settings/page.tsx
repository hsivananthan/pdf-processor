"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Database, CheckCircle, XCircle, AlertCircle, RefreshCw, Shield, Server } from "lucide-react"
import { UserRole } from "@prisma/client"

interface DatabaseConfig {
  configured: boolean
  config: {
    provider: string
    host: string
    port?: number
    database: string
    username: string
    ssl: boolean
    pooling: boolean
  }
  environment: string
  source: string
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [dbConfig, setDbConfig] = useState<DatabaseConfig | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)

  useEffect(() => {
    if (status === "loading") return

    if (!session?.user || session.user.role !== UserRole.ADMIN) {
      router.push('/dashboard')
      return
    }

    fetchDatabaseConfig()
  }, [session, status, router])

  const fetchDatabaseConfig = async () => {
    try {
      const response = await fetch('/api/settings/database')
      if (!response.ok) throw new Error('Failed to fetch database config')

      const data = await response.json()
      setDbConfig(data)
    } catch (error) {
      console.error('Error fetching database config:', error)
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setConnectionStatus(null)

    try {
      const response = await fetch('/api/settings/database', {
        method: 'POST'
      })

      const result = await response.json()
      setConnectionStatus(result)
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: 'Failed to test database connection'
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return null
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure and manage your PDF processor system settings
        </p>
      </div>

      <Tabs defaultValue="database" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="database">
            <Database className="mr-2 h-4 w-4" />
            Database
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="system">
            <Server className="mr-2 h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Configuration</CardTitle>
              <CardDescription>
                View and test your database connection settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connection Status */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Connection Status</h3>
                  <Badge variant={dbConfig?.configured ? "success" : "destructive"}>
                    {dbConfig?.configured ? "Configured" : "Not Configured"}
                  </Badge>
                </div>

                {dbConfig?.configured && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Provider</p>
                      <p className="text-sm mt-1">{dbConfig.config.provider}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Database</p>
                      <p className="text-sm mt-1">{dbConfig.config.database}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Host</p>
                      <p className="text-sm mt-1">{dbConfig.config.host}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Port</p>
                      <p className="text-sm mt-1">{dbConfig.config.port || 'Default'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">SSL</p>
                      <p className="text-sm mt-1">
                        <Badge variant={dbConfig.config.ssl ? "success" : "secondary"}>
                          {dbConfig.config.ssl ? "Enabled" : "Disabled"}
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Connection Pooling</p>
                      <p className="text-sm mt-1">
                        <Badge variant={dbConfig.config.pooling ? "success" : "secondary"}>
                          {dbConfig.config.pooling ? "Enabled" : "Disabled"}
                        </Badge>
                      </p>
                    </div>
                  </div>
                )}

                {/* Test Connection Button */}
                <div className="flex items-center gap-4">
                  <Button
                    onClick={testConnection}
                    disabled={testing || !dbConfig?.configured}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={fetchDatabaseConfig}
                  >
                    Refresh Status
                  </Button>
                </div>

                {/* Connection Test Result */}
                {connectionStatus && (
                  <Alert variant={connectionStatus.success ? "success" : "destructive"}>
                    {connectionStatus.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      <p className="font-medium">{connectionStatus.message}</p>
                      {connectionStatus.details && (
                        <div className="mt-2 text-sm">
                          <p>Provider: {connectionStatus.details.provider}</p>
                          <p>Host: {connectionStatus.details.host}</p>
                          <p>Database: {connectionStatus.details.database}</p>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Environment Info */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Environment Information</h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Environment</p>
                    <p className="text-sm mt-1">
                      <Badge>{dbConfig?.environment || 'Unknown'}</Badge>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Configuration Source</p>
                    <p className="text-sm mt-1">
                      <Badge variant="outline">{dbConfig?.source || 'Unknown'}</Badge>
                    </p>
                  </div>
                </div>
              </div>

              {/* Important Notice */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Important Security Notice</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Database credentials are managed through environment variables</li>
                    <li>Never expose connection strings in client-side code</li>
                    <li>Connection strings should be set in your hosting provider&apos;s environment settings</li>
                    <li>For Vercel: Settings → Environment Variables → DATABASE_URL</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure security policies and authentication settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Password Min Length</p>
                    <p className="text-sm mt-1">{process.env.NEXT_PUBLIC_PASSWORD_MIN_LENGTH || '12'} characters</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Session Timeout</p>
                    <p className="text-sm mt-1">{process.env.NEXT_PUBLIC_SESSION_MAX_AGE || '28800'} seconds</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Failed Login Attempts</p>
                    <p className="text-sm mt-1">{process.env.NEXT_PUBLIC_FAILED_LOGIN_ATTEMPTS || '3'} attempts</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Account Lockout Time</p>
                    <p className="text-sm mt-1">{process.env.NEXT_PUBLIC_ACCOUNT_LOCKOUT_TIME || '1800000'} ms</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                View system configuration and processing settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Max File Size</p>
                    <p className="text-sm mt-1">{process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '50000000'} bytes</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Processing Timeout</p>
                    <p className="text-sm mt-1">{process.env.NEXT_PUBLIC_PROCESSING_TIMEOUT || '600000'} ms</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Concurrent Jobs</p>
                    <p className="text-sm mt-1">{process.env.NEXT_PUBLIC_CONCURRENT_JOBS || '3'} jobs</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Upload Directory</p>
                    <p className="text-sm mt-1">{process.env.NEXT_PUBLIC_UPLOAD_DIR || './uploads'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}