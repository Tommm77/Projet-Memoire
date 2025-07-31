"use client"

import Link from "next/link"
import Image from "next/image"
import { Heart, Bookmark, Calendar, User, Clock, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Content } from "@/lib/api"
import { formatDistance } from "date-fns"
import { fr } from "date-fns/locale"

interface ArticleCardProps {
  article: Content
  onLike?: (id: number) => void
  onSave?: (id: number) => void
  showActions?: boolean
  isLiked?: boolean
  isSaved?: boolean
}

// Fonction utilitaire pour formater la date
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return formatDistance(date, new Date(), { addSuffix: true, locale: fr })
  } catch {
    return "Récemment"
  }
}

// Fonction utilitaire pour obtenir une couleur de badge selon la catégorie
const getCategoryColor = (category: string): string => {
  const colors = {
    'IA': 'bg-purple-100 text-purple-800',
    'DevOps': 'bg-blue-100 text-blue-800',
    'Cyber': 'bg-red-100 text-red-800',
    'Mobile': 'bg-green-100 text-green-800',
    'Frontend': 'bg-orange-100 text-orange-800',
    'Backend': 'bg-gray-100 text-gray-800',
  }
  return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800'
}

// Fonction utilitaire pour obtenir une image par défaut selon la catégorie
const getDefaultImage = (category: string): string => {
  const images = {
    'IA': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=200&fit=crop',
    'DevOps': 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=400&h=200&fit=crop',
    'Cyber': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=200&fit=crop',
    'Mobile': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=200&fit=crop',
    'Frontend': 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=400&h=200&fit=crop',
    'Backend': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=200&fit=crop',
  }
  return images[category as keyof typeof images] || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=200&fit=crop'
}

export function ArticleCard({ 
  article, 
  onLike, 
  onSave, 
  showActions = true, 
  isLiked = false, 
  isSaved = false 
}: ArticleCardProps) {
  const imageUrl = article.image_url || getDefaultImage(article.category)

  return (
    <div className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/article/${article.id}`}>
        <div className="relative h-48 w-full">
          <Image
            src={imageUrl}
            alt={article.title}
            fill
            className="object-cover rounded-t-lg"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {article.is_featured && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-yellow-500 text-white">Featured</Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <Badge className={getCategoryColor(article.category)}>
            {article.category}
          </Badge>
          <div className="flex items-center text-sm text-gray-500">
            <Calendar className="h-4 w-4 mr-1" />
            {formatDate(article.created_at)}
          </div>
        </div>

        <Link href={`/article/${article.id}`}>
          <h3 className="text-xl font-semibold mb-2 hover:text-primary line-clamp-2">
            {article.title}
          </h3>
        </Link>

        <p className="text-gray-600 mb-4 line-clamp-3">
          {article.excerpt}
        </p>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-sm text-gray-500">
            <User className="h-4 w-4 mr-1" />
            {article.author}
          </div>
          
          <div className="flex items-center space-x-3 text-sm text-gray-500">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {article.duration} min
            </div>
            <div className="flex items-center">
              <Eye className="h-4 w-4 mr-1" />
              {article.view_count}
            </div>
          </div>
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {article.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
            {article.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{article.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {showActions && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onLike?.(article.id)}
                className={isLiked ? "text-red-500" : ""}
              >
                <Heart className={`h-4 w-4 mr-1 ${isLiked ? "fill-current" : ""}`} />
                {article.like_count}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSave?.(article.id)}
                className={isSaved ? "text-blue-500" : ""}
              >
                <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
              </Button>
            </div>
            
            <Badge variant="outline" className="text-xs">
              {article.difficulty_level}
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}
