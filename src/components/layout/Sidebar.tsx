"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Upload,
  Archive,
  Users,
  Settings,
  BarChart3,
  Shield,
  BookTemplate,
  Building2,
  Home,
  LogOut
} from "lucide-react"
import { UserRole } from "@prisma/client"
import { signOut } from "next-auth/react"

interface SidebarProps {
  className?: string
}

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Home,
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER, UserRole.READONLY]
  },
  {
    name: "Upload Document",
    href: "/upload",
    icon: Upload,
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER]
  },
  {
    name: "Documents",
    href: "/documents",
    icon: FileText,
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER, UserRole.READONLY]
  },
  {
    name: "Archive",
    href: "/archive",
    icon: Archive,
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER, UserRole.READONLY]
  },
  {
    name: "Customers",
    href: "/customers",
    icon: Building2,
    roles: [UserRole.ADMIN, UserRole.MANAGER]
  },
  {
    name: "Templates",
    href: "/templates",
    icon: BookTemplate,
    roles: [UserRole.ADMIN, UserRole.MANAGER]
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.READONLY]
  },
  {
    name: "Users",
    href: "/users",
    icon: Users,
    roles: [UserRole.ADMIN, UserRole.MANAGER]
  },
  {
    name: "Audit Logs",
    href: "/audit",
    icon: Shield,
    roles: [UserRole.ADMIN]
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER, UserRole.READONLY]
  }
]

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  if (!session?.user) {
    return null
  }

  const userRole = session.user.role
  const availableNavigation = navigation.filter(item => item.roles.includes(userRole))

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/signin" })
  }

  return (
    <div className={cn("flex h-full w-64 flex-col bg-white border-r", className)}>
      <div className="p-6">
        <div className="flex items-center space-x-2">
          <FileText className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold">PDF Processor</span>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto p-4">
        <nav className="space-y-2">
          {availableNavigation.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isActive && "bg-blue-50 text-blue-700 hover:bg-blue-50"
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>

      <Separator />

      <div className="p-4 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-sm font-medium">
              {session.user.name?.charAt(0) || session.user.email.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {session.user.name || session.user.email}
            </p>
            <div className="flex items-center space-x-1">
              <Badge variant="secondary" className="text-xs">
                {userRole.toLowerCase()}
              </Badge>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}