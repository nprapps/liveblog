/**
 * Creates a menu entry in the Google Docs UI when the document is opened.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @param {object} e The event parameter for a simple onOpen trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode.
 */
function onOpen(e) {
    var menu = DocumentApp.getUi().createAddonMenu();
    menu.addItem('Add Post', 'showMetadataSidebar_');
    menu.addItem('Add Embed ShortCode', 'showEmbedSidebar_');
    menu.addSeparator();
    menu.addItem('Set Authors Spreadsheet', 'showAuthorsDialog_');
    menu.addItem('Set Image Url Prefix', 'setImageUrlPrefix_');
    menu.addItem('Set Sidebar Logo', 'setLogo_');
    menu.addSeparator();
    menu.addItem('Initialize Document', 'initializeDocument_');
    //menu.addItem('Reset Document Properties', 'resetDocProperties_');
    menu.addToUi();
}

/**
 * Runs when the add-on is installed.
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @param {object} e The event parameter for a simple onInstall trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode. (In practice, onInstall triggers always
 *     run in AuthMode.FULL, but onOpen triggers may be AuthMode.LIMITED or
 *     AuthMode.NONE.)
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Needed to allow to load HTML files with templates
 * and thus being able to split our code into modules
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
