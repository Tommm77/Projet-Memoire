"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { categories } from "@/lib/mock-data"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [preferences, setPreferences] = useState<string[]>([])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
  const { signup, isAuthenticated } = useAuth()
  const router = useRouter()

  // Rediriger si déjà connecté
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/feed")
    }
  }, [isAuthenticated, router])

  // Validation en temps réel du mot de passe
  useEffect(() => {
    if (password) {
      const errors: string[] = []
      if (password.length < 6) {
        errors.push("Au moins 6 caractères")
      }
      if (!/[A-Za-z]/.test(password)) {
        errors.push("Au moins une lettre")
      }
      setPasswordErrors(errors)
    } else {
      setPasswordErrors([])
    }
  }, [password])

  const handlePreferenceChange = (category: string, checked: boolean) => {
    if (checked) {
      setPreferences([...preferences, category])
    } else {
      setPreferences(preferences.filter((p) => p !== category))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("Le nom est requis")
      return
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      return
    }

    if (passwordErrors.length > 0) {
      setError("Veuillez corriger les erreurs du mot de passe")
      return
    }

    if (preferences.length === 0) {
      setError("Veuillez sélectionner au moins un centre d'intérêt")
      return
    }

    setIsLoading(true)

    try {
      const result = await signup(email, password, name, preferences)
      if (result.success) {
        router.push("/feed")
      } else {
        setError(result.error || "Une erreur est survenue lors de l'inscription")
      }
    } catch (err) {
      setError("Une erreur inattendue s'est produite")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Créer un compte</CardTitle>
          <CardDescription>Rejoignez TechFeed et personnalisez votre veille technologique</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Votre nom complet"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={passwordErrors.length > 0 ? "border-yellow-300" : ""}
                />
                {passwordErrors.length > 0 && (
                  <div className="text-xs text-yellow-600 space-y-1">
                    {passwordErrors.map((error, index) => (
                      <div key={index} className="flex items-center">
                        <span className="w-1 h-1 bg-yellow-400 rounded-full mr-2"></span>
                        {error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">Centres d'intérêt (sélectionnez au moins un)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={category}
                      checked={preferences.includes(category)}
                      onCheckedChange={(checked) => handlePreferenceChange(category, checked as boolean)}
                    />
                    <Label htmlFor={category} className="text-sm">
                      {category === "IA"
                        ? "🧠 IA"
                        : category === "DevOps"
                          ? "⚙️ DevOps"
                          : category === "Cyber"
                            ? "🛡️ Cyber"
                            : category === "Mobile"
                              ? "📱 Mobile"
                              : category === "Big Data"
                                ? "📊 Big Data"
                                : category === "Blockchain"
                                  ? "⛓️ Blockchain"
                                  : category === "Cloud"
                                    ? "☁️ Cloud"
                                    : category === "Frontend"
                                      ? "🎨 Frontend"
                                      : "⚡ Backend"}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer mon compte
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Déjà un compte ?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
