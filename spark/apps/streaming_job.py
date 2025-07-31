#!/usr/bin/env python3
"""
TechFeed Kafka Spark Streaming Job
Traite les événements en temps réel depuis Kafka et les stocke dans HDFS
"""

import sys
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *
from datetime import datetime
import json

# Configuration Kafka
KAFKA_BOOTSTRAP_SERVERS = "kafka:29092"
KAFKA_TOPICS = [
    "user-interactions",
    "content-views", 
    "content-reactions",
    "new-content",
    "user-events",
    "search-events",
    "analytics-metrics"
]

# Configuration HDFS
HDFS_BASE_PATH = "hdfs://namenode:8020/techfeed-data"

def create_spark_session():
    """Créer la session Spark avec les configurations nécessaires"""
    return SparkSession.builder \
        .appName("TechFeed-Kafka-Streaming") \
        .config("spark.sql.adaptive.enabled", "true") \
        .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
        .config("spark.sql.streaming.checkpointLocation", f"{HDFS_BASE_PATH}/checkpoints") \
        .config("spark.hadoop.fs.defaultFS", "hdfs://namenode:8020") \
        .getOrCreate()

def create_kafka_stream(spark, topics):
    """Créer le stream Kafka"""
    return spark \
        .readStream \
        .format("kafka") \
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP_SERVERS) \
        .option("subscribe", ",".join(topics)) \
        .option("startingOffsets", "latest") \
        .option("failOnDataLoss", "false") \
        .load()

def parse_kafka_message(df):
    """Parser les messages Kafka et extraire les données JSON"""
    # Schema pour les différents types d'événements
    interaction_schema = StructType([
        StructField("user_id", IntegerType(), True),
        StructField("content_id", IntegerType(), True),
        StructField("interaction_type", StringType(), True),
        StructField("timestamp", TimestampType(), True),
        StructField("duration", IntegerType(), True),
        StructField("rating", IntegerType(), True),
        StructField("session_id", StringType(), True)
    ])
    
    content_schema = StructType([
        StructField("content_id", IntegerType(), True),
        StructField("title", StringType(), True),
        StructField("category", StringType(), True),
        StructField("author", StringType(), True),
        StructField("tags", ArrayType(StringType()), True),
        StructField("created_at", TimestampType(), True),
        StructField("difficulty_level", StringType(), True)
    ])
    
    user_schema = StructType([
        StructField("user_id", IntegerType(), True),
        StructField("event_type", StringType(), True),
        StructField("email", StringType(), True),
        StructField("name", StringType(), True),
        StructField("preferences", ArrayType(StringType()), True),
        StructField("timestamp", TimestampType(), True)
    ])
    
    search_schema = StructType([
        StructField("user_id", IntegerType(), True),
        StructField("query", StringType(), True),
        StructField("category", StringType(), True),
        StructField("results_count", IntegerType(), True),
        StructField("timestamp", TimestampType(), True)
    ])
    
    # Extraire les données JSON du message Kafka
    parsed_df = df.select(
        col("topic"),
        col("partition"),
        col("offset"),
        col("timestamp").alias("kafka_timestamp"),
        from_json(col("value").cast("string"), interaction_schema).alias("interaction_data"),
        from_json(col("value").cast("string"), content_schema).alias("content_data"),
        from_json(col("value").cast("string"), user_schema).alias("user_data"),
        from_json(col("value").cast("string"), search_schema).alias("search_data")
    )
    
    return parsed_df

def process_user_interactions(df):
    """Traiter les interactions utilisateur"""
    interactions = df.filter(col("topic") == "user-interactions") \
        .select(
            col("interaction_data.*"),
            col("kafka_timestamp"),
            year(col("interaction_data.timestamp")).alias("year"),
            month(col("interaction_data.timestamp")).alias("month"),
            dayofmonth(col("interaction_data.timestamp")).alias("day")
        )
    
    return interactions

def process_content_views(df):
    """Traiter les vues de contenu"""
    views = df.filter(col("topic") == "content-views") \
        .select(
            col("interaction_data.*"),
            col("kafka_timestamp"),
            year(col("interaction_data.timestamp")).alias("year"),
            month(col("interaction_data.timestamp")).alias("month"),
            dayofmonth(col("interaction_data.timestamp")).alias("day")
        )
    
    return views

def process_content_reactions(df):
    """Traiter les réactions (likes/dislikes)"""
    reactions = df.filter(col("topic") == "content-reactions") \
        .select(
            col("interaction_data.*"),
            col("kafka_timestamp"),
            year(col("interaction_data.timestamp")).alias("year"),
            month(col("interaction_data.timestamp")).alias("month"),
            dayofmonth(col("interaction_data.timestamp")).alias("day")
        )
    
    return reactions

def process_new_content(df):
    """Traiter les nouveaux contenus"""
    content = df.filter(col("topic") == "new-content") \
        .select(
            col("content_data.*"),
            col("kafka_timestamp"),
            year(col("content_data.created_at")).alias("year"),
            month(col("content_data.created_at")).alias("month"),
            dayofmonth(col("content_data.created_at")).alias("day")
        )
    
    return content

def process_user_events(df):
    """Traiter les événements utilisateur (signup, login, etc.)"""
    users = df.filter(col("topic") == "user-events") \
        .select(
            col("user_data.*"),
            col("kafka_timestamp"),
            year(col("user_data.timestamp")).alias("year"),
            month(col("user_data.timestamp")).alias("month"),
            dayofmonth(col("user_data.timestamp")).alias("day")
        )
    
    return users

def process_search_events(df):
    """Traiter les événements de recherche"""
    searches = df.filter(col("topic") == "search-events") \
        .select(
            col("search_data.*"),
            col("kafka_timestamp"),
            year(col("search_data.timestamp")).alias("year"),
            month(col("search_data.timestamp")).alias("month"),
            dayofmonth(col("search_data.timestamp")).alias("day")
        )
    
    return searches

def write_to_hdfs(df, path, output_mode="append", trigger_interval="30 seconds"):
    """Écrire les données dans HDFS avec partitioning"""
    return df.writeStream \
        .format("parquet") \
        .option("path", path) \
        .option("checkpointLocation", f"{path}/_checkpoints") \
        .outputMode(output_mode) \
        .trigger(processingTime=trigger_interval) \
        .partitionBy("year", "month", "day")

def calculate_real_time_metrics(df):
    """Calculer des métriques en temps réel"""
    # Métriques par fenêtre de temps
    windowed_metrics = df.filter(col("topic").isin(["user-interactions", "content-views", "content-reactions"])) \
        .withWatermark("kafka_timestamp", "10 minutes") \
        .groupBy(
            window(col("kafka_timestamp"), "5 minutes"),
            col("topic")
        ) \
        .agg(
            count("*").alias("event_count"),
            countDistinct("interaction_data.user_id").alias("unique_users"),
            countDistinct("interaction_data.content_id").alias("unique_content")
        )
    
    return windowed_metrics

def main():
    """Fonction principale"""
    print("🚀 Démarrage du job Spark Streaming TechFeed...")
    
    # Créer la session Spark
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")
    
    try:
        # Créer le stream Kafka
        print("📡 Connexion à Kafka...")
        kafka_stream = create_kafka_stream(spark, KAFKA_TOPICS)
        
        # Parser les messages
        print("🔍 Configuration du parsing des messages...")
        parsed_stream = parse_kafka_message(kafka_stream)
        
        # Créer les différents streams de traitement
        print("⚡ Configuration des streams de traitement...")
        
        # Stream des interactions utilisateur
        interactions_stream = process_user_interactions(parsed_stream)
        interactions_query = write_to_hdfs(
            interactions_stream, 
            f"{HDFS_BASE_PATH}/user-interactions"
        ).start()
        
        # Stream des vues de contenu
        views_stream = process_content_views(parsed_stream)
        views_query = write_to_hdfs(
            views_stream,
            f"{HDFS_BASE_PATH}/content-views"
        ).start()
        
        # Stream des réactions
        reactions_stream = process_content_reactions(parsed_stream)
        reactions_query = write_to_hdfs(
            reactions_stream,
            f"{HDFS_BASE_PATH}/content-reactions"
        ).start()
        
        # Stream des nouveaux contenus
        content_stream = process_new_content(parsed_stream)
        content_query = write_to_hdfs(
            content_stream,
            f"{HDFS_BASE_PATH}/new-content"
        ).start()
        
        # Stream des événements utilisateur
        users_stream = process_user_events(parsed_stream)
        users_query = write_to_hdfs(
            users_stream,
            f"{HDFS_BASE_PATH}/user-events"
        ).start()
        
        # Stream des recherches
        searches_stream = process_search_events(parsed_stream)
        searches_query = write_to_hdfs(
            searches_stream,
            f"{HDFS_BASE_PATH}/search-events"
        ).start()
        
        # Stream des métriques temps réel
        metrics_stream = calculate_real_time_metrics(parsed_stream)
        metrics_query = write_to_hdfs(
            metrics_stream,
            f"{HDFS_BASE_PATH}/real-time-metrics",
            output_mode="complete",
            trigger_interval="1 minute"
        ).start()
        
        print("✅ Tous les streams sont démarrés!")
        print("📊 Monitoring des streams...")
        print(f"🔗 Kafka Topics: {', '.join(KAFKA_TOPICS)}")
        print(f"💾 HDFS Base Path: {HDFS_BASE_PATH}")
        
        # Attendre que tous les streams se terminent
        queries = [
            interactions_query, views_query, reactions_query, 
            content_query, users_query, searches_query, metrics_query
        ]
        
        for query in queries:
            query.awaitTermination()
            
    except Exception as e:
        print(f"❌ Erreur dans le job Spark Streaming: {str(e)}")
        raise e
    finally:
        print("🛑 Arrêt du job Spark Streaming...")
        spark.stop()

if __name__ == "__main__":
    main() 