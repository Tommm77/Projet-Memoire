from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import json
from database import db

class User(db.Model):
    """Modèle utilisateur"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    preferences = db.Column(db.Text, nullable=True)  # JSON string des préférences
    is_admin = db.Column(db.Boolean, default=False)
    avatar = db.Column(db.String(200), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Relations
    interactions = db.relationship('Interaction', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    
    def __init__(self, email, password, name=None, preferences=None, is_admin=False, avatar=None):
        self.email = email.lower().strip()
        self.set_password(password)
        self.name = name
        self.set_preferences(preferences or [])
        self.is_admin = is_admin
        self.avatar = avatar
    
    def set_password(self, password):
        """Hash et stocke le mot de passe"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Vérifie le mot de passe"""
        return check_password_hash(self.password_hash, password)
    
    def set_preferences(self, preferences):
        """Stocke les préférences en JSON"""
        self.preferences = json.dumps(preferences) if isinstance(preferences, list) else preferences
    
    def get_preferences(self):
        """Récupère les préférences depuis JSON"""
        try:
            return json.loads(self.preferences) if self.preferences else []
        except (json.JSONDecodeError, TypeError):
            return []
    

    
    def get_interactions_count(self, interaction_type=None):
        """Compte les interactions de l'utilisateur"""
        query = self.interactions
        if interaction_type:
            query = query.filter_by(interaction_type=interaction_type)
        return query.count()
    
    def get_liked_contents(self):
        """Récupère les contenus aimés par l'utilisateur"""
        from .content import Content
        liked_interactions = self.interactions.filter_by(interaction_type='like').all()
        return [Content.query.get(interaction.content_id) for interaction in liked_interactions]
    
    def get_viewed_contents(self):
        """Récupère les contenus vus par l'utilisateur"""
        from .content import Content
        viewed_interactions = self.interactions.filter_by(interaction_type='view').all()
        return [Content.query.get(interaction.content_id) for interaction in viewed_interactions]
    
    def to_dict(self, include_sensitive=False, include_stats=False):
        """Convertit l'utilisateur en dictionnaire"""
        data = {
            'id': self.id,
            'email': self.email if include_sensitive else None,
            'name': self.name,
            'preferences': self.get_preferences(),
            'is_admin': self.is_admin,
            'avatar': self.avatar,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
        
        # Inclure l'email pour l'utilisateur lui-même
        if include_sensitive:
            data['email'] = self.email
        
        # Inclure les statistiques seulement si demandé (évite les requêtes supplémentaires)
        if include_stats:
            try:
                data['interactions_count'] = self.get_interactions_count()
            except:
                data['interactions_count'] = 0
            
        return data
    
    @staticmethod
    def create_user(email, password, name=None, preferences=None, is_admin=False):
        """Crée un nouvel utilisateur"""
        # Vérifier si l'email existe déjà
        if User.query.filter_by(email=email.lower().strip()).first():
            raise ValueError("Un utilisateur avec cet email existe déjà")
        
        user = User(
            email=email,
            password=password,
            name=name,
            preferences=preferences,
            is_admin=is_admin
        )
        
        db.session.add(user)
        db.session.commit()
        return user
    
    def __repr__(self):
        return f'<User {self.email}>' 