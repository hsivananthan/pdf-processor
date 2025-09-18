"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  FileText,
  Download,
  Eye,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  User,
  Building2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Document {
  id: string
  filename: string
  fileSize: number
  status: string
  createdAt: string
  customerId?: string
  customer?: {
    id: string
    name: string
  }
  uploadedBy: {
    id: string
    name: string
    email: string
  }
  processingJobs: Array<{
    status: string
    completedAt?: string
  }>
  csvOutputs: Array<{
    id: string
    fileName: string
    rowCount: number
    columnCount: number
  }>
}

export default function DocumentsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (session?.user) {
      loadDocuments()
    }
  }, [session, page, statusFilter])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10"
      })

      if (statusFilter) {
        params.append("status", statusFilter)
      }

      const response = await fetch(`/api/upload?${params}`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
        setTotalPages(data.pagination?.pages || 1)
      }
    } catch (error) {
      console.error("Failed to load documents:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      UPLOADED: { variant: "secondary" as const, label: "Uploaded" },
      PROCESSING: { variant: "default" as const, label: "Processing" },
      COMPLETED: { variant: "default" as const, label: "Completed" },
      FAILED: { variant: "destructive" as const, label: "Failed" },
      ARCHIVED: { variant: "outline" as const, label: "Archived" }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.UPLOADED
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.uploadedBy.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!session?.user) {
    return <div>Please sign in to view documents.</div>
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground mt-2">
          View and manage processed PDF documents and their CSV outputs.
        </p>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents, customers, or users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="UPLOADED">Uploaded</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={loadDocuments}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
          <CardDescription>
            Click on a document to view details and download CSV outputs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No documents found</p>
              <Button
                className="mt-4"
                onClick={() => router.push('/upload')}
              >
                Upload Your First Document
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>CSV Output</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <FileText className="h-8 w-8 text-red-500" />
                          <div>
                            <p className="font-medium">{document.filename}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatFileSize(document.fileSize)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(document.status)}
                      </TableCell>
                      <TableCell>
                        {document.customer ? (
                          <div className="flex items-center space-x-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{document.customer.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Auto-detect</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm">{document.uploadedBy.name || document.uploadedBy.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{formatDate(document.createdAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {document.csvOutputs.length > 0 ? (
                          <div className="text-sm">
                            <p className="font-medium">{document.csvOutputs[0].fileName}</p>
                            <p className="text-muted-foreground">
                              {document.csvOutputs[0].rowCount} rows, {document.csvOutputs[0].columnCount} columns
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Processing...</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {document.csvOutputs.length > 0 && (
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}