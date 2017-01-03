#!/usr/bin/env python

"""
Commands that update or process the application data.
"""
import app_config

from fabric.api import task
from pymongo import MongoClient


@task(default=True)
def update():
    """
    Stub function for updating app-specific data.
    """
    pass


@task
def bootstrap_db():
    """
    Create mongodb
    """
    client = MongoClient(app_config.MONGODB_URL)
    database = client['liveblog']

    database.images.drop()
    database.images.create_index('date', expireAfterSeconds=app_config.DB_IMAGE_TTL)

    database.tweets.drop()
    database.tweets.create_index('date', expireAfterSeconds=app_config.DB_TWEET_TTL)

    database.timestamps.drop()

    database.pinned.drop()
