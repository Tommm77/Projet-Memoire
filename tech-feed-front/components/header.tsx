"use client"

import Link from "next/link"
import { useAuth } from "./auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, User, LogOut } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold text-primary">
              TechFeed
            </Link>
            <nav className="hidden md:flex space-x-6">
              <Link href="/" className="text-gray-600 hover:text-gray-900">
                Accueil
              </Link>
              {user && (
                <Link href="/feed" className="text-gray-600 hover:text-gray-900">
                  Pour vous
                </Link>
              )}
              <Link href="/explore" className="text-gray-600 hover:text-gray-900">
                Explorer
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Rechercher..." className="pl-10 w-64" />
            </div>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.name || user.email}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {user.name || user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm">
                    <div className="font-medium">{user.name || "Utilisateur"}</div>
                    <div className="text-gray-500 text-xs">{user.email}</div>
                  </div>
                  <div className="border-t my-1"></div>
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profil</Link>
                  </DropdownMenuItem>
                  {user.isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">Administration</Link>
                    </DropdownMenuItem>
                  )}
                  <div className="border-t my-1"></div>
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex space-x-2">
                <Button variant="ghost" asChild>
                  <Link href="/login">Connexion</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">S'inscrire</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
