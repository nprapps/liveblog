#!/usr/bin/env python
# _*_ coding:utf-8 _*_

"""
Project-wide application configuration.

DO NOT STORE SECRETS, PASSWORDS, ETC. IN THIS FILE.
They will be exposed to users. Use environment variables instead.
See get_secrets() below for a fast way to access them.
"""

import logging
import os

from authomatic.providers import oauth2
from authomatic import Authomatic


"""
NAMES
"""
# Project name to be used in urls
# Use dashes, not underscores!
PROJECT_SLUG = 'liveblog'

# Project name to be used in file paths
PROJECT_FILENAME = 'liveblog'

# The name of the repository containing the source
REPOSITORY_NAME = 'liveblog'
GITHUB_USERNAME = 'nprapps'
REPOSITORY_URL = 'git@github.com:%s/%s.git' % (
    GITHUB_USERNAME, REPOSITORY_NAME)
REPOSITORY_ALT_URL = None  # 'git@bitbucket.org:nprapps/%s.git' % REPOSITORY_NAME'

# Project name used for assets rig
# Should stay the same, even if PROJECT_SLUG changes
ASSETS_SLUG = 'liveblog'


# DEPLOY SETUP CONFIG
LIVEBLOG_DIRECTORY_PREFIX = 'liveblogs/'
CURRENT_LIVEBLOG = '20170214-liveblog-https'
IMAGE_URL = 'https://media.npr.org/politics/inauguration2017'

try:
    from local_settings import CURRENT_LIVEBLOG
except ImportError:
    pass

"""
DEPLOYMENT
"""
PRODUCTION_S3_BUCKET = 'apps.npr.org'

STAGING_S3_BUCKET = 'stage-apps.npr.org'

ASSETS_S3_BUCKET = 'assets.apps.npr.org'

ARCHIVE_S3_BUCKET = 'liveblog-backup.apps.npr.org'

DEFAULT_MAX_AGE = 20

RELOAD_TRIGGER = False
RELOAD_CHECK_INTERVAL = 60

PRODUCTION_SERVERS = ['52.87.229.146']
STAGING_SERVERS = ['52.90.129.68']

# Should code be deployed to the web/cron servers?
DEPLOY_TO_SERVERS = True
try:
    # Override whether we should deploy to a cutom webserver
    from local_settings import DEPLOY_TO_SERVERS
except ImportError:
    pass

DEPLOY_STATIC_LIVEBLOG = False
try:
    # Override whether we are going to deploy a static liveblog
    # from our local environment. Useful for non-live liveblogs
    from local_settings import DEPLOY_STATIC_LIVEBLOG
except ImportError:
    pass

SERVER_USER = 'ubuntu'
SERVER_PYTHON = 'python2.7'
SERVER_PROJECT_PATH = '/home/%s/apps/%s' % (SERVER_USER, PROJECT_FILENAME)
SERVER_REPOSITORY_PATH = '%s/repository' % SERVER_PROJECT_PATH
SERVER_VIRTUALENV_PATH = '%s/virtualenv' % SERVER_PROJECT_PATH

# Should the crontab file be installed on the servers?
# If True, DEPLOY_TO_SERVERS must also be True
DEPLOY_CRONTAB = False

# Should the service configurations be installed on the servers?
# If True, DEPLOY_TO_SERVERS must also be True
DEPLOY_SERVICES = False

UWSGI_SOCKET_PATH = '/tmp/%s.uwsgi.sock' % PROJECT_FILENAME

# Services are the server-side services we want to enable and configure.
# A three-tuple following this format:
# (service name, service deployment path, service config file extension)
SERVER_SERVICES = [
    ('deploy', '/etc/init', 'conf'),
]

# These variables will be set at runtime. See configure_targets() below
S3_BUCKET = None
S3_BASE_URL = None
S3_DEPLOY_URL = None
SERVERS = []
SERVER_BASE_URL = None
SERVER_LOG_PATH = None
DEBUG = True
LOG_LEVEL = None

"""
TEST AUTOINIT LOADER
"""
AUTOINIT_LOADER = False

"""
COPY EDITING
"""
COPY_GOOGLE_DOC_KEY = '15TeNmLlwro_wfLTQmXDLhGigPhi4DIvpa7RsaKKUzwY'
COPY_PATH = 'data/copy.xlsx'

"""
AUTHORS DICTIONARY
"""
AUTHORS_GOOGLE_DOC_KEY = '1s0Vs4c41kp8mCvGnIFbdPK9YI9t18u0c2kvh6W1eZBw'
AUTHORS_PATH = 'data/authors.xlsx'
# Number of cycles needed to refresh the author excel file
REFRESH_AUTHOR_CYCLES = 6

LIVEBLOG_HTML_PATH = 'data/liveblog.html'
LIVEBLOG_BACKUP_PATH = 'data/liveblog_backup.pickle'
LOAD_COPY_INTERVAL = 10
SPONSORSHIP_POSITION = -1  # -1 disables
NUM_HEADLINE_POSTS = 3

"""
GOOGLE APPS SCRIPTS
"""

GAS_LOG_KEY = '1oE9V5APDi5zzFRm-1pm63BGJ6dUjeedz1qw6pECRRlQ' # Google app script logs spreadsheet key
LIVEBLOG_GDOC_KEY = '1_IipOtr6uuoFLYzP8MhvIUC8yobUY-sk6ZVN6QYgU44' # Google doc key
SCRIPT_PROJECT_NAME = 'liveblog' # Google app scripts project name
SEAMUS_ID = '509703637'


"""
SHARING
"""
SHARE_URL = 'http://%s/%s%s/' % (PRODUCTION_S3_BUCKET,
                                 LIVEBLOG_DIRECTORY_PREFIX,
                                 CURRENT_LIVEBLOG)


"""
SERVICES
"""
NPR_GOOGLE_ANALYTICS = {
    'ACCOUNT_ID': 'UA-5828686-4',
    'DOMAIN': PRODUCTION_S3_BUCKET,
    'TOPICS': ''  # e.g. '[1014,3,1003,1002,1001]'
}

VIZ_GOOGLE_ANALYTICS = {
    'ACCOUNT_ID': 'UA-5828686-75'
}

"""
MONGODB
"""
MONGODB_URL = 'mongodb://localhost:27017/'
DB_IMAGE_TTL = 60 * 5
DB_TWEET_TTL = 60 * 2

"""
OAUTH
"""

GOOGLE_OAUTH_CREDENTIALS_PATH = '~/.google_oauth_credentials'

authomatic_config = {
    'google': {
        'id': 1,
        'class_': oauth2.Google,
        'consumer_key': os.environ.get('GOOGLE_OAUTH_CLIENT_ID'),
        'consumer_secret': os.environ.get('GOOGLE_OAUTH_CONSUMER_SECRET'),
        'scope': ['https://www.googleapis.com/auth/drive',
                  'https://www.googleapis.com/auth/userinfo.email',
                  'https://www.googleapis.com/auth/drive.scripts',
                  'https://www.googleapis.com/auth/documents',
                  'https://www.googleapis.com/auth/script.external_request',
                  'https://www.googleapis.com/auth/script.scriptapp',
                  'https://www.googleapis.com/auth/script.send_mail',
                  'https://www.googleapis.com/auth/script.storage',
                  'https://www.googleapis.com/auth/spreadsheets'],
        'offline': True,
    },
}

authomatic = Authomatic(authomatic_config, os.environ.get('AUTHOMATIC_SALT'))

"""
Logging
"""
LOG_FORMAT = '%(levelname)s:%(name)s:%(asctime)s: %(message)s'

"""
Utilities
"""


def get_secrets():
    """
    A method for accessing our secrets.
    """
    secrets_dict = {}

    for k, v in os.environ.items():
        if k.startswith(PROJECT_SLUG):
            k = k[len(PROJECT_SLUG) + 1:]
            secrets_dict[k] = v

    return secrets_dict


def configure_targets(deployment_target):
    """
    Configure deployment targets. Abstracted so this can be
    overriden for rendering before deployment.
    """
    global S3_BUCKET
    global S3_BASE_URL
    global S3_DEPLOY_URL
    global SERVERS
    global SERVER_BASE_URL
    global SERVER_LOG_PATH
    global DEBUG
    global DEPLOYMENT_TARGET
    global LOG_LEVEL
    global ASSETS_MAX_AGE
    global LIVEBLOG_GDOC_KEY
    global SEAMUS_ID
    global BOP_EMBED_URL

    if deployment_target == 'production':
        S3_BUCKET = PRODUCTION_S3_BUCKET
        S3_BASE_URL = 'https://%s/%s%s' % (S3_BUCKET,
                                           LIVEBLOG_DIRECTORY_PREFIX,
                                           CURRENT_LIVEBLOG)
        S3_DEPLOY_URL = 's3://%s/%s%s' % (S3_BUCKET,
                                          LIVEBLOG_DIRECTORY_PREFIX,
                                          CURRENT_LIVEBLOG)
        SERVERS = PRODUCTION_SERVERS
        SERVER_BASE_URL = 'https://%s/%s' % (SERVERS[0], PROJECT_SLUG)
        SERVER_LOG_PATH = '/var/log/%s' % PROJECT_FILENAME
        LOG_LEVEL = logging.INFO
        DEBUG = False
        ASSETS_MAX_AGE = 86400
        LIVEBLOG_GDOC_KEY = '1BHeJSGbEfdVs2pCrMtXZ0dQrgnVKKag8z1QQhLakPx4'
    elif deployment_target == 'staging':
        S3_BUCKET = STAGING_S3_BUCKET
        S3_BASE_URL = 'https://s3.amazonaws.com/%s/%s%s' % (
            S3_BUCKET,
            LIVEBLOG_DIRECTORY_PREFIX,
            CURRENT_LIVEBLOG)
        S3_DEPLOY_URL = 's3://%s/%s%s' % (S3_BUCKET,
                                          LIVEBLOG_DIRECTORY_PREFIX,
                                          CURRENT_LIVEBLOG)
        SERVERS = STAGING_SERVERS
        SERVER_BASE_URL = 'https://%s/%s' % (SERVERS[0], PROJECT_SLUG)
        SERVER_LOG_PATH = '/var/log/%s' % PROJECT_FILENAME
        LOG_LEVEL = logging.INFO
        DEBUG = True
        ASSETS_MAX_AGE = 20
        # Staging google_apps_scripts > staging > liveblog
        LIVEBLOG_GDOC_KEY = '11MMvFa7rVxm-qGcMZBGLWyGOjBzP2C7bJnc2WfLQ4mM'
    else:
        S3_BUCKET = None
        S3_BASE_URL = 'http://127.0.0.1:8000'
        S3_DEPLOY_URL = None
        SERVERS = []
        SERVER_BASE_URL = 'http://127.0.0.1:8001/%s' % PROJECT_SLUG
        SERVER_LOG_PATH = '/tmp'
        LOG_LEVEL = logging.INFO
        DEBUG = True
        ASSETS_MAX_AGE = 20
        LIVEBLOG_GDOC_KEY = '1_IipOtr6uuoFLYzP8MhvIUC8yobUY-sk6ZVN6QYgU44'
        # Override S3_BASE_URL to use another port locally for fab app
        try:
            from local_settings import S3_BASE_URL
        except ImportError:
            pass
        try:
            from local_settings import LIVEBLOG_GDOC_KEY
        except ImportError:
            pass

    # If we are deploying a non live fact check:
    if DEPLOY_STATIC_LIVEBLOG:
        # Override LIVEBLOG_GDOC_KEY to point ALL environments to google doc
        try:
            from local_settings import LIVEBLOG_GDOC_KEY
        except ImportError:
            pass

    DEPLOYMENT_TARGET = deployment_target


"""
Run automated configuration
"""
DEPLOYMENT_TARGET = os.environ.get('DEPLOYMENT_TARGET', None)

configure_targets(DEPLOYMENT_TARGET)
