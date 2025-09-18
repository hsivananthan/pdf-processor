"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Building2,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Customer {
  id: string
  name: string
  identifierPatterns: Array<{
    type: string
    pattern: string
    weight: number
    caseSensitive: boolean
  }>
  contactInfo?: {
    email?: string
    phone?: string
    address?: string
  }
  isActive: boolean
  createdAt: string
  _count?: {
    documents: number
  }
}

export default function CustomersPage() {
  const { data: session } = useSession()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (session?.user) {
      loadCustomers()
    }
  }, [session])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/customers')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      } else {
        console.warn('Failed to load customers:', response.status)
        setCustomers([])
      }
    } catch (error) {
      console.error('Failed to load customers:', error)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.contactInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!session?.user) {
    return <div>Please sign in to view customers.</div>
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-2">
            Manage customer accounts and their document processing rules.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Customers ({filteredCustomers.length})</CardTitle>
            <CardDescription>
              Configure customer-specific PDF processing rules and templates.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={loadCustomers}
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
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {customers.length === 0 ? "No customers found" : "No customers match your search"}
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Customer
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Identifier Patterns</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Building2 className="h-8 w-8 text-blue-500" />
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">ID: {customer.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {customer.contactInfo?.email && (
                            <div className="flex items-center space-x-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span>{customer.contactInfo.email}</span>
                            </div>
                          )}
                          {customer.contactInfo?.phone && (
                            <div className="flex items-center space-x-2 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span>{customer.contactInfo.phone}</span>
                            </div>
                          )}
                          {customer.contactInfo?.address && (
                            <div className="flex items-center space-x-2 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span>{customer.contactInfo.address}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {customer.identifierPatterns.slice(0, 2).map((pattern, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {pattern.type}: {pattern.pattern.slice(0, 20)}
                              {pattern.pattern.length > 20 && '...'}
                            </Badge>
                          ))}
                          {customer.identifierPatterns.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{customer.identifierPatterns.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {customer._count?.documents || 0} documents
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.isActive ? "default" : "secondary"}>
                          {customer.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                          <Button variant="outline" size="sm">
                            Templates
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
    </div>
  )
}