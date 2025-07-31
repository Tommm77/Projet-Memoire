#!/usr/bin/env python3
"""
Script d'initialisation de la base de données TechFeed
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from app import create_app
from database import db
from models.user import User
from models.content import Content
from models.interaction import Interaction
from werkzeug.security import generate_password_hash
from datetime import datetime
import json

def create_database():
    """Créer la base de données techfeed si elle n'existe pas"""
    try:
        # Connexion à PostgreSQL (base postgres par défaut)
        conn = psycopg2.connect(
            host='localhost',
            port='5433',
            user='tompicout',
            database='postgres'
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        cursor = conn.cursor()
        
        # Vérifier si la base de données existe
        cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'techfeed'")
        exists = cursor.fetchone()
        
        if not exists:
            cursor.execute('CREATE DATABASE techfeed')
            print("✅ Base de données 'techfeed' créée avec succès")
        else:
            print("ℹ️  Base de données 'techfeed' existe déjà")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur lors de la création de la base de données: {e}")
        return False
    
    return True

def init_tables_and_data():
    """Initialiser les tables et les données de base"""
    app = create_app()
    
    with app.app_context():
        try:
            # Créer toutes les tables
            db.create_all()
            print("✅ Tables créées avec succès")
            
            # Vérifier si des utilisateurs existent déjà
            if User.query.count() == 0:
                # Créer les utilisateurs de test
                admin_user = User(
                    email='admin@example.com',
                    name='Admin User',
                    password_hash=generate_password_hash('admin'),
                    role='admin',
                    preferences=json.dumps({
                        'categories': ['ai', 'devops', 'cybersecurity', 'mobile', 'frontend'],
                        'notifications': True,
                        'theme': 'light'
                    }),
                    avatar='https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
                )
                
                regular_user = User(
                    email='user@example.com',
                    name='John Doe',
                    password_hash=generate_password_hash('password'),
                    preferences=json.dumps({
                        'categories': ['ai', 'frontend'],
                        'notifications': True,
                        'theme': 'light'
                    }),
                    avatar='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
                )
                
                db.session.add(admin_user)
                db.session.add(regular_user)
                
                print("✅ Utilisateurs de test créés")
            
            # Vérifier si du contenu existe déjà
            if Content.query.count() == 0:
                # Créer du contenu de démonstration
                contents = [
                    {
                        'title': 'L\'avenir de l\'Intelligence Artificielle en 2024',
                        'excerpt': 'Découvrez les tendances et innovations qui marqueront l\'IA cette année.',
                        'content': 'L\'intelligence artificielle continue d\'évoluer à un rythme effréné...',
                        'author': 'Dr. Marie Dubois',
                        'category': 'ai',
                        'tags': ['ia', 'machine-learning', 'innovation', 'futur'],
                        'featured': true,
                        'views': 1250,
                        'likes': 89,
                        'shares': 23
                    },
                    {
                        'title': 'DevOps et Kubernetes : Guide complet 2024',
                        'excerpt': 'Maîtrisez l\'orchestration de conteneurs avec Kubernetes.',
                        'content': 'Kubernetes est devenu l\'standard de l\'industrie pour l\'orchestration...',
                        'author': 'Thomas Martin',
                        'category': 'devops',
                        'tags': ['kubernetes', 'docker', 'devops', 'cloud'],
                        'featured': false,
                        'views': 892,
                        'likes': 67,
                        'shares': 15
                    },
                    {
                        'title': 'Cybersécurité : Les menaces émergentes',
                        'excerpt': 'Comment protéger votre infrastructure contre les nouvelles menaces.',
                        'content': 'La cybersécurité fait face à de nouveaux défis chaque jour...',
                        'author': 'Sophie Chen',
                        'category': 'cybersecurity',
                        'tags': ['sécurité', 'hacking', 'protection', 'enterprise'],
                        'featured': true,
                        'views': 1456,
                        'likes': 134,
                        'shares': 42
                    },
                    {
                        'title': 'React Native vs Flutter : Comparaison 2024',
                        'excerpt': 'Quel framework choisir pour vos applications mobiles ?',
                        'content': 'Le développement mobile cross-platform offre de nombreuses options...',
                        'author': 'Alex Rodriguez',
                        'category': 'mobile',
                        'tags': ['react-native', 'flutter', 'mobile', 'cross-platform'],
                        'featured': false,
                        'views': 743,
                        'likes': 56,
                        'shares': 12
                    },
                    {
                        'title': 'CSS Grid et Flexbox : Techniques avancées',
                        'excerpt': 'Maîtrisez les layouts modernes avec CSS Grid et Flexbox.',
                        'content': 'Les techniques de layout CSS ont révolutionné le développement web...',
                        'author': 'Emma Laurent',
                        'category': 'frontend',
                        'tags': ['css', 'layout', 'grid', 'flexbox', 'responsive'],
                        'featured': false,
                        'views': 634,
                        'likes': 45,
                        'shares': 8
                    }
                ]
                
                for content_data in contents:
                    content = Content(
                        title=content_data['title'],
                        excerpt=content_data['excerpt'],
                        content=content_data['content'],
                        author=content_data['author'],
                        category=content_data['category'],
                        tags=json.dumps(content_data['tags']),
                        metadata=json.dumps({
                            'reading_time': '5 min',
                            'difficulty': 'intermediate',
                            'source': 'TechFeed Editorial'
                        }),
                        featured=content_data['featured'],
                        views=content_data['views'],
                        likes=content_data['likes'],
                        shares=content_data['shares']
                    )
                    db.session.add(content)
                
                print("✅ Contenu de démonstration créé")
            
            # Sauvegarder les changements
            db.session.commit()
            print("✅ Données sauvegardées avec succès")
            
        except Exception as e:
            print(f"❌ Erreur lors de l'initialisation: {e}")
            db.session.rollback()
            return False
    
    return True

if __name__ == '__main__':
    print("🚀 Initialisation de la base de données TechFeed...")
    
    # Étape 1: Créer la base de données
    if create_database():
        # Étape 2: Créer les tables et données
        if init_tables_and_data():
            print("🎉 Initialisation terminée avec succès!")
            print("\n📋 Comptes de test créés:")
            print("   Admin: admin@example.com / admin")
            print("   User:  user@example.com / password")
        else:
            print("❌ Échec de l'initialisation des tables et données")
    else:
        print("❌ Échec de la création de la base de données") 