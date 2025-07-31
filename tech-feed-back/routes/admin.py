from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.user import User
from models.content import Content
from models.interaction import Interaction
from database import db
from datetime import datetime

admin_bp = Blueprint('admin', __name__)

def require_admin():
    """Décorateur pour vérifier les droits admin"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user or not user.is_admin:
        return {'error': 'Accès non autorisé - droits administrateur requis'}, 403
    return None

@admin_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_admin_stats():
    """Récupère les statistiques globales de l'application"""
    try:
        admin_check = require_admin()
        if admin_check:
            return admin_check
        
        # Statistiques utilisateurs
        total_users = User.query.count()
        active_users = User.query.filter_by(is_active=True).count()
        admin_users = User.query.filter_by(is_admin=True).count()
        
        # Statistiques contenus
        total_contents = Content.query.count()
        published_contents = Content.query.filter_by(is_published=True).count()
        featured_contents = Content.query.filter_by(is_featured=True).count()
        
        # Statistiques interactions
        total_interactions = Interaction.query.count()
        total_likes = Interaction.query.filter_by(interaction_type='like').count()
        total_views = Interaction.query.filter_by(interaction_type='view').count()
        
        # Top contenus par vues
        top_contents = Content.query.filter_by(is_published=True).order_by(
            Content.view_count.desc()
        ).limit(5).all()
        
        # Catégories populaires
        category_stats = db.session.query(
            Content.category,
            db.func.count(Content.id).label('count'),
            db.func.sum(Content.view_count).label('total_views')
        ).filter_by(is_published=True).group_by(Content.category).all()
        
        return {
            'success': True,
            'stats': {
                'users': {
                    'total': total_users,
                    'active': active_users,
                    'admins': admin_users
                },
                'contents': {
                    'total': total_contents,
                    'published': published_contents,
                    'featured': featured_contents
                },
                'interactions': {
                    'total': total_interactions,
                    'likes': total_likes,
                    'views': total_views
                },
                'top_contents': [content.to_dict() for content in top_contents],
                'categories': [
                    {
                        'name': cat,
                        'content_count': count,
                        'total_views': views or 0
                    }
                    for cat, count, views in category_stats
                ]
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Récupère la liste des utilisateurs"""
    try:
        admin_check = require_admin()
        if admin_check:
            return admin_check
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '')
        
        per_page = min(per_page, 100)
        
        query = User.query
        
        if search:
            query = query.filter(
                User.email.contains(search) | User.name.contains(search)
            )
        
        users = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return {
            'success': True,
            'users': [user.to_dict(include_sensitive=True, include_stats=True) for user in users.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': users.total,
                'pages': users.pages,
                'has_next': users.has_next,
                'has_prev': users.has_prev
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Met à jour un utilisateur"""
    try:
        admin_check = require_admin()
        if admin_check:
            return admin_check
        
        user = User.query.get(user_id)
        if not user:
            return {'error': 'Utilisateur non trouvé'}, 404
        
        data = request.get_json()
        if not data:
            return {'error': 'Données JSON requises'}, 400
        
        # Mise à jour des champs autorisés
        if 'is_active' in data:
            user.is_active = bool(data['is_active'])
        
        if 'is_admin' in data:
            user.is_admin = bool(data['is_admin'])
        
        if 'name' in data:
            user.name = data['name'].strip()
        
        if 'preferences' in data and isinstance(data['preferences'], list):
            user.set_preferences(data['preferences'])
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Utilisateur mis à jour',
            'user': user.to_dict(include_sensitive=True)
        }, 200
        
    except Exception as e:
        db.session.rollback()
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@admin_bp.route('/contents', methods=['GET'])
@jwt_required()
def get_admin_contents():
    """Récupère la liste des contenus pour l'administration"""
    try:
        admin_check = require_admin()
        if admin_check:
            return admin_check
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')  # 'published', 'draft', 'featured'
        category = request.args.get('category')
        search = request.args.get('search', '')
        
        per_page = min(per_page, 100)
        
        query = Content.query
        
        # Filtres
        if status == 'published':
            query = query.filter_by(is_published=True)
        elif status == 'draft':
            query = query.filter_by(is_published=False)
        elif status == 'featured':
            query = query.filter_by(is_featured=True)
        
        if category:
            query = query.filter_by(category=category)
        
        if search:
            query = query.filter(
                Content.title.contains(search) | Content.author.contains(search)
            )
        
        query = query.order_by(Content.created_at.desc())
        
        contents = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return {
            'success': True,
            'contents': [content.to_dict() for content in contents.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': contents.total,
                'pages': contents.pages,
                'has_next': contents.has_next,
                'has_prev': contents.has_prev
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@admin_bp.route('/contents', methods=['POST'])
@jwt_required()
def create_content():
    """Crée un nouveau contenu"""
    try:
        admin_check = require_admin()
        if admin_check:
            return admin_check
        
        data = request.get_json()
        if not data:
            return {'error': 'Données JSON requises'}, 400
        
        required_fields = ['title', 'category']
        for field in required_fields:
            if not data.get(field):
                return {'error': f'Champ requis: {field}'}, 400
        
        content = Content(
            title=data['title'],
            category=data['category'],
            excerpt=data.get('excerpt'),
            content=data.get('content'),
            author=data.get('author'),
            tags=data.get('tags', []),
            image_url=data.get('image_url'),
            external_url=data.get('external_url'),
            duration=data.get('duration'),
            difficulty_level=data.get('difficulty_level'),
            is_featured=data.get('is_featured', False)
        )
        
        if 'is_published' in data:
            content.is_published = bool(data['is_published'])
        
        db.session.add(content)
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Contenu créé',
            'content': content.to_dict(include_content=True)
        }, 201
        
    except Exception as e:
        db.session.rollback()
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@admin_bp.route('/contents/<int:content_id>', methods=['PUT'])
@jwt_required()
def update_content(content_id):
    """Met à jour un contenu"""
    try:
        admin_check = require_admin()
        if admin_check:
            return admin_check
        
        content = Content.query.get(content_id)
        if not content:
            return {'error': 'Contenu non trouvé'}, 404
        
        data = request.get_json()
        if not data:
            return {'error': 'Données JSON requises'}, 400
        
        # Mise à jour des champs
        updatable_fields = [
            'title', 'excerpt', 'content', 'author', 'category',
            'image_url', 'external_url', 'duration', 'difficulty_level',
            'is_published', 'is_featured'
        ]
        
        for field in updatable_fields:
            if field in data:
                if field == 'tags':
                    content.set_tags(data[field])
                else:
                    setattr(content, field, data[field])
        
        content.updated_at = datetime.utcnow()
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Contenu mis à jour',
            'content': content.to_dict(include_content=True)
        }, 200
        
    except Exception as e:
        db.session.rollback()
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@admin_bp.route('/contents/<int:content_id>', methods=['DELETE'])
@jwt_required()
def delete_content(content_id):
    """Supprime un contenu"""
    try:
        admin_check = require_admin()
        if admin_check:
            return admin_check
        
        content = Content.query.get(content_id)
        if not content:
            return {'error': 'Contenu non trouvé'}, 404
        
        # Supprimer les interactions associées
        Interaction.query.filter_by(content_id=content_id).delete()
        
        # Supprimer le contenu
        db.session.delete(content)
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Contenu supprimé'
        }, 200
        
    except Exception as e:
        db.session.rollback()
        return {'error': f'Erreur serveur: {str(e)}'}, 500

@admin_bp.route('/interactions', methods=['GET'])
@jwt_required()
def get_admin_interactions():
    """Récupère les interactions récentes pour l'administration"""
    try:
        admin_check = require_admin()
        if admin_check:
            return admin_check
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        interaction_type = request.args.get('type')
        
        per_page = min(per_page, 200)
        
        query = Interaction.query
        
        if interaction_type:
            query = query.filter_by(interaction_type=interaction_type)
        
        query = query.order_by(Interaction.created_at.desc())
        
        interactions = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Enrichir avec les informations utilisateur et contenu
        enriched_interactions = []
        for interaction in interactions.items:
            interaction_data = interaction.to_dict()
            
            # Ajouter les infos utilisateur (sans données sensibles)
            user = User.query.get(interaction.user_id)
            if user:
                interaction_data['user'] = {
                    'id': user.id,
                    'name': user.name,
                    'is_admin': user.is_admin
                }
            
            # Ajouter les infos contenu
            content = Content.query.get(interaction.content_id)
            if content:
                interaction_data['content'] = {
                    'id': content.id,
                    'title': content.title,
                    'category': content.category
                }
            
            enriched_interactions.append(interaction_data)
        
        return {
            'success': True,
            'interactions': enriched_interactions,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': interactions.total,
                'pages': interactions.pages,
                'has_next': interactions.has_next,
                'has_prev': interactions.has_prev
            }
        }, 200
        
    except Exception as e:
        return {'error': f'Erreur serveur: {str(e)}'}, 500 