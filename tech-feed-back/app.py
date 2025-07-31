import os
from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate
from config import config
from database import db
from kafka_producer import init_kafka_producer

# Initialisation des extensions
jwt = JWTManager()
migrate = Migrate()

def create_app(config_name=None):
    """Factory pour créer l'application Flask"""
    app = Flask(__name__)
    
    # Configuration
    config_name = config_name or os.environ.get('FLASK_CONFIG') or 'default'
    app.config.from_object(config[config_name])
    
    # Initialisation des extensions
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    
    # Configuration CORS
    CORS(app, origins=app.config['CORS_ORIGINS'])
    
    # Initialisation du producteur Kafka
    init_kafka_producer(app)
    
    # Import des modèles (ils utilisent maintenant la même instance db)
    from models.user import User
    from models.content import Content
    from models.interaction import Interaction
    
    # Import et enregistrement des blueprints
    from routes.auth import auth_bp
    from routes.content import content_bp
    from routes.interaction import interaction_bp
    from routes.recommendation import recommendation_bp
    from routes.admin import admin_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(content_bp, url_prefix='/api/content')
    app.register_blueprint(interaction_bp, url_prefix='/api/interaction')
    app.register_blueprint(recommendation_bp, url_prefix='/api/recommendation')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    
    # Route de base pour vérifier que l'API fonctionne
    @app.route('/api/health')
    def health_check():
        return {
            'status': 'ok',
            'message': 'TechFeed API is running',
            'version': '1.0.0'
        }
    
    # Gestionnaire d'erreur JWT
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {'message': 'Token has expired'}, 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return {'message': 'Invalid token'}, 401
    
    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return {'message': 'Token is required'}, 401
    
    # Création des tables si elles n'existent pas
    with app.app_context():
        db.create_all()
        
        # Création des données initiales si nécessaire
        create_initial_data()
    
    return app

def create_initial_data():
    """Crée les données initiales pour le développement"""
    from models.user import User
    from models.content import Content
    from models.interaction import Interaction
    
    # Créer un utilisateur admin si il n'existe pas
    admin_email = 'admin@example.com'
    if not User.query.filter_by(email=admin_email).first():
        try:
            admin = User.create_user(
                email=admin_email,
                password='admin',
                name='Administrateur',
                preferences=['IA', 'DevOps', 'Cyber'],
                is_admin=True
            )
            print(f"Utilisateur admin créé: {admin.email}")
        except Exception as e:
            print(f"Erreur lors de la création de l'admin: {e}")
    
    # Créer un utilisateur demo si il n'existe pas
    demo_email = 'user@example.com'
    if not User.query.filter_by(email=demo_email).first():
        try:
            user = User.create_user(
                email=demo_email,
                password='password',
                name='Utilisateur Demo',
                preferences=['IA', 'Mobile', 'Frontend']
            )
            print(f"Utilisateur demo créé: {user.email}")
        except Exception as e:
            print(f"Erreur lors de la création de l'utilisateur demo: {e}")
    
    # Créer du contenu de base si il n'y en a pas
    if Content.query.count() == 0:
        sample_contents = [
            {
                'title': "L'avenir de l'Intelligence Artificielle en 2024",
                'excerpt': "Découvrez les dernières avancées en IA et leur impact sur notre quotidien. De GPT-4 aux modèles multimodaux, explorez les innovations qui façonnent notre futur.",
                'author': 'Marie Dubois',
                'category': 'IA',
                'tags': ['machine-learning', 'gpt', 'deep-learning'],
                'duration': 8,
                'difficulty_level': 'intermediate',
                'is_featured': True,
                'content': """
                    <h2>Introduction</h2>
                    <p>L'intelligence artificielle continue de révolutionner notre monde à un rythme effréné. En 2024, nous assistons à des avancées majeures qui transforment la façon dont nous travaillons, créons et interagissons.</p>
                    
                    <h2>Les grandes tendances</h2>
                    <p>Cette année marque un tournant avec l'émergence de modèles multimodaux capables de traiter simultanément texte, image et audio. Ces innovations ouvrent de nouvelles perspectives dans de nombreux domaines.</p>
                    
                    <h2>Impact sur les entreprises</h2>
                    <p>Les entreprises adoptent massivement ces technologies pour automatiser leurs processus et améliorer leur productivité. L'IA devient un avantage concurrentiel majeur.</p>
                """
            },
            {
                'title': "DevOps : Les meilleures pratiques pour 2024",
                'excerpt': "Guide complet des pratiques DevOps modernes. Kubernetes, CI/CD, monitoring et sécurité : tout ce qu'il faut savoir pour optimiser vos déploiements.",
                'author': 'Thomas Martin',
                'category': 'DevOps',
                'tags': ['kubernetes', 'ci-cd', 'docker', 'monitoring'],
                'duration': 12,
                'difficulty_level': 'advanced',
                'content': """
                    <h2>L'évolution du DevOps</h2>
                    <p>Le DevOps continue d'évoluer avec de nouveaux outils et méthodologies qui simplifient le développement et le déploiement d'applications.</p>
                    
                    <h2>Kubernetes et orchestration</h2>
                    <p>Kubernetes s'impose comme la solution de référence pour l'orchestration de conteneurs, offrant scalabilité et résilience.</p>
                """
            },
            {
                'title': "Cybersécurité : Nouvelles menaces et défenses",
                'excerpt': "Analyse des cybermenaces émergentes et des stratégies de protection. Zero Trust, authentification multi-facteurs et détection comportementale.",
                'author': 'Sophie Laurent',
                'category': 'Cyber',
                'tags': ['security', 'zero-trust', 'mfa', 'threats'],
                'duration': 10,
                'difficulty_level': 'intermediate',
                'is_featured': True,
                'content': """
                    <h2>Le paysage des menaces</h2>
                    <p>Les cyberattaques deviennent de plus en plus sophistiquées, nécessitant des approches de sécurité innovantes.</p>
                    
                    <h2>Architecture Zero Trust</h2>
                    <p>L'approche Zero Trust révolutionne la sécurité en ne faisant confiance à aucun utilisateur ou appareil par défaut.</p>
                """
            },
            {
                'title': "Développement Mobile : React Native vs Flutter",
                'excerpt': "Comparaison détaillée des frameworks de développement mobile cross-platform. Performance, écosystème et facilité d'apprentissage.",
                'author': 'Alex Chen',
                'category': 'Mobile',
                'tags': ['react-native', 'flutter', 'mobile-dev', 'cross-platform'],
                'duration': 15,
                'difficulty_level': 'beginner',
                'content': """
                    <h2>React Native</h2>
                    <p>React Native offre une approche familière pour les développeurs JavaScript avec un écosystème riche.</p>
                    
                    <h2>Flutter</h2>
                    <p>Flutter de Google propose des performances natives avec un seul codebase pour iOS et Android.</p>
                """
            },
            {
                'title': "Frontend moderne : Next.js et l'écosystème React",
                'excerpt': "Exploration des dernières tendances du développement frontend avec Next.js, TypeScript et les outils modernes.",
                'author': 'Emma Rodriguez',
                'category': 'Frontend',
                'tags': ['nextjs', 'react', 'typescript', 'ssr'],
                'duration': 7,
                'difficulty_level': 'intermediate',
                'content': """
                    <h2>Next.js et le Server-Side Rendering</h2>
                    <p>Next.js révolutionne le développement React avec ses fonctionnalités avancées de rendu côté serveur.</p>
                    
                    <h2>TypeScript pour la robustesse</h2>
                    <p>TypeScript apporte la sécurité des types au JavaScript, réduisant les erreurs et améliorant la maintenabilité.</p>
                """
            }
        ]
        
        for content_data in sample_contents:
            try:
                content = Content(**content_data)
                db.session.add(content)
                print(f"Contenu créé: {content.title}")
            except Exception as e:
                print(f"Erreur lors de la création du contenu: {e}")
        
        db.session.commit()

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5001) 