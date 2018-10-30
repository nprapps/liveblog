/*
 * Module for tracking standardized analytics.
 */

import URL from 'url-parse';

var _gaq = _gaq || [];
var _sf_async_config = {};
var _comscore = _comscore || [];

window.ANALYTICS = (function () {

    // Global time tracking variables
    var slideStartTime =  new Date();
    var timeOnLastSlide = null;

    var embedGa = function() {
        (function(i,s,o,g,r,a,m) {
            i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
            m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','//www.google-analytics.com/analytics.js','ga');
    }

    var setupVizAnalytics = function() {
        const currentUrl = new URL(window.location.href, true);
        const parentUrl = new URL(currentUrl.query.parentUrl);

        const embedUrl = window.location.protocol +
            '//' + window.location.hostname +
            window.location.pathname;

        const gaLocation = embedUrl;
        const gaPath = window.location.pathname;

        // Dimension structure mirrrors that of the standard Visuals team analytics
        const DIMENSION_PARENT_URL = 'dimension1';
        const DIMENSION_PARENT_HOSTNAME = 'dimension2';
        const DIMENSION_PARENT_INITIAL_WIDTH = 'dimension3';
        let customData = {};
        customData[DIMENSION_PARENT_URL] = currentUrl.query.parentUrl || '';
        customData[DIMENSION_PARENT_HOSTNAME] = parentUrl.hostname;
        customData[DIMENSION_PARENT_INITIAL_WIDTH] = currentUrl.query.initialWidth || '';

        window.ga('create', APP_CONFIG.VIZ_GOOGLE_ANALYTICS.ACCOUNT_ID, 'auto');
        window.ga('set', 'location', gaLocation);
        window.ga('set', 'page', gaPath);
        window.ga('send', 'pageview', customData);
    }

    var setupGoogle = function() {
        embedGa();
        setupVizAnalytics();
     }

    /*
     * Event tracking.
     */
    var trackEvent = function(eventName, label, value) {
        var eventData = {
            'hitType': 'event',
            'eventCategory': APP_CONFIG.CURRENT_LIVEBLOG,
            'eventAction': eventName
        }

        if (label) {
            eventData['eventLabel'] = label;
        }

        if (value) {
            eventData['eventValue'] = value
        }

        ga('send', eventData);
    }

    setupGoogle();

    return {
        'trackEvent': trackEvent,
    };
}());
