import h from 'virtual-dom/h';
import diff from 'virtual-dom/diff';
import patch from 'virtual-dom/patch';
import createElement from 'virtual-dom/create-element';
import virtualize from 'vdom-virtualize';
import request from 'superagent';
import URL from 'url-parse';
import moment from 'moment-timezone';
import imagesLoaded from 'imagesloaded';
import * as _ from 'underscore';
import Clipboard from 'clipboard/lib/clipboard';

// Global vars
window.pymChild = null;
let pymParent = null;
let parentUrl = null;
let liveblogURL = null;

// Width detection vars
let childWidth = null;
let DEFAULT_WIDTH = 600;
let MOBILE_THRESHOLD = 500;
let isMobile = false;

let liveblogvDOM = null;
let liveblogDOM = null;
let headervDOM = null;
let headerDOM = null;
let domNode = null;

let numReadPosts = 0;
let currentPosts = [];
let trackedPosts = [];
let expandedPosts = [];
// Todo clean readStatus
let readPosts = [];
let seenPosts = [];
let firstLoad = true;
let lastUpdatedTimestamp = null;
let lastRequestTime = null;
let liveblogInterval = null;
let vHeight = null;
// Debounce sendHeight messaging
let debouncedUpdateIFrame = null
const DEBOUNCE_WAIT = 500;

// BOP rendered flags for defered deeplinking
let bopRendered = false;
let totalsRendered = false;
let bopDeepLink = false;
// Time that the tooltip will be displayed after successfully copying a link
const CLIPBOARD_TOOLTIP_SHOW_TIME = 1000;

const parser = new DOMParser();
const liveblogWrapper = document.querySelector('.liveblog-wrapper')
const headerWrapper = document.querySelector('.header-wrapper')
const updateInterval = APP_CONFIG.DEPLOYMENT_TARGET ? 10000 : 10000;
const LAZYLOAD_AHEAD = 2;

// Analytics
let jumpToTopTracked = false;


/*
 * Initialize pym
 * Initialize liveblog DOM
 * Set poll on liveblog file
 */
const onWindowLoaded = function() {
    window.pymChild = new pym.Child({
        renderCallback: childReady
    });
    var guessedTimeZone = moment.tz.guess();
    moment.tz.setDefault(guessedTimeZone);
    // message listeners
    window.pymChild.onMessage('visibility-available', onVisibilityAvailable)
    window.pymChild.onMessage('viewport-height', onViewHeight);
    window.addEventListener("unload", onUnload);
    // Todo clean readStatus
    window.pymChild.onMessage('on-screen', onPostRead);
    window.pymChild.onMessage('element-visible', onPostVisible);
    window.pymChild.onMessage('request-bounding-client-rect', onBoundingClientRectRequest);
    window.pymChild.sendMessage('test-visibility-tracker', 'test');
    window.pymChild.sendMessage('get-viewport-height', '');

    parseParentURL();
    initUI();
    liveblogURL = buildLiveblogURL();
    // add Clipboard for deeplinks
    setupClipboardjs();
    getLiveblog();
    // Add event listeners
    addLiveblogListener();
    liveblogInterval = setInterval(function () {
        getLiveblog();
    }, updateInterval);
}

/*
 * Child Ready
 */
const childReady = function(containerWidth) {
    if (!containerWidth) {
        containerWidth = DEFAULT_WIDTH;
    }

    if (containerWidth <= MOBILE_THRESHOLD) {
        isMobile = true;
    } else {
        isMobile = false;
    }

    childWidth = containerWidth;

    updateIFrame();
}

const parseParentURL = function() {
    parentUrl = new URL(window.pymChild.parentUrl, location, true);
    const domain = parentUrl.hostname.split('.').slice(-2).join('.');
    if (domain == 'npr.org' ||
        parentUrl.hostname == 'localhost' ||
        parentUrl.hostname == '127.0.0.1') {
        document.body.classList.add('npr');
    }
}

const initUI = function() {
    liveblogvDOM = renderInitialLiveblogvDOM();
    liveblogDOM = createElement(liveblogvDOM);
    liveblogWrapper.appendChild(liveblogDOM);

    const headerData = {
        'updated': '',
        'numPosts': 0
    }
    headervDOM = renderHeadervDOM(headerData);
    headerDOM = createElement(headervDOM);
    headerWrapper.appendChild(headerDOM);
}

const setupClipboardjs = function() {
    let deeplinkUrl = new URL(window.pymChild.parentUrl, location, true);
    let clipboard = new Clipboard('.deeplink', {
        target: function(trigger) {
            const parent = trigger.parentElement;
            const id = trigger['id'].substring(3);
            let newQuery = deeplinkUrl.query;
            newQuery['post'] = id;
            deeplinkUrl.set('query',newQuery);
            let input = document.createElement('input');
            input.className = 'deeplink-input hidden';
            input.readonly = true;
            input.value = deeplinkUrl.href;
            if (!parent) {
                console.error("deeplink has no parent element");
                return null;
            } else {
                parent.appendChild(input);
                return input;
            }
        }
    });
    clipboard.on('success', function(e) {
        const deepLinkInput = document.querySelector('.deeplink-input');
        if (deepLinkInput) {
            deepLinkInput.remove();
        }
        // TODO add tooltip functionality
        var triggerTooltip = e.trigger.childNodes[1];
        setTimeout(hideTooltip, CLIPBOARD_TOOLTIP_SHOW_TIME);
        triggerTooltip.classList.add('visible');
        e.clearSelection();

        function hideTooltip() {
            triggerTooltip.classList.remove('visible');
        }

        // Track copy to clipboard usage
        var id = e.trigger['id'];
        ANALYTICS.trackEvent('copy-to-clipboard', id);
    });
    clipboard.on('error', function(e) {
        console.log('Press Press Ctrl+C to copy');
    });
}

/*
 * Request the liveblog from S3/local server
 * update the liveblog
 * update the rest of the UI based on the liveblog
 * send iframe height to parent page
 */
const getLiveblog = function() {
    request.get(liveblogURL)
        .set('If-Modified-Since', lastRequestTime ? lastRequestTime : '')
        .end(function(err, res) {
            if (res.status === 200) {
                lastRequestTime = new Date().toUTCString();
                updateLiveblog(res.text);
                updateHeader();
                if (firstLoad) {
                    firstLoad = false;
                    addNewPostBtnListener();
                    deepLinkScroll();
                }
            } else if (res.status === 304) {
                // update relative timestamps when 304s
                updateRelativeTimestamps();
            }
            debouncedUpdateIFrame();
        });
}

/*
 * Update pym iframe height
 */
const updateIFrame = function() {
    if (window.pymChild) {
        window.pymChild.sendHeight();
    }
}

/*
 * Debounce the sendHeight to the parent to avoid
 * too many events sent while the assets are being lazy loaded.
 */
debouncedUpdateIFrame = _.debounce(updateIFrame, DEBOUNCE_WAIT);

/*
 * Build new virtual DOM from HTTP request
 * Diff with current DOM and apply patches
 */
const updateLiveblog = function(data) {
    domNode = parser.parseFromString(data, 'text/html');
    const liveblog = domNode.querySelector('.liveblog');
    const newLiveblogvDOM = buildLiveblogvDOM(liveblog);
    const patches = diff(liveblogvDOM, newLiveblogvDOM);

    liveblogDOM = patch(liveblogDOM, patches);
    liveblogvDOM = newLiveblogvDOM;
    registerTrackers();
    updateNewPostCount();
}

const updateRelativeTimestamps = function() {
    if (domNode) {
        var posts = domNode.querySelectorAll('.post');
        // Stop using relative time after an hour and ten minutes
        var relativeCutoff = 4200000;
        [].forEach.call(posts, function(post) {
            const id = post['id'];
            const timestamp = post.querySelector('.post-timestamp').innerHTML;
            var momentDiff = moment().diff(timestamp);
            if (momentDiff < relativeCutoff) {
                // Return relative time
                var newRelTimestamp = moment(timestamp).fromNow();
                var actualPostDOM = liveblogDOM.querySelector('.post#'+id);
                var timeDOM = actualPostDOM.querySelector('.timestamp-time');
                timeDOM.innerHTML = newRelTimestamp;
            }
        });
    }
}

/*
 * Build new virtual DOM based on current time and number of posts
 * Diff with current DOM and apply patches
 */
const updateHeader = function() {
    const headerData = {
        'updated': lastUpdatedTimestamp,
        'numPosts': document.querySelectorAll('.post').length
    }

    const newHeadervDOM = renderHeadervDOM(headerData);
    const headerPatches = diff(headervDOM, newHeadervDOM);
    headerDOM = patch(headerDOM, headerPatches);
    headervDOM = newHeadervDOM;
}

const updateNewPostCount = function() {
    var newPostBtn = document.querySelector('.new-posts-btn');
    var newPostCounter = newPostBtn.querySelector('.counter');
    var newPostCount = document.querySelectorAll('.post.hidden').length;
    var newPostText = newPostCount + ' new post';

    if (newPostCount > 1) {
        newPostText += 's';
    }

    if (newPostCount == 0) {
        newPostBtn.classList.add('hidden');
    } else {
        newPostBtn.classList.remove('hidden');
    }

    newPostCounter.innerHTML = newPostText;
    //TODO: this does not solve it we need to listen
    // To transitionend
    debouncedUpdateIFrame();
};

const addLiveblogListener = function() {
    const liveblogWrapper = document.querySelector('.liveblog-wrapper');
    liveblogWrapper.addEventListener('click', function(e) {
        if(e.target && e.target.nodeName == "A") {
            if (e.target.className == 'footer-top-link') {
                onJumpToTopClick.call(e.target, e);
            }
            else if (e.target.className == 'internal-link') {
                onInternalLinkClick.call(e.target, e);
            }
            else {
                if (document.body.classList.contains('npr') && window.pymChild) {
                    window.pymChild.sendMessage('pjax-navigate', e.target.href);
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }
    })
}

const addNewPostBtnListener = function() {
    var newPostBtn = document.querySelector('.new-posts-btn');
    newPostBtn.addEventListener('click', onNewPostBtnClick);
};

const deepLinkScroll = function() {
    const postId = parentUrl.query['post'];
    updateIFrame();
    if (postId) {
        const post = document.getElementById(postId)
        scrollToPost('#'+postId);
        lazyload_assets(post);
    }
}

const buildLiveblogvDOM = function(liveblog) {
    if (liveblog.classList.contains('before')) {
        document.body.classList.add('before');
        document.body.classList.remove('during');
        document.body.classList.remove('after');
        document.body.classList.remove('error');
    } else if (liveblog.classList.contains('during')) {
        document.body.classList.add('during');
        document.body.classList.remove('before');
        document.body.classList.remove('after');
        document.body.classList.remove('error');
    } else if (liveblog.classList.contains('after')) {
        document.body.classList.add('after');
        document.body.classList.remove('before');
        document.body.classList.remove('during');
        document.body.classList.remove('error');
        clearInterval(liveblogInterval);
    } else if (liveblog.classList.contains('error')) {
        document.body.classList.add('error');
        document.body.classList.remove('before');
        document.body.classList.remove('during');
        document.body.classList.remove('after');
    }

    const children = liveblog.children;
    const childrenArray = Array.prototype.slice.call(children);
    return h('div', {
        className: liveblog.className
    }, [
        childrenArray.map(child => renderChild(child))
    ]);

    function renderChild(child) {
        try {
            let element = null;
            if (child.tagName === 'DIV') {
                if (child.classList.contains('post')){
                    element = renderPost(child);
                }
                else if (child.classList.contains('pinned-post')) {
                    element = renderPinnedPost(child);
                }
                else {
                    element = virtualize(child);
                }
            } else {
                element = virtualize(child);
            }
            return element;
        } catch (e) {
            console.error(e);
        }
    }

    function renderPost(child) {
        const id = child.getAttribute('id');
        // Aside from initial load, hide new posts
        // How do I keep this from screwing up the virtualDiff?
        if (firstLoad) {
            expandedPosts.push(id);
        }

        if (expandedPosts.indexOf(id) === -1) {
            child.classList.add('hidden');
        }

        // TODO: Clean up read status
        if (readPosts.indexOf(id) === -1){
            child.classList.add('unread');
        }

        var postHTML = [];

        var flagSelector = child.querySelector('.post-label');
        if (flagSelector) {
            postHTML.push(virtualize(flagSelector));
        }

        var timeText = child.querySelector('.post-timestamp').innerHTML;
        var formattedTime = handleTimestampFormat(timeText, true);

        var headerHTML = h('div.post-header', [
                formattedTime,
                virtualize(child.querySelector('.deeplink'))
            ]);

        postHTML.push(headerHTML);
        postHTML.push(virtualize(child.querySelector('.post-headline')));
        postHTML.push(virtualize(child.querySelector('.post-content')));
        postHTML.push(virtualize(child.querySelector('.post-footer')));

        return h('div', {
            id: child.getAttribute('id'),
            className: child.className,
            key: child.getAttribute('id')
        }, postHTML)
    }

    function renderPinnedPost(child) {
        var lastUpdated = child.getAttribute("data-last-updated");
        if (lastUpdated) {
            if (moment().format('M D') == moment(lastUpdated).format('M D')) {
                // return regular timestamp
                lastUpdatedTimestamp = moment(lastUpdated).format('h:mm A z');
            } else {
                // if from the day before
                lastUpdatedTimestamp = moment(lastUpdated).format('h:mm A z • MMMM D, YYYY');
            }
        } else {
            lastUpdatedTimestamp = 'No updates yet';
        }


        return h('div', {
            className: child.className
        },[
            virtualize(child.querySelector('.post-headline')),
            virtualize(child.querySelector('.post-content')),
            virtualize(child.querySelector('.post-footer')),
        ])
    }
}

/*
 * Build correct liveblog URL based on hostname
 */
const buildLiveblogURL = function() {
    let liveblog_page = '/liveblog.html';
    if (/\/preview\.html/.test(parentUrl.pathname)) {
        liveblog_page = '/liveblog_preview.html';
    }
    return APP_CONFIG.S3_BASE_URL + liveblog_page;
}

/*
 * Render the initial state.
 */
const renderInitialLiveblogvDOM = function() {
    return h('div.init', [
                h('p.waiting', 'Loading...'),
                h('div.spin-icon', '')
            ]);
}

/*
 * Render virtual DOM representation of header
 */
const renderHeadervDOM = function(data) {
    var headerContents;

    if (document.body.classList.contains('before') || document.body.classList.contains('during')) {
        headerContents = renderHeaderContentsDuring(data);
    } else if (document.body.classList.contains('after')) {
        headerContents = renderHeaderContentsAfter(data);
    }

    return h('div.header#header', headerContents)
}

/*
 * Render virtual DOM representation of header contents DURING debate
 */
const renderHeaderContentsDuring = function(data) {
    return [
        h('h1.header-title', 'Live Coverage: Inauguration Day 2017'),
        h('p.header-info', [
            h('span.last-updated', ['Last updated: ' + data.updated]),
            h('span.num-posts', data.numPosts + ' Posts')
        ]),
    ]
};

/*
 * Render virtual DOM representation of header contents AFTER debate
 */
const renderHeaderContentsAfter = function(data) {
    return [
        h('h1.header-title', 'Live Coverage: Inauguration Day 2017'),
        h('p.header-info', [
            h('span.last-updated', ['Last updated: ' + data.updated]),
            h('span.num-posts', data.numPosts + ' Posts')
        ]),
    ]
};

const renderImage = function(imageWrapper) {
    const image = imageWrapper.getElementsByTagName('img')[0];
    const src = imageWrapper.getAttribute("data-src");
    var parts = src.split('.');
    var filenamePosition = parts.length - 2;
    var filenameExtension = parts.length - 1;
    if (parts[filenameExtension].toLowerCase() !== 'gif') {
        if (document.body.clientWidth > 800) {
            parts[filenamePosition] += '-s750-c80';
        } else {
            parts[filenamePosition] += '-s600-c70';
        }
    }
    const newSrc = parts.join('.');
    image.setAttribute("src", newSrc);
    imageWrapper.removeAttribute("data-src");
    debouncedUpdateIFrame();
}

const renderTweet = function(tweetWrapper) {
    if (window.twttr === undefined) return;

    const tweet = tweetWrapper.getElementsByClassName('tweet')[0];
    const id = tweetWrapper.getAttribute('data-tweet-id');
    let conversation = 'all';
    let cards = 'all';
    if (tweetWrapper.getAttribute('data-show-thread') === "0") {
        conversation = 'none';
    }
    if (tweetWrapper.getAttribute('data-show-media') === "0") {
        cards = 'none';
    }
    const options = {
        'conversation': conversation,
        'cards': cards
    };
    // Clear the container
    //tweet.innerHTML = '';
    tweetWrapper.removeAttribute("data-tweet-id");
    // Create a tweet through twitter widgets factory function
    twttr.widgets.createTweet(id, tweet, options)
      .then(function (el) {
        tweetWrapper.classList.add('loaded');
        // Update the iframe height once loaded
        debouncedUpdateIFrame();
    }, function(reason) {
        console.log("error", reason);
    });
}

/*
 * Render a Youtube video
 */
const renderYoutubeVideo = function(videoWrapper) {
    const video = videoWrapper.getElementsByTagName('iframe')[0];
    const src = videoWrapper.getAttribute("data-src");
    video.setAttribute("src", src);
    videoWrapper.removeAttribute("data-src");
    videoWrapper.classList.add('loaded');
    debouncedUpdateIFrame();
}

/*
 * Render a Facebook video
 */
const renderFacebookVideo = function(videoWrapper) {
    if (window.FB === undefined) return;

    const placeholder = videoWrapper.querySelector('.vid-wrapper');
    const src = videoWrapper.getAttribute("data-src");
    videoWrapper.removeAttribute("data-src");
    const videoDiv = document.createElement('div');
    videoDiv.setAttribute('data-href', src);
    videoDiv.setAttribute('data-show-text', 'true');
    videoDiv.setAttribute('data-width', '500');
    videoDiv.classList.add('fb-video');
    placeholder.append(videoDiv);
    FB.XFBML.parse(videoWrapper, function() {
        //videoWrapper.removeChild(placeholder);
        videoWrapper.classList.add('loaded');
        debouncedUpdateIFrame();
    });
}

const scrollToPost = function(id) {
    const el = document.querySelector(id);
    if (el) {
        const rect = el.getBoundingClientRect();
        window.pymChild.scrollParentToChildPos(rect.top - 30);
    }
}

const registerTrackers = function() {
    currentPosts = [];
    const posts = document.querySelectorAll('.post');

    [].forEach.call(posts, function(post) {
        const id = post.getAttribute('id');
        currentPosts.push(id);

        if (trackedPosts.indexOf(id) === -1) {
            trackedPosts.push(id);
            window.pymChild.sendMessage('request-tracking', id);

            post.classList.add('new');
            setTimeout(function() {
                post.classList.remove('new')
            }, 200);

            // Update parent title
            if (!firstLoad) { // Ignore first load
                // Only increment if it has never been expanded
                if (expandedPosts.indexOf(id) === -1) {
                    window.pymChild.sendMessage('update-parent-title', '1');
                }
            }
        }
    });

    const diff = trackedPosts.filter(x => currentPosts.indexOf(x) === -1);
    if (diff.length > 0) {
        for (const lostID of diff) {
            window.pymChild.sendMessage('remove-tracker', lostID);
            removeFromArray(trackedPosts, lostID);
            removeFromArray(readPosts, lostID);
            removeFromArray(seenPosts, lostID);
            // Update parent title
            // Only decrement if it has never been expanded
            if (expandedPosts.indexOf(lostID) === -1) {
                window.pymChild.sendMessage('update-parent-title', '-1');
            }
        }
    }

}

const lazyload_videos = function(post) {
    const youtubeVideos = post.querySelectorAll(".embed-youtube[data-src]");
    const youtubeVideosArray = Array.prototype.slice.call(youtubeVideos);
    youtubeVideosArray.map(video => renderYoutubeVideo(video));

    const facebookVideos = post.querySelectorAll(".embed-fblive[data-src]");
    const facebookVideosArray = Array.prototype.slice.call(facebookVideos);
    facebookVideosArray.map(video => renderFacebookVideo(video));
}

const lazyload_images = function(post) {
    const images = post.querySelectorAll(".embed-image[data-src], .embed-graphic[data-src]");
    const imagesArray = Array.prototype.slice.call(images);
    imagesArray.map(image => renderImage(image))
    if (imagesArray.length) {
        imagesLoaded(post, function() {
            imagesArray.map(image => image.classList.add('loaded'));
            debouncedUpdateIFrame();
        })
    }

}

const lazyload_tweets = function(post) {
    const tweets = post.querySelectorAll("div[data-tweet-id]");
    const tweetsArray = Array.prototype.slice.call(tweets);
    tweetsArray.map(tweet => renderTweet(tweet))
}

/* Lazy loading of images and tweets
 * We expect this page to get really long so it is needed
 * tweets are handled here since we need to use the widget library to load them
 */
const lazyload_assets = function(post, stop) {
    stop = stop || 0;

    // Lazyload images
    lazyload_images(post)
    // Lazyload tweets
    lazyload_tweets(post)
    // Lazyload videos
    lazyload_videos(post);

    if (stop < LAZYLOAD_AHEAD && post.nextSibling) {
        lazyload_assets(post.nextSibling, stop + 1);
    }
}

/*
 * Handle timestamp formatting to use relative time at small gaps and add the date if necessary.
 */
const handleTimestampFormat = function(timeString, enableRelative) {
    var momentDiff = moment().diff(timeString);
    // Stop using relative time after an hour and ten minutes
    var relativeCutoff = 4200000;
    var formattedTime = [];

    if (enableRelative && momentDiff < relativeCutoff) {
        // Return relative time
        formattedTime.push(h('span.timestamp-time', moment(timeString).fromNow()));
    } else if (moment().format('M D') == moment(timeString).format('M D')) {
        // return regular timestamp
        formattedTime.push(h('span.timestamp-time', moment(timeString).format('h:mm A z')));
    } else {
        // if from the day before
        formattedTime.push(h('span.timestamp-time', moment(timeString).format('h:mm A z')));
        formattedTime.push(h('span.timestamp-date', moment(timeString).format('MMM. D')));
    }

    var timestampVDOM = h('div.timestamp', formattedTime);

    return timestampVDOM;
};


// event handlers
const onVisibilityAvailable = function(id) {
    //console.log("message visibility-available received" ,id);
    document.body.classList.remove('vis-not-available');
}

const onViewHeight = function(height){
    //console.log("message viewport-height received");
    vHeight = height;
}


const onPostRead = function(id) {
    //console.log("message on-screen received");
    const post = document.getElementById(id);
    // Ignore messages sent to posts that
    // have deing deleted from page
    if (!post) { return; }
    post.classList.remove('unread');
    if (readPosts.indexOf(id) == -1) {
        readPosts.push(id);
        numReadPosts += 1;
    }
}

const onPostVisible = function(id) {
    //console.log("message element-visible received", id);
    const post = document.getElementById(id);
    // Ignore messages sent to posts that
    // have deing deleted from page
    if (!post) { return; }
    if (seenPosts.indexOf(id) == -1) {
        seenPosts.push(id);
    }

    //lazy-load assets
    lazyload_assets(post);
}

const onBoundingClientRectRequest = function(id) {
    //console.log("BoundingRectReceived", id);
    const post = document.getElementById(id);
    // Ignore messages sent to posts that
    // have deing deleted from page
    if (!post) { return; }
    const rect = post.getBoundingClientRect();
    const rectString = rect.top + ' ' + rect.left + ' ' + rect.bottom + ' ' + rect.right;
    window.pymChild.sendMessage(id + '-bounding-client-rect-return', rectString);

}

const onUnload = function(e) {
    const numPosts = document.querySelectorAll('.post').length;
    const unreadPosts = document.querySelectorAll('.post.unread').length;
    const readPosts = numPosts - unreadPosts;

    const strPosts = numPosts.toString();
    const strRead = readPosts.toString();

    const percentageRead = readPosts / numPosts;
    const nearestTenth = Math.floor10(percentageRead, -1);
    const nearestTenthStr = nearestTenth.toString();

    // Track posts read data
    ANALYTICS.trackEvent('posts-read', strRead, readPosts);
    ANALYTICS.trackEvent('posts-on-page', strPosts, numPosts);
    ANALYTICS.trackEvent('percentage-posts-read', nearestTenthStr);
}

const onJumpToTopClick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    window.pymChild.scrollParentToChildEl('results-nav-wrapper');
    if (!jumpToTopTracked) {
        ANALYTICS.trackEvent('jump-to-top-click');
        jumpToTopTracked = true;
    }
}

const onInternalLinkClick = function(e){
    e.preventDefault();
    e.stopPropagation();
    const postId = this.getAttribute('href');
    const id = '#' + postId.split('#').slice(-1);
    scrollToPost(id);

    // Track internal links usage
    ANALYTICS.trackEvent('internal-link', id);
}

const onNewPostBtnClick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    var hiddenPosts = document.querySelectorAll('.post.hidden');
    [].forEach.call(hiddenPosts, function(post) {
        var id = post.getAttribute('id');
        if (expandedPosts.indexOf(id) == -1) {
            expandedPosts.push(id);
        }
        post.classList.remove('hidden');
    });

    // Reset parent title
    window.pymChild.sendMessage('update-parent-title', '0');
    // Hide NewPost Button
    this.classList.add('hidden');
    // Update Iframe height accordingly
    debouncedUpdateIFrame();

    // Track grouped button usage
    const groupedPosts = hiddenPosts.length;
    const strGroupedPosts = groupedPosts.toString();
    ANALYTICS.trackEvent('new-post-grouped', strGroupedPosts, groupedPosts);
};

// via https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round#Decimal_rounding
const decimalAdjust = function(type, value, exp) {
    // If the exp is undefined or zero...
    if (typeof exp === 'undefined' || +exp === 0) {
      return Math[type](value);
    }
    value = +value;
    exp = +exp;
    // If the value is not a number or the exp is not an integer...
    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
      return NaN;
    }
    // Shift
    value = value.toString().split('e');
    value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
    // Shift back
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
  }

Math.floor10 = function(value, exp) {
    return decimalAdjust('floor', value, exp);
}

const removeFromArray = function(array, item) {
    const index = array.indexOf(item);

    if (index > -1) {
        array.splice(index, 1);
    }
}


window.onload = onWindowLoaded;
