from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, create_access_token, create_refresh_token, get_jwt_identity
from datetime import datetime
import re

# Import des modèles
from models.user import User
from database import db
from kafka_producer import track_user_event

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    """Valide le format de l'email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Valide le mot de passe"""
    errors = []
    if len(password) < 6:
        errors.append("Le mot de passe doit contenir au moins 6 caractères")
    if not re.search(r'[A-Za-z]', password):
        errors.append("Le mot de passe doit contenir au moins une lettre")
    return errors

@auth_bp.route('/login', methods=['POST'])
def login():
    """Connexion utilisateur"""
    try:
        data = request.get_json()
        
        if not data:
            return {'error': 'Données JSON requises'}, 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        remember_me = data.get('rememberMe', False)
        
        # Validation des champs
        if not email or not password:
            return {'error': 'Email et mot de passe requis'}, 400
        
        if not validate_email(email):
            return {'error': 'Format d\'email invalide'}, 400
        
        # Recherche de l'utilisateur
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return {'error': 'Email ou mot de passe incorrect'}, 401
        
        if not user.is_active:
            return {'error': 'Compte désactivé'}, 401
        
        # Créer les tokens avant la mise à jour
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        # Préparer les données utilisateur avant commit
        user_data = {
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'preferences': user.get_preferences(),
            'is_admin': user.is_admin,
            'avatar': user.avatar,
            'is_active': user.is_active,
            'created_at': user.created_at.isoformat() if user.created_at else None,
            'updated_at': datetime.utcnow().isoformat(),
            'last_login': datetime.utcnow().isoformat()
        }
        
        # Mise à jour de la dernière connexion
        try:
            user.last_login = datetime.utcnow()
            user.updated_at = datetime.utcnow()
            db.session.commit()
            
            # Tracker l'événement de login dans Kafka
            track_user_event(
                user_id=user.id,
                event_type='login',
                email=user.email,
                name=user.name,
                preferences=user.get_preferences()
            )
        except Exception as commit_error:
            db.session.rollback()
            # Connexion réussie même si la mise à jour de last_login échoue
            print(f"Erreur lors de la mise à jour de last_login: {commit_error}")
        
        return {
            'success': True,
            'message': 'Connexion réussie',
            'user': user_data,
            'access_token': access_token,
            'refresh_token': refresh_token
        }, 200
        
    except Exception as e:
        db.session.rollback()
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Inscription utilisateur"""
    try:
        data = request.get_json()
        
        if not data:
            return {'error': 'Données JSON requises'}, 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        name = data.get('name', '').strip()
        preferences = data.get('preferences', [])
        
        # Validation des champs
        if not email or not password or not name:
            return {'error': 'Email, mot de passe et nom requis'}, 400
        
        if not validate_email(email):
            return {'error': 'Format d\'email invalide'}, 400
        
        password_errors = validate_password(password)
        if password_errors:
            return {'error': password_errors[0]}, 400
        
        if not isinstance(preferences, list) or len(preferences) == 0:
            return {'error': 'Au moins une préférence est requise'}, 400
        
        # Vérifier si l'utilisateur existe déjà
        if User.query.filter_by(email=email).first():
            return {'error': 'Un compte avec cet email existe déjà'}, 409
        
        # Créer l'utilisateur
        user = User.create_user(
            email=email,
            password=password,
            name=name,
            preferences=preferences
        )
        
        # Tracker l'événement de signup dans Kafka
        try:
            track_user_event(
                user_id=user.id,
                event_type='signup',
                email=user.email,
                name=user.name,
                preferences=user.get_preferences()
            )
        except Exception as e:
            print(f"Erreur lors du tracking Kafka signup: {e}")
        
        # Créer les tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return {
            'success': True,
            'message': 'Compte créé avec succès',
            'user': user.to_dict(include_sensitive=True),
            'access_token': access_token,
            'refresh_token': refresh_token
        }, 201
        
    except ValueError as e:
        return {'error': str(e)}, 400
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Renouvelle le token d'accès"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_active:
            return {'error': 'Utilisateur non trouvé ou inactif'}, 404
        
        # Créer un nouveau token d'accès
        access_token = create_access_token(identity=user.id)
        
        return {
            'success': True,
            'access_token': access_token
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Récupère le profil utilisateur"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return {'error': 'Utilisateur non trouvé'}, 404
        
        return {
            'success': True,
            'user': user.to_dict(include_sensitive=True)
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Met à jour le profil utilisateur"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return {'error': 'Utilisateur non trouvé'}, 404
        
        data = request.get_json()
        if not data:
            return {'error': 'Données JSON requises'}, 400
        
        updated = False
        
        # Mise à jour du nom
        if 'name' in data:
            name = data['name'].strip()
            if name and name != user.name:
                user.name = name
                updated = True
        
        # Mise à jour des préférences
        if 'preferences' in data:
            preferences = data['preferences']
            if isinstance(preferences, list) and preferences != user.get_preferences():
                user.set_preferences(preferences)
                updated = True
        
        # Mise à jour de l'avatar
        if 'avatar' in data:
            avatar = data['avatar']
            if avatar != user.avatar:
                user.avatar = avatar
                updated = True
        
        if updated:
            user.updated_at = datetime.utcnow()
            db.session.commit()
        
        return {
            'success': True,
            'message': 'Profil mis à jour avec succès',
            'user': user.to_dict(include_sensitive=True)
        }, 200
        
    except Exception as e:
        db.session.rollback()
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change le mot de passe utilisateur"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return {'error': 'Utilisateur non trouvé'}, 404
        
        data = request.get_json()
        if not data:
            return {'error': 'Données JSON requises'}, 400
        
        current_password = data.get('currentPassword', '')
        new_password = data.get('newPassword', '')
        
        if not current_password or not new_password:
            return {'error': 'Mot de passe actuel et nouveau mot de passe requis'}, 400
        
        # Vérifier le mot de passe actuel
        if not user.check_password(current_password):
            return {'error': 'Mot de passe actuel incorrect'}, 401
        
        # Valider le nouveau mot de passe
        password_errors = validate_password(new_password)
        if password_errors:
            return {'error': password_errors[0]}, 400
        
        # Mettre à jour le mot de passe
        user.set_password(new_password)
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Mot de passe changé avec succès'
        }, 200
        
    except Exception as e:
        db.session.rollback()
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@auth_bp.route('/check-email', methods=['POST'])
def check_email():
    """Vérifie si un email est disponible"""
    try:
        data = request.get_json()
        if not data:
            return {'error': 'Données JSON requises'}, 400
        
        email = data.get('email', '').strip().lower()
        
        if not email:
            return {'error': 'Email requis'}, 400
        
        if not validate_email(email):
            return {'error': 'Format d\'email invalide'}, 400
        
        exists = User.query.filter_by(email=email).first() is not None
        
        return {
            'success': True,
            'available': not exists
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Déconnexion utilisateur (côté client principalement)"""
    try:
        # Note: avec JWT stateless, la déconnexion est principalement côté client
        # Dans une implémentation complète, on pourrait maintenir une blacklist des tokens
        
        return {
            'success': True,
            'message': 'Déconnexion réussie'
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500 