# _*_ coding:utf-8 _*_
# This is called by app.py: parsed_document = parse_doc.parse(doc)
import logging
import re
import app_config
import datetime
import pytz
from shortcode import process_shortcode
import cPickle as pickle
from bs4 import BeautifulSoup
from pymongo import MongoClient
import xlrd

logging.basicConfig(format=app_config.LOG_FORMAT)
logger = logging.getLogger(__name__)
logger.setLevel(app_config.LOG_LEVEL)

end_liveblog_regex = re.compile(ur'^\s*[Ee][Nn][Dd]\s*$',
                                re.UNICODE)

new_post_marker_regex = re.compile(ur'^\s*\+{50,}\s*$',
                                   re.UNICODE)
post_end_marker_regex = re.compile(ur'^\s*-{50,}\s*$',
                                   re.UNICODE)

frontmatter_marker_regex = re.compile(ur'^\s*-{3}\s*$',
                                      re.UNICODE)

extract_metadata_regex = re.compile(ur'^(.*?):(.*)$',
                                    re.UNICODE)

shortcode_regex = re.compile(ur'^\s*\[%\s*.*\s*%\]\s*$', re.UNICODE)

internal_link_regex = re.compile(ur'(\[% internal_link\s+.*?\s*%\])',
                                 re.UNICODE)

author_initials_regex = re.compile(ur'^(.*)\((\w{2,3})\)\s*$', re.UNICODE)


def is_post_marker(tag):
    """
    Checks for the beginning of a new post
    """
    text = tag.get_text()
    m = new_post_marker_regex.match(text)
    if m:
        return True
    else:
        return False


def is_post_end_marker(tag):
    """
    Checks for the beginning of a new post
    """
    text = tag.get_text()
    m = post_end_marker_regex.match(text)
    if m:
        return True
    else:
        return False


def find_pinned_post(posts):
    """
    Find the pinned post
    first test if it is at the beginning to avoid looping through
    all the posts
    """
    idx = 0
    try:
        posts[idx]['pinned']
    except KeyError:
        logger.warning("Pinned post is not the first on the live document")
        found = False
        for idx, post in enumerate(posts):
            try:
                if post['pinned'] == 'yes':
                    found = True
                    break
            except KeyError:
                continue
        if not found:
            idx = None

    return idx


def order_posts(posts):
    """
    Order posts in reverse chronological order
    Except for the pinned post
    """
    try:
        ordered_posts = sorted(posts, key=lambda x: x['timestamp'],
                               reverse=True)
    except ValueError, e:
        logger.error("this should not happen, could not order %s" % e)
        ordered_posts = posts
    return ordered_posts


def insert_sponsorship(ordered_posts):
    """
    1. Find the length of the ordered posts
    2. If the length is greater than sponsorship postition,
    3. Insert sponsorship
    """
    if app_config.SPONSORSHIP_POSITION == -1:
        return ordered_posts

    SPONSORSHIP = {
        'slug': 'sponsorship',
        'published': 'yes',
        'contents': 'This is the sponsorship post.'
    }

    published_count = 0
    insert = False
    for idx, post in enumerate(ordered_posts):
        try:
            if (post['published'] == 'yes'):
                published_count += 1
            if (published_count >= app_config.SPONSORSHIP_POSITION):
                insert = True
                break
        except KeyError:
            logger.warning("Post does not have published metadata %s" % post)
            continue
    if insert:
        ordered_posts.insert(idx + 1, SPONSORSHIP)

    return ordered_posts


def compose_pinned_post(post):
    """
    1.Verify that this is the pinned post
    2.Obtain the results json from the results rig
    3.Compose the HTML for the compact graphic
    """
    pinned_post = post
    # Get the timestamps collection
    client = MongoClient(app_config.MONGODB_URL)
    database = client['liveblog']
    collection = database.pinned
    try:
        post['pinned']
    except KeyError:
        logger.error("First post should always be the pinned post")

    # Cache pinned post contents
    if post['published mode'] != 'yes':
        result = collection.find_one({'_id': post['slug']})
        if not result:
            logger.debug('did not find pinned post %s' % post['slug'])
            collection.insert({
                '_id': post['slug'],
                'cached_contents': post['contents'],
                'cached_headline': post['headline'],
            })
            post['cached_contents'] = post['contents']
            post['cached_headline'] = post['headline']
        else:
            logger.debug('found pinned post %s' % post['slug'])
            post['cached_contents'] = result['cached_contents']
            post['cached_headline'] = result['cached_headline']
            logger.debug('returning cached headline %s' % (
                         post['cached_headline']))
    else:
        # Update mongodb cache
        post['cached_contents'] = post['contents']
        post['cached_headline'] = post['headline']
        logger.debug("update cached headline to %s" % post['headline'])
        collection.update({'_id': post['slug']},
                          {'cached_contents': post['contents'],
                           'cached_headline': post['headline']})

    return pinned_post


def add_last_timestamp(posts):
    """
    add last updated liveblog timestamp
    """
    # Currently we are leaning towards grabbing
    # the last published post timestamp
    timestamp = None
    if posts:
        timestamp = posts[0]['timestamp']
    return timestamp


def process_inline_internal_link(m):
    raw_shortcode = m.group(1)
    fake_p = BeautifulSoup('<p>%s</p>' % (raw_shortcode), "html.parser")
    parsed_inline_shortcode = process_shortcode(fake_p)
    return parsed_inline_shortcode


def process_headline(contents):
    logger.debug('--process_headline start--')
    headline = None
    for tag in contents:
        if tag.name == "h1":
            headline = tag.get_text()
        else:
            logger.warning('unexpected tag found: Ignore %s' % tag.get_text())
    if not headline:
        logger.error('Did not find headline on post. Contents: %s' % contents)
    return headline


def add_author_metadata(metadata, authors):
    """
    extract author data from dict and add to metadata
    """
    # Ignore authors parsing for pinned post
    try:
        if metadata['pinned']:
            return
    except KeyError:
        pass

    raw_authors = metadata.pop('authors')
    authors_result = []
    bits = raw_authors.split(',')
    for bit in bits:
        author = { 'page': '' }
        m = author_initials_regex.match(bit)
        if m:
            key = m.group(2)
            try:
                author['name'] = authors[key]['name']
                author['page'] = authors[key]['page']
            except KeyError:
                logger.warning('did not find author in dictionary %s' % key)
                author['name'] = m.group(1).strip()
            authors_result.append(author)
        else:
            logger.debug("Author not in dictionary: %s" % raw_authors)
            author['name'] = bit
            authors_result.append(author)
    if not len(authors):
        # Add a default author to avoid erroing out
        author['name'] = 'NPR Staff'
        author['page'] = 'http://www.npr.org/'
        authors_result.append(author)
    metadata['authors'] = authors_result


def process_metadata(contents):
    logger.debug('--process_metadata start--')
    metadata = {}
    for tag in contents:
        text = tag.get_text()
        m = extract_metadata_regex.match(text)
        if m:
            key = m.group(1).strip().lower()
            value = m.group(2).strip()
            if key != 'authors':
                value = value.lower()
            metadata[key] = value
        else:
            logger.error('Could not parse metadata. Text: %s' % text)
    logger.debug("metadata: %s" % metadata)
    return metadata


def process_post_contents(contents):
    """
    Process post copy content
    In particular parse and generate HTML from shortcodes
    """
    logger.debug('--process_post_contents start--')

    parsed = []
    for tag in contents:
        text = tag.get_text()
        m = shortcode_regex.match(text)
        if m:
            parsed.append(process_shortcode(tag))
        else:
            # Parsed searching and replacing for inline internal links
            parsed_tag = internal_link_regex.sub(process_inline_internal_link,
                                                 unicode(tag))
            logger.debug('parsed tag: %s' % parsed_tag)
            parsed.append(parsed_tag)
    post_contents = ''.join(parsed)
    return post_contents


def parse_raw_posts(raw_posts, authors):
    """
    parse raw posts into an array of post objects
    """

    # Divide each post into its subparts
    # - Headline
    # - FrontMatter
    # - Contents
    posts = []

    # Get the timestamps collection
    client = MongoClient(app_config.MONGODB_URL)
    database = client['liveblog']
    collection = database.timestamps
    for raw_post in raw_posts:
        post = {}
        marker_counter = 0
        post_raw_headline = []
        post_raw_metadata = []
        post_raw_contents = []
        for tag in raw_post:
            text = tag.get_text()
            m = frontmatter_marker_regex.match(text)
            if m:
                marker_counter += 1
            else:
                if (marker_counter == 0):
                    post_raw_headline.append(tag)
                elif (marker_counter == 1):
                    post_raw_metadata.append(tag)
                else:
                    post_raw_contents.append(tag)
        post[u'headline'] = process_headline(post_raw_headline)
        metadata = process_metadata(post_raw_metadata)
        add_author_metadata(metadata, authors)
        for k, v in metadata.iteritems():
            post[k] = v
        post[u'contents'] = process_post_contents(post_raw_contents)
        posts.append(post)

        # Retrieve timestamp from mongo
        utcnow = datetime.datetime.utcnow()
        # Ignore pinned post timestamp generation
        if 'pinned' in post.keys():
            continue
        if post['published'] == 'yes':
            result = collection.find_one({'_id': post['slug']})
            # This fires when we have a newly published post
            if not result:
                logger.debug('did not find post timestamp %s: ' % post['slug'])
                collection.insert({
                    '_id': post['slug'],
                    'timestamp': utcnow,
                })
                post['timestamp'] = utcnow.replace(tzinfo=pytz.utc)
            else:
                logger.debug('post %s timestamp: retrieved from cache' % (
                             post['slug']))
                post['timestamp'] = result['timestamp'].replace(
                    tzinfo=pytz.utc)
                logger.debug("timestamp from DB: %s" % post['timestamp'])
        else:
            post['timestamp'] = utcnow.replace(tzinfo=pytz.utc)

    return posts


def split_posts(doc):
    """
    split the raw document into an array of raw posts
    """
    logger.debug('--split_posts start--')
    status = None
    raw_posts = []
    raw_post_contents = []
    ignore_orphan_text = True

    hr = doc.soup.hr
    # Get rid of everything after the Horizontal Rule
    if (hr):
        if hr.find("p", text=end_liveblog_regex):
            status = 'after'
            # Get rid of everything after the Horizontal Rule
        hr.extract()

    body = doc.soup.body
    for child in body.children:
        if is_post_marker(child):
            # Detected first post stop ignoring orphan text
            if ignore_orphan_text:
                ignore_orphan_text = False
        else:
            if ignore_orphan_text:
                continue
            elif is_post_end_marker(child):
                ignore_orphan_text = True
                raw_posts.append(raw_post_contents)
                raw_post_contents = []
            else:
                raw_post_contents.append(child)
    return status, raw_posts


def getAuthorsData():
    """
    Transforms the authors excel file
    into a format like this
    "dm": {
        "initials": "dm",
        "name": "Domenico Montanaro",
        "role": "NPR Political Editor & Digital Audience",
        "page": "http://www.npr.org/people/xxxx",
        "img": "http://media.npr.org/assets/img/yyy.jpg"
    }
    """
    authors = {}
    try:
        book = xlrd.open_workbook(app_config.AUTHORS_PATH)
        sheet = book.sheet_by_index(0)
        header = True
        for row in sheet.get_rows():
            # Ignore header row
            if header:
                header = False
                continue
            initials = row[0].value
            if initials in authors:
                logger.warning("Duplicate initials on authors dict: %s" % (
                               initials))
                continue
            author = {}
            author['initials'] = row[0].value
            author['name'] = row[1].value
            author['role'] = row[2].value
            author['page'] = row[3].value
            author['img'] = row[4].value
            authors[initials] = author
    except Exception, e:
        logger.error("Could not process the authors excel file: %s" % (e))
    finally:
        return authors


def parse(doc, authors=None):
    """
    Custom parser for the debates google doc format
    returns boolean marking if the transcript is live or has ended
    """
    try:
        parsed_document = {}
        status = None
        pinned_post = None
        logger.info('-------------start------------')
        if not authors:
            authors = getAuthorsData()
        status, raw_posts = split_posts(doc)
        posts = parse_raw_posts(raw_posts, authors)
        if posts:
            idx = find_pinned_post(posts)
            if idx is not None:
                pinned_post = posts.pop(idx)
                pinned_post = compose_pinned_post(pinned_post)
            else:
                logger.error("Did not find a pinned post on the document")
            ordered_posts = order_posts(posts)
            published_posts = filter(lambda p: p['published'] == 'yes',
                                     ordered_posts)
            pinned_post['timestamp'] = add_last_timestamp(published_posts)
            logger.info('Number of published posts %s' % len(published_posts))
            logger.info('Total number of Posts: %s' % len(ordered_posts))
            if not status and len(published_posts):
                status = 'during'
            elif not status:
                status = 'before'
        else:
            # Handle empty initial liveblog
            logger.warning('Have not found posts.')
            status = 'before'
            ordered_posts = []
        parsed_document['status'] = status
        parsed_document['pinned_post'] = pinned_post
        parsed_document['posts'] = ordered_posts
        logger.info('storing liveblog backup')
        with open(app_config.LIVEBLOG_BACKUP_PATH, 'wb') as f:
            pickle.dump(parsed_document, f)
    except Exception, e:
        logger.error('unexpected exception: %s' % e)
        logger.info('restoring liveblog backup and setting error status')
        with open(app_config.LIVEBLOG_BACKUP_PATH, 'rb') as f:
            parsed_document = pickle.load(f)
            parsed_document['status'] = 'error'
    finally:
        logger.info('-------------end------------')
    return parsed_document
