import Link from "next/link"
import { Github, Mail, Linkedin } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4">TechFeed</h3>
            <p className="text-gray-600 text-sm">Votre plateforme de veille technologique personnalisée</p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-gray-600 hover:text-gray-900">
                  Accueil
                </Link>
              </li>
              <li>
                <Link href="/explore" className="text-gray-600 hover:text-gray-900">
                  Explorer
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-gray-600 hover:text-gray-900">
                  S'inscrire
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Légal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="#" className="text-gray-600 hover:text-gray-900">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="#" className="text-gray-600 hover:text-gray-900">
                  Politique de confidentialité
                </Link>
              </li>
              <li>
                <Link href="#" className="text-gray-600 hover:text-gray-900">
                  CGU
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <div className="flex space-x-4">
              <a href="mailto:contact@techfeed.com" className="text-gray-600 hover:text-gray-900">
                <Mail className="h-5 w-5" />
              </a>
              <a href="https://github.com" className="text-gray-600 hover:text-gray-900">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://linkedin.com" className="text-gray-600 hover:text-gray-900">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-gray-600">
          © 2024 TechFeed. Tous droits réservés.
        </div>
      </div>
    </footer>
  )
}
