"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  Users,
  Plus,
  RefreshCw,
  Mail,
  Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"

interface User {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
  failedAttempts: number
  lockedUntil?: string
}

export default function UsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user) {
      loadUsers()
    }
  }, [session])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      } else {
        console.warn('Failed to load users:', response.status)
        setUsers([])
      }
    } catch (error) {
      console.error('Failed to load users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      ADMIN: { variant: "destructive" as const, label: "Admin" },
      MANAGER: { variant: "default" as const, label: "Manager" },
      USER: { variant: "secondary" as const, label: "User" },
      READONLY: { variant: "outline" as const, label: "Read Only" }
    }
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.USER
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (!session?.user) {
    return <div>Please sign in to view users.</div>
  }

  // Check if user has permission to view users
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                You don't have permission to view users.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage user accounts, roles, and permissions.
          </p>
        </div>
        {session.user.role === 'ADMIN' && (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Users ({users.length})</CardTitle>
            <CardDescription>
              System users and their access levels.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={loadUsers}
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
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium">
                              {user.name?.charAt(0) || user.email.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{user.name || user.email}</p>
                            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span>{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                            <Badge variant="destructive" className="block w-fit">
                              Locked
                            </Badge>
                          )}
                          {user.failedAttempts > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {user.failedAttempts} failed attempts
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.lastLogin ? (
                          <div className="flex items-center space-x-2 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {new Date(user.lastLogin).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {session.user.role === 'ADMIN' && (
                            <>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                              {user.id !== session.user.id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={user.isActive ? "text-red-600" : ""}
                                >
                                  {user.isActive ? "Disable" : "Enable"}
                                </Button>
                              )}
                            </>
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
    </div>
  )
}