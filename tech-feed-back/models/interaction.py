from datetime import datetime
from database import db

class Interaction(db.Model):
    """Modèle pour les interactions utilisateur-contenu"""
    __tablename__ = 'interactions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    content_id = db.Column(db.Integer, db.ForeignKey('contents.id'), nullable=False, index=True)
    interaction_type = db.Column(db.String(20), nullable=False, index=True)  # 'view', 'like', 'dislike', 'favorite', 'share'
    rating = db.Column(db.Integer, nullable=True)  # Rating de 1 à 5 (optionnel)
    duration = db.Column(db.Integer, nullable=True)  # Temps passé sur le contenu en secondes
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Index composé pour éviter les doublons et optimiser les requêtes
    __table_args__ = (
        db.Index('idx_user_content_type', 'user_id', 'content_id', 'interaction_type'),
        db.UniqueConstraint('user_id', 'content_id', 'interaction_type', name='unique_user_content_interaction'),
    )
    
    # Types d'interaction valides
    VALID_TYPES = ['view', 'like', 'dislike', 'favorite', 'share', 'bookmark']
    
    def __init__(self, user_id, content_id, interaction_type, rating=None, duration=None):
        if interaction_type not in self.VALID_TYPES:
            raise ValueError(f"Type d'interaction invalide. Types valides: {', '.join(self.VALID_TYPES)}")
        
        self.user_id = user_id
        self.content_id = content_id
        self.interaction_type = interaction_type
        self.rating = rating
        self.duration = duration
    
    def update_duration(self, duration):
        """Met à jour la durée d'interaction"""
        self.duration = duration
        self.updated_at = datetime.utcnow()
        db.session.commit()
    
    def update_rating(self, rating):
        """Met à jour la note"""
        if rating and (rating < 1 or rating > 5):
            raise ValueError("La note doit être entre 1 et 5")
        
        self.rating = rating
        self.updated_at = datetime.utcnow()
        db.session.commit()
    
    def to_dict(self):
        """Convertit l'interaction en dictionnaire"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'content_id': self.content_id,
            'interaction_type': self.interaction_type,
            'rating': self.rating,
            'duration': self.duration,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @staticmethod
    def create_or_update(user_id, content_id, interaction_type, rating=None, duration=None):
        """Crée ou met à jour une interaction"""
        existing = Interaction.query.filter_by(
            user_id=user_id,
            content_id=content_id,
            interaction_type=interaction_type
        ).first()
        
        if existing:
            # Mettre à jour l'interaction existante
            if rating is not None:
                existing.update_rating(rating)
            if duration is not None:
                existing.update_duration(duration)
            return existing
        else:
            # Créer une nouvelle interaction
            interaction = Interaction(
                user_id=user_id,
                content_id=content_id,
                interaction_type=interaction_type,
                rating=rating,
                duration=duration
            )
            db.session.add(interaction)
            db.session.commit()
            return interaction
    
    @staticmethod
    def get_user_interactions(user_id, interaction_type=None, limit=None):
        """Récupère les interactions d'un utilisateur"""
        query = Interaction.query.filter_by(user_id=user_id)
        
        if interaction_type:
            query = query.filter_by(interaction_type=interaction_type)
        
        query = query.order_by(Interaction.created_at.desc())
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
    
    @staticmethod
    def get_content_interactions(content_id, interaction_type=None, limit=None):
        """Récupère les interactions sur un contenu"""
        query = Interaction.query.filter_by(content_id=content_id)
        
        if interaction_type:
            query = query.filter_by(interaction_type=interaction_type)
        
        query = query.order_by(Interaction.created_at.desc())
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
    
    @staticmethod
    def get_user_content_interaction(user_id, content_id, interaction_type):
        """Récupère une interaction spécifique"""
        return Interaction.query.filter_by(
            user_id=user_id,
            content_id=content_id,
            interaction_type=interaction_type
        ).first()
    
    @staticmethod
    def delete_interaction(user_id, content_id, interaction_type):
        """Supprime une interaction"""
        interaction = Interaction.get_user_content_interaction(user_id, content_id, interaction_type)
        if interaction:
            db.session.delete(interaction)
            db.session.commit()
            return True
        return False
    
    @staticmethod
    def get_user_preferences_from_interactions(user_id, limit_days=30):
        """Analyse les interactions pour déterminer les préférences utilisateur"""
        from datetime import timedelta
        from .content import Content
        
        # Récupérer les interactions récentes
        cutoff_date = datetime.utcnow() - timedelta(days=limit_days)
        interactions = Interaction.query.filter(
            Interaction.user_id == user_id,
            Interaction.created_at >= cutoff_date,
            Interaction.interaction_type.in_(['like', 'view', 'favorite'])
        ).all()
        
        # Compter les catégories et tags
        category_scores = {}
        tag_scores = {}
        
        for interaction in interactions:
            content = Content.query.get(interaction.content_id)
            if not content:
                continue
            
            # Score basé sur le type d'interaction
            score_weight = {
                'like': 3,
                'favorite': 3,
                'view': 1
            }.get(interaction.interaction_type, 1)
            
            # Score pour la catégorie
            if content.category:
                category_scores[content.category] = category_scores.get(content.category, 0) + score_weight
            
            # Score pour les tags
            for tag in content.get_tags():
                tag_scores[tag] = tag_scores.get(tag, 0) + score_weight
        
        # Retourner les préférences triées par score
        sorted_categories = sorted(category_scores.items(), key=lambda x: x[1], reverse=True)
        sorted_tags = sorted(tag_scores.items(), key=lambda x: x[1], reverse=True)
        
        return {
            'categories': [cat for cat, score in sorted_categories[:5]],  # Top 5
            'tags': [tag for tag, score in sorted_tags[:10]],  # Top 10
            'category_scores': category_scores,
            'tag_scores': tag_scores
        }
    
    @staticmethod
    def get_trending_content(limit=10, days=7):
        """Récupère le contenu trending basé sur les interactions récentes"""
        from datetime import timedelta
        from .content import Content
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Compter les interactions par contenu
        content_scores = {}
        interactions = Interaction.query.filter(
            Interaction.created_at >= cutoff_date,
            Interaction.interaction_type.in_(['like', 'view', 'favorite', 'share'])
        ).all()
        
        for interaction in interactions:
            score_weight = {
                'like': 3,
                'favorite': 3,
                'share': 4,
                'view': 1
            }.get(interaction.interaction_type, 1)
            
            content_scores[interaction.content_id] = content_scores.get(interaction.content_id, 0) + score_weight
        
        # Récupérer les contenus les mieux notés
        sorted_content_ids = sorted(content_scores.items(), key=lambda x: x[1], reverse=True)[:limit]
        content_ids = [content_id for content_id, score in sorted_content_ids]
        
        contents = Content.query.filter(Content.id.in_(content_ids)).all()
        
        # Trier les contenus selon l'ordre des scores
        contents_dict = {c.id: c for c in contents}
        return [contents_dict[content_id] for content_id in content_ids if content_id in contents_dict]
    
    def __repr__(self):
        return f'<Interaction {self.user_id}-{self.content_id}-{self.interaction_type}>' 