"use client"

import { useState, useCallback, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Customer {
  id: string
  name: string
}

interface UploadedFile {
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  documentId?: string
  error?: string
  progress?: number
}

export default function UploadPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<string>("")
  const [isDragActive, setIsDragActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Load customers on component mount
  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/customers')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      } else {
        console.warn('Failed to load customers:', response.status, response.statusText)
        // Continue without customers - auto-detect will be used
        setCustomers([])
      }
    } catch (error) {
      console.error('Failed to load customers:', error)
      // Continue without customers - auto-detect will be used
      setCustomers([])
    }
  }

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFiles(droppedFiles)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      handleFiles(selectedFiles)
    }
  }

  const handleFiles = (fileList: File[]) => {
    const validFiles = fileList.filter(file => {
      if (file.type !== 'application/pdf') {
        alert(`${file.name} is not a PDF file`)
        return false
      }
      if (file.size > 50 * 1024 * 1024) {
        alert(`${file.name} is too large (max 50MB)`)
        return false
      }
      return true
    })

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending'
    }))

    setFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (index: number) => {
    setFiles(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }

  const uploadFile = async (file: UploadedFile, index: number) => {
    setFiles(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], status: 'uploading', progress: 0 }
      return updated
    })

    try {
      const formData = new FormData()
      formData.append('file', file.file)
      if (selectedCustomer) {
        formData.append('customerId', selectedCustomer)
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setFiles(prev => {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            status: 'success',
            documentId: result.document.id,
            progress: 100
          }
          return updated
        })
      } else {
        setFiles(prev => {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            status: 'error',
            error: result.error || 'Upload failed'
          }
          return updated
        })
      }
    } catch (error) {
      setFiles(prev => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          status: 'error',
          error: 'Upload failed'
        }
        return updated
      })
    }
  }

  const uploadAllFiles = async () => {
    setIsLoading(true)
    const pendingFiles = files.filter(f => f.status === 'pending')

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'pending') {
        await uploadFile(files[i], i)
      }
    }

    setIsLoading(false)
  }

  const clearAll = () => {
    files.forEach(file => URL.revokeObjectURL(file.preview))
    setFiles([])
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-500" />
      case 'uploading':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'uploading':
        return <Badge className="bg-blue-100 text-blue-800">Uploading</Badge>
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
    }
  }

  if (!session?.user) {
    return <div>Please sign in to upload documents.</div>
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Documents</h1>
        <p className="text-muted-foreground mt-2">
          Upload PDF documents for automated processing and CSV extraction.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Upload Area */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Select Documents</CardTitle>
              <CardDescription>
                Upload PDF files for processing. Maximum file size: 50MB per file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Customer Selection */}
              <div className="space-y-2">
                <Label htmlFor="customer">Customer (Optional)</Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-detect customer or select manually" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-detect customer</SelectItem>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Drag & Drop Area */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  isDragActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                )}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    Drag and drop PDF files here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse files
                  </p>
                </div>
                <Input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                />
                <Label htmlFor="file-upload" className="mt-4 inline-block">
                  <Button variant="outline" className="cursor-pointer">
                    Browse Files
                  </Button>
                </Label>
              </div>

              {/* Action Buttons */}
              {files.length > 0 && (
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={clearAll}
                    disabled={isLoading}
                  >
                    Clear All
                  </Button>
                  <Button
                    onClick={uploadAllFiles}
                    disabled={isLoading || files.every(f => f.status !== 'pending')}
                  >
                    {isLoading ? 'Uploading...' : 'Upload All Files'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upload Instructions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Upload Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Supported Files</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• PDF format only</li>
                  <li>• Maximum 50MB per file</li>
                  <li>• Text-based or scanned PDFs</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Processing</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Automatic customer detection</li>
                  <li>• Template-based extraction</li>
                  <li>• CSV output generation</li>
                  <li>• Email notifications</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2">Best Practices</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Use clear, readable scans</li>
                  <li>• Include customer identifiers</li>
                  <li>• Keep consistent formatting</li>
                  <li>• Check file quality before upload</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files ({files.length})</CardTitle>
            <CardDescription>
              Track the status of your uploaded documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-red-500" />
                    <div>
                      <p className="font-medium">{file.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {file.error && (
                        <p className="text-sm text-red-600">{file.error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {getStatusIcon(file.status)}
                    {getStatusBadge(file.status)}

                    {file.status === 'success' && file.documentId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/documents/${file.documentId}`)}
                      >
                        View Details
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={file.status === 'uploading'}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}