/**
 * Opens a sidebar in the document containing the add-on's user interface.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 */
function showMetadataSidebar_() {
    var props = PropertiesService.getDocumentProperties();
    var ui = DocumentApp.getUi();
    authors_key = props.getProperty('authors_key');
    if (!authors_key) {
        var response = ui.alert('Authors spreadsheet not found, you need to set it first');
        return;
    }
    var doc = HtmlService.createTemplateFromFile('metadata_sidebar');
    doc.data = getAuthorsData_();
    doc.logo = getLogo_();
    html = doc.evaluate();
    html.setTitle('Post Metadata');
    ui.showSidebar(html);
}

function Comparator(a, b) {
    var splitA = a[1].split(" ");
    var splitB = b[1].split(" ");
    var lastA = splitA[splitA.length - 1];
    var lastB = splitB[splitB.length - 1];

    if (lastA < lastB) return -1;
    if (lastA > lastB) return 1;
    return 0;
}

/**
 * Retrieves the Authors data from a configured spreadsheet key
 * added to the Documents properties by setAuthors_() in config
 */
function getAuthorsData_() {
    var props = PropertiesService.getDocumentProperties();
    var authors_key = props.getProperty('authors_key');
    var values = SpreadsheetApp.openById(authors_key)
                         .getActiveSheet()
                         .getDataRange()
                         .getValues();
    // remove header
    values.shift();
    values = values.sort(Comparator);
    return values;
}


/**
 * Replaces the text of the current selection with the provided text, or
 * inserts text at the current cursor location. (There will always be either
 * a selection or a cursor.) If multiple elements are selected, only inserts the
 * translated text in the first element that can contain text and removes the
 * other elements.
 *
 * @param {string} newText The text with which to replace the current selection.
 */
function insertMetadata(formObject) {
    try {
        var doc = DocumentApp.getActiveDocument();
        var cursor = doc.getCursor();
        var body = doc.getBody();

        // GET LAST SLUG INDEX

        var props = PropertiesService.getDocumentProperties();
        var slug_idx = _getNumProperty(props, 'SLUG_IDX');
        if (!slug_idx) {
            slug_idx = 1;
        } else {
            slug_idx += 1;
        }

        // VALIDATE HEADLINE

        if (!formObject.headline || formObject.headline === "") {
            msg = "You need to setup a headline, you can change it later"
            throw new CustomError(msg, 'metadata.js', '41');
        }

        //COMPOSE METADATA

        // Authors metadata
        var authors = '';
        if (formObject.authorsList != null && formObject.otherAuthors != '') {
            authors += 'Authors: ' + formObject.authorsList;
            authors += ',' + formObject.otherAuthors;
        }
        else if (formObject.authorsList != null) {
            authors += 'Authors: ' + formObject.authorsList;
        }
        else if (formObject.otherAuthors != '') {
            authors += 'Authors: ' + formObject.otherAuthors;
        }
        else {
            msg = "No authors were selected."
            throw new CustomError(msg, 'metadata.js', '51');
        }

        var foundPinnedEnd = body.findText(END_POST_MARKER);
        if (!foundPinnedEnd) {
            msg = "Initialize the document first."
            throw new CustomError(msg, 'metadata.js', '68');
        }

        // Slug metadata
        var slug = 'Slug: ';
        var slug_lower = (formObject.headline).toLowerCase();
        var slug_clean = slug_lower.replace(/[^\w\s]+/g,'').replace(/_/g,'-').replace(/\s+/g,'-');
        if (slug_clean.length > 40) {
            var ix = slug_clean.lastIndexOf('-', 39);
            if (ix !== -1) {
                slug_clean = slug_clean.substring(0,ix);
            }
        }
        if (slug_clean.match(/^\d/)) {
            // PersistLog.info("slug %s startsWith number, adding sl- preffix", slug_clean);
            slug_clean = 'sl-' + slug_clean;
        }
        slug += slug_clean + '-' + slug_idx;

        // Major development metadata
        var major = 'Major Development: '+ formObject.major;
        // Published metadata
        var published = 'Published: No';

        // WRITE TO DOCUMENT

        var el = foundPinnedEnd.getElement().getParent();
        var idx = body.getChildIndex(el);
        body.insertParagraph(idx+1, NEW_POST_MARKER).setBold(false).setBackgroundColor(null).setForegroundColor(null);
        var heading = body.insertParagraph(idx+2, formObject.headline).setHeading(DocumentApp.ParagraphHeading.HEADING1);
        p = body.insertParagraph(idx+3, FRONTMATTER_MARKER);
        body.insertParagraph(idx+4, authors);
        body.insertParagraph(idx+5, slug);
        body.insertParagraph(idx+6, major);
        body.insertParagraph(idx+7, published).setHeading(DocumentApp.ParagraphHeading.HEADING3).setBold(true).setBackgroundColor('#FFF2CC');
        body.insertParagraph(idx+8, FRONTMATTER_MARKER).setBold(false).setBackgroundColor(null);
        body.insertParagraph(idx+9, '');
        var placeholder = body.insertParagraph(idx+10, POST_PLACEHOLDER);
        body.insertParagraph(idx+11, '');
        body.insertParagraph(idx+12, END_POST_MARKER).setBold(false).setForegroundColor('#FF0000');
        body.insertParagraph(idx+13, '').setBold(false).setForegroundColor(null).setBackgroundColor(null);

        // POSITION CURSOR ON PLACEHOLDER COPY TEXT
        var rangeBuilder = doc.newRange();
        rangeBuilder.addElement(placeholder);
        doc.setSelection(rangeBuilder.build());
        // STORE NEW SLUG INDEX
        props.setProperty("SLUG_IDX",slug_idx);
    } catch(e) {
        var msg =  Utilities.formatString('%s: %s (line %s, file %s). Stack: %s .', e.name || '',
                                          e.message || '', e.lineNumber || '', e.fileName || '', e.stack || '');
        throw e;
    }
}
