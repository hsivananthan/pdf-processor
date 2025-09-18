"use client"

import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Upload,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Database
} from "lucide-react"
import Link from "next/link"

export default function Dashboard() {
  const { data: session } = useSession()

  if (!session?.user) {
    return <div>Loading...</div>
  }

  const stats = [
    {
      title: "Total Documents",
      value: "1,234",
      change: "+12%",
      icon: FileText,
      color: "text-blue-600"
    },
    {
      title: "Processing Queue",
      value: "23",
      change: "-5%",
      icon: Clock,
      color: "text-yellow-600"
    },
    {
      title: "Completed Today",
      value: "89",
      change: "+18%",
      icon: CheckCircle,
      color: "text-green-600"
    },
    {
      title: "Failed Processing",
      value: "7",
      change: "+2%",
      icon: AlertCircle,
      color: "text-red-600"
    }
  ]

  const recentActivity = [
    {
      id: 1,
      action: "Document uploaded",
      document: "invoice_acme_2024.pdf",
      user: "John Doe",
      timestamp: "2 minutes ago",
      status: "processing"
    },
    {
      id: 2,
      action: "Processing completed",
      document: "receipt_vendor_123.pdf",
      user: "Jane Smith",
      timestamp: "5 minutes ago",
      status: "completed"
    },
    {
      id: 3,
      action: "Template updated",
      document: "Customer Template v2",
      user: "Admin",
      timestamp: "1 hour ago",
      status: "updated"
    }
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processing":
        return <Badge variant="secondary">Processing</Badge>
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case "updated":
        return <Badge className="bg-blue-100 text-blue-800">Updated</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {session.user.name || session.user.email}
        </h1>
        <p className="text-muted-foreground mt-2">
          Here's what's happening with your PDF processing system today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.change} from last month
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks you can perform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/upload">
              <Button className="w-full justify-start" variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload New Document
              </Button>
            </Link>
            <Link href="/templates">
              <Button className="w-full justify-start" variant="outline">
                <Database className="mr-2 h-4 w-4" />
                Manage Templates
              </Button>
            </Link>
            <Link href="/customers">
              <Button className="w-full justify-start" variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Customer Management
              </Button>
            </Link>
            <Link href="/reports">
              <Button className="w-full justify-start" variant="outline">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Reports
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest system activities and updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {activity.action}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.document} by {activity.user}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    {getStatusBadge(activity.status)}
                    <p className="text-xs text-muted-foreground">
                      {activity.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Current system health and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Processing Queue</span>
                <Badge variant="secondary">Normal</Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: "30%" }}></div>
              </div>
              <p className="text-xs text-muted-foreground">23 jobs in queue</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Storage Usage</span>
                <Badge variant="secondary">Good</Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: "65%" }}></div>
              </div>
              <p className="text-xs text-muted-foreground">6.5GB of 10GB used</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Success Rate</span>
                <Badge className="bg-green-100 text-green-800">Excellent</Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: "95%" }}></div>
              </div>
              <p className="text-xs text-muted-foreground">95% success rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}