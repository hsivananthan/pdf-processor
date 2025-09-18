"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  TrendingUp,
  BarChart3,
  Download,
  Calendar,
  FileText,
  Users,
  Building2,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ProcessingReport {
  id: string
  period: string
  totalDocuments: number
  successfulProcessing: number
  failedProcessing: number
  averageProcessingTime: number
  customersProcessed: number
  csvFilesGenerated: number
  storageUsed: number
}

export default function ReportsPage() {
  const { data: session } = useSession()
  const [reports, setReports] = useState<ProcessingReport[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState("30")

  useEffect(() => {
    if (session?.user) {
      loadReports()
    }
  }, [session, timeFilter])

  const loadReports = async () => {
    try {
      setLoading(true)
      // Simulated data - in real implementation, fetch from /api/reports
      const mockData: ProcessingReport[] = [
        {
          id: "1",
          period: "Last 30 Days",
          totalDocuments: 1247,
          successfulProcessing: 1186,
          failedProcessing: 61,
          averageProcessingTime: 45.2,
          customersProcessed: 23,
          csvFilesGenerated: 1186,
          storageUsed: 8.7
        },
        {
          id: "2",
          period: "Last 7 Days",
          totalDocuments: 342,
          successfulProcessing: 328,
          failedProcessing: 14,
          averageProcessingTime: 42.1,
          customersProcessed: 18,
          csvFilesGenerated: 328,
          storageUsed: 2.1
        }
      ]
      setReports(mockData)
    } catch (error) {
      console.error('Failed to load reports:', error)
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  const calculateSuccessRate = (successful: number, total: number) => {
    return total > 0 ? ((successful / total) * 100).toFixed(1) : '0.0'
  }

  const formatProcessingTime = (seconds: number) => {
    return `${seconds}s`
  }

  if (!session?.user) {
    return <div>Please sign in to view reports.</div>
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Monitor processing performance, success rates, and system usage metrics.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 3 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <p className="text-xs text-muted-foreground">
              +12% from previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">95.1%</div>
            <p className="text-xs text-muted-foreground">
              +2.1% from previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45.2s</div>
            <p className="text-xs text-muted-foreground">
              -3.1s from previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">
              +2 from previous period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Processing Performance Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Performance</CardTitle>
          <CardDescription>
            Document processing volume and success rates over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center border-2 border-dashed border-muted rounded-lg">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Performance chart would be displayed here</p>
              <p className="text-sm text-muted-foreground mt-2">Integration with charting library needed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Reports Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Processing Reports</CardTitle>
            <CardDescription>
              Detailed breakdown of processing metrics by time period
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={loadReports}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No report data available</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Avg Processing Time</TableHead>
                    <TableHead>Customers</TableHead>
                    <TableHead>Storage Used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{report.period}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{report.totalDocuments.toLocaleString()}</p>
                          <div className="flex space-x-2">
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              ✓ {report.successfulProcessing}
                            </Badge>
                            <Badge variant="destructive" className="text-xs">
                              ✗ {report.failedProcessing}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={parseFloat(calculateSuccessRate(report.successfulProcessing, report.totalDocuments)) >= 95 ? "default" : "secondary"}
                            className={parseFloat(calculateSuccessRate(report.successfulProcessing, report.totalDocuments)) >= 95 ? "bg-green-100 text-green-800" : ""}
                          >
                            {calculateSuccessRate(report.successfulProcessing, report.totalDocuments)}%
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatProcessingTime(report.averageProcessingTime)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{report.customersProcessed}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{report.storageUsed.toFixed(1)} GB</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-1" />
                            Export
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health Status */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Processing Breakdown</CardTitle>
            <CardDescription>
              Document processing by customer over the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Mock customer data */}
              {[
                { name: "ACME Corp", documents: 345, successRate: 98.2 },
                { name: "TechStart LLC", documents: 234, successRate: 94.7 },
                { name: "Global Industries", documents: 189, successRate: 96.8 },
                { name: "Small Business Co", documents: 156, successRate: 91.5 }
              ].map((customer, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Building2 className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">{customer.documents} documents</p>
                    </div>
                  </div>
                  <Badge
                    variant={customer.successRate >= 95 ? "default" : "secondary"}
                    className={customer.successRate >= 95 ? "bg-green-100 text-green-800" : ""}
                  >
                    {customer.successRate}% success
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Analysis</CardTitle>
            <CardDescription>
              Common processing errors and their frequency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Mock error data */}
              {[
                { type: "OCR Recognition Failed", count: 23, percentage: 37.7 },
                { type: "Template Mismatch", count: 18, percentage: 29.5 },
                { type: "Invalid PDF Format", count: 12, percentage: 19.7 },
                { type: "Customer Detection Failed", count: 8, percentage: 13.1 }
              ].map((error, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{error.type}</span>
                    <span className="text-sm text-muted-foreground">{error.count} errors</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${error.percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground">{error.percentage}% of total errors</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}