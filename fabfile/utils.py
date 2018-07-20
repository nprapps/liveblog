#!/usr/bin/env python

import app_config
import subprocess
import os
import boto
import json
import webbrowser
import logging
import requests

from distutils.util import strtobool
from distutils.spawn import find_executable
from boto.s3.connection import OrdinaryCallingFormat
from fabric.api import local, task, prompt
from oauth import get_credentials
from StringIO import StringIO
from time import sleep
from urlparse import urlparse
from zipfile import ZipFile

logging.basicConfig(format=app_config.LOG_FORMAT)
logger = logging.getLogger(__name__)
logger.setLevel(app_config.LOG_LEVEL)


"""
Utilities used by multiple commands.
"""

FONTELLO_HOST = 'http://fontello.com'


def confirm(message):
    """
    Verify a users intentions.
    """
    answer = prompt(message, default="Not at all")

    if answer.lower() not in ('y', 'yes', 'buzz off', 'screw you'):
        exit()


def get_bucket(bucket_name):
    """
    Established a connection and gets s3 bucket
    """

    if '.' in bucket_name:
        s3 = boto.connect_s3(calling_format=OrdinaryCallingFormat())
    else:
        s3 = boto.connect_s3()

    return s3.get_bucket(bucket_name)


def get_fontello_session_id():
    """
    Use the Fontello configuration file to get a session ID to
    open or download our custom font
    """
    fontello_config_path = os.path.join('fontello', 'config.json')

    with open(fontello_config_path) as fontello_config:
        fontello_session_id = requests.post(
            FONTELLO_HOST,
            files={'config': fontello_config}
        ).content
    return fontello_session_id


@task
def install_font(force=True):
    """
    Install font
    """
    # Replaces `fontello-cli` library, which had a long-standing vulnerability
    CSS_DIR = os.path.join('www', 'css', 'icon')
    FONT_DIR = os.path.join('www', 'css', 'font')

    # Ensure that the directories exist
    for directory_path in (CSS_DIR, FONT_DIR):
        if not os.path.exists(directory_path):
            os.makedirs(directory_path)

    if force or \
            len(os.listdir(CSS_DIR)) == 0 or \
            len(os.listdir(FONT_DIR)) == 0:
        logger.info('Installing font')

        fontello_session_id = get_fontello_session_id()
        zip_url = '{}/{}/get'.format(FONTELLO_HOST, fontello_session_id)
        zip_stream = requests.get(zip_url).content
        zipfile = ZipFile(StringIO(zip_stream))

        for filepath in zipfile.namelist():
            filename = os.path.basename(filepath)

            # Ignore directory pointers, and unnecessary files
            if not filename or not (
                os.path.dirname(filepath).endswith('css') or
                os.path.dirname(filepath).endswith('font')
            ):
                continue

            if os.path.splitext(filepath)[1] == '.css':
                with open(os.path.join(CSS_DIR, filename), 'w') as file:
                    file.write(zipfile.open(filepath).read())
            # Handle the binary and plaintext font files differently
            elif os.path.splitext(filepath)[1] == '.svg':
                with open(os.path.join(FONT_DIR, filename), 'w') as file:
                    file.write(zipfile.open(filepath).read())
            else:
                with open(os.path.join(FONT_DIR, filename), 'wb') as file:
                    file.write(zipfile.open(filepath).read())
    else:
        logger.info('Font already installed; skipping. You may force install if needed.')


def prep_bool_arg(arg):
    return bool(strtobool(str(arg)))


def check_credentials():
    """
    Check credentials and spawn server and browser if not
    """
    credentials = get_credentials()
    if not credentials:
        try:
            with open(os.devnull, 'w') as fnull:
                logger.info('Credentials were not found or permissions were not correct. Automatically opening a browser to authenticate with Google.')
                gunicorn = find_executable('gunicorn')
                process = subprocess.Popen([gunicorn, '-b', '127.0.0.1:8888', 'app:wsgi_app'], stdout=fnull, stderr=fnull)
                webbrowser.open_new('http://127.0.0.1:8888/oauth')
                logger.info('Waiting...')
                while not credentials:
                    try:
                        credentials = get_credentials()
                        sleep(1)
                    except ValueError:
                        continue
                logger.info('Successfully authenticated!')
                process.terminate()
        except KeyboardInterrupt:
            logger.info('\nCtrl-c pressed. Later, skater!')
            exit()
    return credentials


@task
def open_font():
    """
    Open font in Fontello GUI in your browser
    """
    # Based on https://gist.github.com/puzrin/5537065
    # Replaces `fontello-cli` Node library, which had a vulnerability
    fontello_session_id = get_fontello_session_id()
    webbrowser.open('{}/{}'.format(FONTELLO_HOST, fontello_session_id))


@task
def generate_dict():
    """
    generate dict from csv
    """
    local('csvjson -i 4 -k initials data/dict.csv > data/dict.json')


@task
def generate_station_list():
    """
    generate station list json for whitelist
    """
    local('in2csv data/org_homepages.xlsx | csvcut -c 4 > data/org_homepages.csv')
    domains = _parse_stationlist()
    with open('www/js/station_domains.json', 'w') as f:
        json.dump({'domains': domains}, f)
    print('wrote www/js/station_domains.json')


def _parse_stationlist():

    parsed_urls = ['npr.org']

    with open('data/org_homepages.csv') as f:
        urls = f.read().splitlines()

    for url in urls[1:]:
        parsed = urlparse(url)
        domain = '.'.join(parsed.netloc.split('.')[-2:]).lower()
        if domain != '' and domain not in parsed_urls:
            parsed_urls.append(domain)

    return sorted(parsed_urls)
