var NEW_POST_MARKER = "++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++";
var END_POST_MARKER = "---------------------------------------------------------------------------------------------------------";
var FRONTMATTER_MARKER = "---";
var POST_PLACEHOLDER = "[Post contents goes here]"
var PINNED_POST_PLACEHOLDER = "[Pinned Post contents goes here]"
var WARNING_TEXT = 'EVERYTHING AFTER THIS LINE WILL BE IGNORED BY THE APPLICATION'
var WARNING_MSG = '^^^^^ '+WARNING_TEXT+' ^^^^^';
var INITIAL_PINNED_POST_HEADLINE = 'Get Caught Up';

function setLogo_() {
    // Get DocumentProperties
    var props = PropertiesService.getDocumentProperties();
    // Ask for data
    var ui = DocumentApp.getUi();
    var result = ui.prompt(
        'Sidebar logo',
        'Enter the sidebar logo url:',
        ui.ButtonSet.OK);
    var button = result.getSelectedButton();
    var url = result.getResponseText();
    if (button == ui.Button.OK) {
        props.setProperty('sidebar_logo', url);
    }
}

function setImageUrlPrefix_() {
    // Get DocumentProperties
    var props = PropertiesService.getDocumentProperties();
    // Ask for data
    var ui = DocumentApp.getUi();
    var result = ui.prompt(
        'Image url prefix',
        'Enter the images url prefix:',
        ui.ButtonSet.OK);
    var button = result.getSelectedButton();
    var url = result.getResponseText();
    if (button == ui.Button.OK) {
      if (!url.length) {
        ui.alert('Error', 'The Image url is required, it can not be empty');
        return;
      }
      if (url[url.length-1] !== '/') {url += '/';}
      props.setProperty('image_url', url);
    }
}

/**
* Insert the marker at the end of the document body
*
* @private
* @param {Object} body Google Apps Scripts Body class
*/
function marker_() {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  for (var i=0; i < 80; i++) {
    body.appendParagraph('');
  }
  var hr = body.appendHorizontalRule();
  var marker = hr.getParent();
  marker.appendText(WARNING_MSG);
}

function insertPinnedPost_() {
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  body.insertParagraph(0, NEW_POST_MARKER).setBold(false).setBackgroundColor(null).setForegroundColor(null);
  var heading = body.insertParagraph(1, INITIAL_PINNED_POST_HEADLINE).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.insertParagraph(2, FRONTMATTER_MARKER);
  var slug = 'Slug: '+ 'pinned-post';
  body.insertParagraph(3, slug);
  var pinned = 'Pinned: Yes';
  body.insertParagraph(4, pinned);
  var status = 'Published Mode: Yes';
  body.insertParagraph(5, status).setHeading(DocumentApp.ParagraphHeading.HEADING3).setBold(true).setBackgroundColor('#FFF2CC');;
  body.insertParagraph(6, FRONTMATTER_MARKER).setBold(false).setBackgroundColor(null);
  body.insertParagraph(7, '');
  var placeholder = body.insertParagraph(7, PINNED_POST_PLACEHOLDER).setBold(false).setBackgroundColor(null);
  body.insertParagraph(8, '');
  body.insertParagraph(9, END_POST_MARKER).setBold(false).setForegroundColor('#FF0000');
  body.insertParagraph(10, '').setBold(false).setForegroundColor(null).setBackgroundColor(null);
}

function initializeDocument_() {
  // Clear out the doc
  var ui = DocumentApp.getUi();
  var response = ui.alert('WARNING: SHOULD NEVER BE DONE DURING THE LIVE EVENT', 'This will delete the doc contents, are you sure you know what you are doing?', ui.ButtonSet.YES_NO);
  // Process the user's response.
  if (response != ui.Button.YES) {
    return;
  }

  var response = ui.alert('SO YOU SAID DO IT!! REALLY?', 'This will delete the doc contents, Are you sure, sure?', ui.ButtonSet.YES_NO);
  // Process the user's response.
  if (response != ui.Button.YES) {
    return;
  }
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  // From here: https://code.google.com/p/google-apps-script-issues/issues/detail?id=5830#makechanges
  body.appendParagraph('');
  // Reset body to initial state
  body.clear();

  // Insert pinned Post
  insertPinnedPost_();
  // Insert marker at the bottom
  marker_();
  // Reset slug index property
  var props = PropertiesService.getDocumentProperties();
  var slug_idx = 0;
  props.deleteProperty('SLUG_IDX');
}


