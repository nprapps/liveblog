#!/usr/bin/env python
"""
Example application views.

Note that `render_template` is wrapped with `make_response` in all application
routes. While not necessary for most Flask apps, it is required in the
App Template for static publishing.
"""

import app_config
import logging
import oauth
import parse_doc
import static

from copydoc import CopyDoc
from flask import Flask, make_response, render_template, jsonify
from flask_cors import CORS
from render_utils import make_context, smarty_filter, flatten_app_config
from render_utils import urlencode_filter
from werkzeug.debug import DebuggedApplication
from html.parser import HTMLParser

app = Flask(__name__)
app.debug = app_config.DEBUG
CORS(app)

app.add_template_filter(smarty_filter, name='smarty')
app.add_template_filter(urlencode_filter, name='urlencode')

logging.basicConfig(format=app_config.LOG_FORMAT)
logger = logging.getLogger(__name__)
logger.setLevel(app_config.LOG_LEVEL)


class GetFirstElement(HTMLParser):
    '''
    Given a blob of markup, find and return the contents and attributes 
    of the first of a particular type of element. 
    Currently tuned to work on <p> and <img> elements.
    >>> el = GetFirstElement('img')
    >>> markup = '<p>First p tag<img alt="The first img" src="">'
    >>> el.feed(markup)
    >>> print dict(el.attrs)
    {u'src': u'', u'alt': u'The first img'}
    '''

    def __init__(self, el):
        '''
        What element are we looking for? That gets set here.
        >>> el = GetFirstElement()
        '''
        HTMLParser.__init__(self)
        self.el = el.lower()
        self.verbose = False
        self.attrs = None
        self.data = None
        # self.match_start and self.match_data helps us figure out when we've already gotten a match for the element.
        self.match_start = False
        self.match_data = False
        self.standalone_elements = ['meta', 'link', 'hr', 'img']

    def handle_starttag(self, tag, attrs):
        '''
        Some elements have an opening and closing tag, those get handled differently
        than the elements that are standalone.
        '''
        if tag == self.el and not self.match_start:
            if self.verbose:
                print 'Found a matching start tag: %s' % tag
            self.match_start = True
            self.matched_el = tag
            if tag in self.standalone_elements:
                # Set aside the element attributes for later.
                self.attrs = attrs

    def handle_data(self, data):
        '''
        This processed the contents of the tags.
        '''
        if self.match_start and not self.match_data:
            if self.verbose:
                print 'Found contents of a matching start tag: %s' % data
            if data.strip() == '':
                if self.verbose:
                    print 'Start tag %s was empty, moving on to next tag.' % data
                self.match_start = False
            else:
                self.match_data = True
                # Set aside the element's innards for later
                self.data = data


@app.route('/sharecard/<slug>.html', methods=['GET', 'OPTIONS'])
def _sharecard(slug):
    """
    Flatfile sharecards, one per liveblog post.
    """
    context = get_liveblog_context()
    for post in context['posts']:
        if slug == post['slug']:
            post_context = post
            post_context['PARENT_LIVEBLOG_URL'] = context['PARENT_LIVEBLOG_URL']
            post_context['SHARECARD_URL'] = '%s/%s.html' % (context['S3_BASE_URL'], post['slug'])

            get_img = GetFirstElement('img')
            get_img.verbose = True
            get_img.feed(post['contents'])
            post_context['img_src'] = context['DEFAULT_SHARE_IMG']
            if get_img.attrs:
                img_attrs = dict(get_img.attrs)
                if 'src' in img_attrs:
                    post_context['img_src'] = img_attrs['src']

            get_p = GetFirstElement('p')
            get_p.feed(post['contents'])
            post_context['lead_paragraph'] = get_p.data
            break
    # *** TODO this gets us the markup as a string, we need to figure out how to hand this off to amazon boto.
    markup = render_template('sharecard.html', **post_context)
    return make_response(markup)


@app.route('/liveblog.html', methods=['GET', 'OPTIONS'])
def _liveblog():
    """
    Liveblog only contains published posts
    """
    context = get_liveblog_context()
    return make_response(render_template('liveblog.html', **context))


@app.route('/liveblog_preview.html', methods=['GET', 'OPTIONS'])
def _preview():
    """
    Preview contains published and draft posts
    """
    context = get_liveblog_context()
    return make_response(render_template('liveblog.html', **context))


@app.route('/share.html', methods=['GET', 'OPTIONS'])
def _share():
    """
    Preview contains published and draft posts
    """
    context = get_liveblog_context()
    return make_response(render_template('share.html', **context))


@app.route('/copydoc.html', methods=['GET', 'OPTIONS'])
def _copydoc():
    """
    Example view demonstrating rendering a simple HTML page.
    """
    with open(app_config.LIVEBLOG_HTML_PATH) as f:
        html = f.read()

    doc = CopyDoc(html)
    context = {
        'doc': doc
    }

    return make_response(render_template('copydoc.html', **context))


@app.route('/child.html')
def child():
    """
    Example view demonstrating rendering a simple HTML page.
    """
    context = make_context()

    return make_response(render_template('child.html', **context))


@app.route('/')
@app.route('/index.html')
def index():
    """
    Example view demonstrating rendering a simple HTML page.
    """
    context = make_context()

    return make_response(render_template('parent.html', **context))


@app.route('/preview.html')
def preview():
    """
    Example view demonstrating rendering a simple HTML page.
    """
    context = make_context()

    return make_response(render_template('parent.html', **context))


app.register_blueprint(static.static)
app.register_blueprint(oauth.oauth)


def get_liveblog_context():
    """
    Get liveblog context
    for production we will reuse a fake g context
    in order not to perform the parsing twice
    """
    from flask import g
    context = flatten_app_config()
    parsed_liveblog_doc = getattr(g, 'parsed_liveblog', None)
    if parsed_liveblog_doc is None:
        logger.debug("did not find parsed_liveblog")
        with open(app_config.LIVEBLOG_HTML_PATH) as f:
            html = f.read()
        context.update(parse_document(html))
    else:
        logger.debug("found parsed_liveblog in g")
        context.update(parsed_liveblog_doc)
    return context


def parse_document(html):
    doc = CopyDoc(html)
    parsed_document = parse_doc.parse(doc)

    return parsed_document


# Enable Werkzeug debug pages
if app_config.DEBUG:
    wsgi_app = DebuggedApplication(app, evalex=False)
else:
    wsgi_app = app

# Catch attempts to run the app directly
if __name__ == '__main__':
    logging.error(
        'This command has been removed! Please run "fab app" instead!')
