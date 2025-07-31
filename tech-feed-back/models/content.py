from datetime import datetime
import json
from database import db

class Content(db.Model):
    """Modèle pour les contenus/articles"""
    __tablename__ = 'contents'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False, index=True)
    excerpt = db.Column(db.Text, nullable=True)
    content = db.Column(db.Text, nullable=True)
    author = db.Column(db.String(100), nullable=True)
    category = db.Column(db.String(50), nullable=False, index=True)
    tags = db.Column(db.Text, nullable=True)  # JSON string des tags
    image_url = db.Column(db.String(500), nullable=True)
    external_url = db.Column(db.String(500), nullable=True)
    duration = db.Column(db.Integer, nullable=True)  # Durée de lecture en minutes
    difficulty_level = db.Column(db.String(20), nullable=True)  # 'beginner', 'intermediate', 'advanced'
    is_published = db.Column(db.Boolean, default=True)
    is_featured = db.Column(db.Boolean, default=False)
    view_count = db.Column(db.Integer, default=0)
    like_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    published_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relations
    interactions = db.relationship('Interaction', backref='content', lazy='dynamic', cascade='all, delete-orphan')
    
    def __init__(self, title, category, excerpt=None, content=None, author=None, 
                 tags=None, image_url=None, external_url=None, duration=None, 
                 difficulty_level=None, is_featured=False):
        self.title = title
        self.category = category
        self.excerpt = excerpt
        self.content = content
        self.author = author
        self.set_tags(tags or [])
        self.image_url = image_url
        self.external_url = external_url
        self.duration = duration
        self.difficulty_level = difficulty_level
        self.is_featured = is_featured
    
    def set_tags(self, tags):
        """Stocke les tags en JSON"""
        self.tags = json.dumps(tags) if isinstance(tags, list) else tags
    
    def get_tags(self):
        """Récupère les tags depuis JSON"""
        try:
            return json.loads(self.tags) if self.tags else []
        except (json.JSONDecodeError, TypeError):
            return []
    
    def increment_view_count(self):
        """Incrémente le compteur de vues"""
        self.view_count += 1
        db.session.commit()
    
    def increment_like_count(self):
        """Incrémente le compteur de likes"""
        self.like_count += 1
        db.session.commit()
    
    def decrement_like_count(self):
        """Décrémente le compteur de likes"""
        if self.like_count > 0:
            self.like_count -= 1
            db.session.commit()
    
    def get_interactions_count(self, interaction_type=None):
        """Compte les interactions sur ce contenu"""
        query = self.interactions
        if interaction_type:
            query = query.filter_by(interaction_type=interaction_type)
        return query.count()
    
    def get_engagement_score(self):
        """Calcule un score d'engagement basé sur les interactions"""
        views = self.view_count or 0
        likes = self.like_count or 0
        
        if views == 0:
            return 0.0
        
        # Score basé sur le ratio likes/vues avec pondération temporelle
        like_ratio = likes / views if views > 0 else 0
        
        # Pondération temporelle : contenu plus récent = bonus
        days_old = (datetime.utcnow() - self.created_at).days
        time_factor = max(0.1, 1 - (days_old / 365))  # Décroit sur 1 an
        
        return (like_ratio * 100 + views * 0.1) * time_factor
    
    def is_relevant_for_user(self, user_preferences):
        """Vérifie si le contenu est pertinent pour les préférences utilisateur"""
        if not user_preferences:
            return False
        
        content_tags = [self.category] + self.get_tags()
        return any(pref in content_tags for pref in user_preferences)
    
    def get_similarity_score(self, user_preferences):
        """Calcule un score de similarité avec les préférences utilisateur"""
        if not user_preferences:
            return 0.0
        
        content_tags = [self.category] + self.get_tags()
        matching_tags = set(content_tags) & set(user_preferences)
        
        if not content_tags:
            return 0.0
        
        return len(matching_tags) / len(content_tags)
    
    def to_dict(self, include_content=False):
        """Convertit le contenu en dictionnaire"""
        data = {
            'id': self.id,
            'title': self.title,
            'excerpt': self.excerpt,
            'author': self.author,
            'category': self.category,
            'tags': self.get_tags(),
            'image_url': self.image_url,
            'external_url': self.external_url,
            'duration': self.duration,
            'difficulty_level': self.difficulty_level,
            'is_featured': self.is_featured,
            'view_count': self.view_count,
            'like_count': self.like_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'engagement_score': self.get_engagement_score()
        }
        
        # Inclure le contenu complet si demandé
        if include_content:
            data['content'] = self.content
            
        return data
    
    @staticmethod
    def get_by_category(category, limit=None):
        """Récupère les contenus par catégorie"""
        query = Content.query.filter_by(category=category, is_published=True)
        if limit:
            query = query.limit(limit)
        return query.all()
    
    @staticmethod
    def get_featured(limit=10):
        """Récupère les contenus mis en avant"""
        return Content.query.filter_by(is_featured=True, is_published=True).limit(limit).all()
    
    @staticmethod
    def get_popular(limit=10):
        """Récupère les contenus populaires"""
        return Content.query.filter_by(is_published=True).order_by(Content.view_count.desc()).limit(limit).all()
    
    @staticmethod
    def get_recent(limit=10):
        """Récupère les contenus récents"""
        return Content.query.filter_by(is_published=True).order_by(Content.created_at.desc()).limit(limit).all()
    
    @staticmethod
    def search(query, category=None):
        """Recherche dans les contenus"""
        search_query = Content.query.filter_by(is_published=True)
        
        if query:
            search_filter = Content.title.contains(query) | Content.excerpt.contains(query)
            search_query = search_query.filter(search_filter)
        
        if category:
            search_query = search_query.filter_by(category=category)
        
        return search_query.order_by(Content.created_at.desc()).all()
    
    def __repr__(self):
        return f'<Content {self.title}>' 