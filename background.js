/* 
  Copyright 2018. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Revision 0.3 - revise and prepopulate data structure
  Revision 0.4 - add window/global switch, context menu items on toolbar button
  Revision 0.5 - add recent tabs list (requires tabs permission)
  Revision 0.6 - private windows excluded unless selected; handle detach/attach
  Revision 0.7 - popup list, add storage
  Revision 0.8 - refine popup behavior, color scheme/height options
  Revision 0.9 - option to show site icons on the popup, rebuild button ERROR
  Revision 1.0 - option to show site icons on the popup, rebuild button
  Revision 1.1 - don't build oRecent until the list is requested
  Revision 1.2 - fix bug in popup.js
  Revision 1.3 - adapt to new site icon storage in Fx63
  Revision 1.4 - more appearance options: sans-serif font, font-size, bold title, bold URL
  Revision 1.5 - Reload All Tabs (initial implementation), use HTML template instead of insertAdjacentHTML
*/

/**** Create and populate data structure ****/
// Default starting values
var oPrefs = {
	maxTabs: 30,				// maximum tabIds to store per window
	maxGlobal: 60,				// maximum tabIds to store across all windows
	popuptab: 1,				// default tab in popup.html
	blnButtonSwitches: true,	// Whether button switches immediately or shows recents	
	blnSameWindow: true,		// Button switches within same window vs. global
	blnIncludePrivate: false,	// Include private window tabs
	blnShowFavicons: false,		// Whether to retrieve site icons on recents list
	blnKeepOpen: true,			// When switching in the same window, keep popup open
	blnDark: false,				// Toggle colors to bright-on-dark
	blnSansSerif: false,		// Whether to use the default sans-serif font
	strFontSize: "14px",		// Default font size for popup
	blnBoldTitle: false,		// Whether to bold the window title
	blnBoldURL: false,			// Whether to bold the page URL
	sectionHeight: "490px"		// Height of list panel sections
}
// Update oPrefs from storage
browser.storage.local.get("prefs").then((results) => {
	if (results.prefs != undefined){
		if (JSON.stringify(results.prefs) != '{}'){
			var arrSavedPrefs = Object.keys(results.prefs)
			for (var j=0; j<arrSavedPrefs.length; j++){
				oPrefs[arrSavedPrefs[j]] = results.prefs[arrSavedPrefs[j]];
			}
		}
	}
}).catch((err) => {console.log('Error retrieving "prefs" from storage: '+err.message);});

// Preferences for RELOAD ALL TABS
var oRATprefs = {
	RATactive: true,			// whether to include the active tab
	RATpinned: true,			// whether to include pinned tabs
	RATdiscarded: true,			// whether to include discarded tabs
	RATskiploading: true,		// whether to skip reloading tabs that are still loading
	RATsequential: true,		// use sequential (false = don't wait)
	RATseqnum: 3,				// simultaneous requests if RATsequential == true
	RATbypasscache: false,		// always bypass cache (false = bypass on Shift+click)
	RATplaying: 'skip',			// how to handle tabs with audible media (ask, skip, reload)
	asknow: false				// Flag to show user buttons about playing tabs
}

// Update oRATprefs from storage
browser.storage.local.get("RATprefs").then((results) => {
	if (results.RATprefs != undefined){
		if (JSON.stringify(results.RATprefs) != '{}'){
			var arrSavedPrefs = Object.keys(results.RATprefs)
			for (var j=0; j<arrSavedPrefs.length; j++){
				oRATprefs[arrSavedPrefs[j]] = results.RATprefs[arrSavedPrefs[j]];
			}
		}
	}
}).catch((err) => {console.log('Error retrieving "RATprefs" from storage: '+err.message);});

var oTabs = {};			// store arrays of tabId's in descending order by lastAccessed

function initObjects(){
	// Initialize oTabs object with up to maxTabs recent tabs per window
	oTabs = {}; // flush
	browser.tabs.query({}).then((arrAllTabs) => {
		// Sort array of tab objects in descending order by lastAccessed (numeric)
		arrAllTabs.sort(function(a,b) {return (b.lastAccessed - a.lastAccessed);});
		// Store tabIds to oTabs
		var i, gCount = 0, arrWTabs;
		for (i=0; i<arrAllTabs.length; i++){
			// Add to global list for i=0 through maxGlobal-1 (order among windows is unpredictable)
			if (gCount < oPrefs.maxGlobal) {
				if (!('global' in oTabs)) {
					oTabs['global'] = [arrAllTabs[i].id];
				} else {
					arrWTabs = oTabs['global'];
					arrWTabs.push(arrAllTabs[i].id);
					oTabs['global'] = arrWTabs;
				}
				gCount++;
			}
			// Add to window-specific lists
			if (!(arrAllTabs[i].windowId in oTabs)) {
				oTabs[arrAllTabs[i].windowId] = [arrAllTabs[i].id];
			} else {
				arrWTabs = oTabs[arrAllTabs[i].windowId];
				if (arrWTabs.length < oPrefs.maxTabs) {
					arrWTabs.push(arrAllTabs[i].id);
					oTabs[arrAllTabs[i].windowId] = arrWTabs;
				}
			}
		}
	}).then(function(){
		// make current window's active tab the first in the global array if it isn't already
		browser.tabs.query({windowId: browser.windows.WINDOW_ID_CURRENT, active: true}).then((arrQTabs) => {
			if (arrQTabs.length < 1) console.log('Error getting active tab in current window');
			else {
				var arrWTabs = oTabs['global'];
				// Handle case of tabId in the existing list
				var pos = arrWTabs.indexOf(arrQTabs[0].id);
				if (pos > 0) { 
					// remove from its old position
					arrWTabs.splice(pos, 1);
					// add to front
					arrWTabs.unshift(arrQTabs[0].id);
					// don't check length because we didn't change it
					// store change
					oTabs['global'] = arrWTabs;
				} else if (pos == -1) {
					// not in list, add to front
					arrWTabs.unshift(arrQTabs[0].id);
					// check length and trim off the last if too long
					if (arrWTabs.length > oPrefs.maxGlobal) arrWTabs.pop();
					// store change
					oTabs['global'] = arrWTabs;
				} else {
					// this tab already is top-of-list so no action
				}
			}
			// Update toolbar button
			setButton(arrQTabs[0].windowId);
		})
	});
}

initObjects();

/**** Set up tab and window listeners to keep the data fresh ****/
var blnIsPrivate = false;

// Listen for tab activation and update oTabs
browser.tabs.onActivated.addListener((info) => {
	browser.tabs.get(info.tabId).then((currTab) => {
		// Update private window status
		if (currTab.incognito) blnIsPrivate = true;
		else blnIsPrivate = false;
		// Update global tabIds array
		var arrWTabs = oTabs['global'];
		//   Handle case of tabId in the existing list
		var pos = arrWTabs.indexOf(info.tabId);
		if (pos > 0) { 
			// remove from its old position
			arrWTabs.splice(pos, 1);
			// add to front
			arrWTabs.unshift(info.tabId);
			// don't check length because we didn't change it
			// store change
			oTabs['global'] = arrWTabs;
		} else if (pos == -1) {
			// not in list, add to front
			arrWTabs.unshift(info.tabId);
			// check length and trim off the last if too long
			if (arrWTabs.length > oPrefs.maxGlobal) arrWTabs.pop();
			// store change
			oTabs['global'] = arrWTabs;
		} else {
			// active tab already is top-of-list so no action
		}
		// Update window-specific tabIds array
		var arrWTabs = oTabs[info.windowId];
		if (!arrWTabs) {
			//   Handle case of new window, possibly a restored window with multiple tabs, so query it
			browser.tabs.query({windowId: info.windowId}).then((foundtabs) => {
				// Sort array of tab objects in descending order by lastAccessed (numeric)
				foundtabs.sort(function(a,b) {return (b.lastAccessed - a.lastAccessed);});
				for (i=0; i<foundtabs.length; i++){
					if (!(foundtabs[i].windowId in oTabs)) {
						oTabs[foundtabs[i].windowId] = [foundtabs[i].id];
					} else {
						arrWTabs = oTabs[foundtabs[i].windowId];
						if (arrWTabs.length < oPrefs.maxTabs) {
							arrWTabs.push(foundtabs[i].id);
							oTabs[foundtabs[i].windowId] = arrWTabs;
						}
					}
				}
			});
		} else {
			//   Handle case of tabId in the existing list
			var pos = arrWTabs.indexOf(info.tabId);
			if (pos > 0) { 
				// remove from its old position
				arrWTabs.splice(pos, 1);
				// add to front
				arrWTabs.unshift(info.tabId);
				// don't check length because we didn't change it
				// store change
				oTabs[info.windowId] = arrWTabs;
			} else if (pos == -1) {
				// not in list, add to front
				arrWTabs.unshift(info.tabId);
				// check length and trim off the last if too long
				if (arrWTabs.length > oPrefs.maxTabs) arrWTabs.pop();
				// store change
				oTabs[info.windowId] = arrWTabs;
			} else {
				// active tab already is top-of-list so no action
			}
		}
		// Update toolbar button
		setButton(info.windowId);
	}).catch((err) => {console.log('Promise rejected on tabs.get(): '+err.message);});
});

// Listen for tab removal and purge from oTabs
browser.tabs.onRemoved.addListener((id, info) => {
	// Update global tabIds array
	var arrWTabs = oTabs['global'];
	//   Handle case of tabId in the existing list
	var pos = arrWTabs.indexOf(id);
	if (pos > -1) { 
		// remove from its old position
		arrWTabs.splice(pos, 1);
		// store change
		oTabs['global'] = arrWTabs;
	}
	if (info.isWindowClosing == true){
		// remove the whole array for this window
		delete oTabs[info.windowId];
	} else {
		// Update window-specific tabIds array
		var arrWTabs = oTabs[info.windowId];
		//   Handle case of tabId in the existing list
		var pos = arrWTabs.indexOf(id);
		if (pos > -1) { 
			// remove from its old position
			arrWTabs.splice(pos, 1);
			// store change
			oTabs[info.windowId] = arrWTabs;
		}
		// Update toolbar button
		setButton(info.windowId);
	}
});

// Listen for tab detach and update oTabs
browser.tabs.onDetached.addListener((id, info) => {
	// No update to global tabIds array?
	// Update window-specific tabIds arrays
	//  Remove from old
	var arrWTabs = oTabs[info.oldWindowId];
	var pos = arrWTabs.indexOf(id);
	if (pos > -1) { 
		// remove from its old position
		arrWTabs.splice(pos, 1);
		// store change
		oTabs[info.oldWindowId] = arrWTabs;
	}
	//  Add to new
	browser.tabs.get(id).then((gotTab) => {
		// Update private window status
		if (gotTab.incognito) blnIsPrivate = true;
		else blnIsPrivate = false;		
		// Update window-specific tabIds array
		var arrWTabs = oTabs[gotTab.windowId];
		//   Handle case of new window (can't assume)
		if (!arrWTabs) {
			oTabs[gotTab.windowId] = [id];
			arrWTabs = oTabs[gotTab.windowId];
		}
		//   Handle case of tabId in the existing list
		var pos = arrWTabs.indexOf(id);
		if (pos > 0) { 
			// remove from its old position
			arrWTabs.splice(pos, 1);
			// add to front
			arrWTabs.unshift(id);
			// don't check length because we didn't change it
			// store change
			oTabs[gotTab.windowId] = arrWTabs;
		} else if (pos == -1) {
			// not in list, add to front
			arrWTabs.unshift(id);
			// check length and trim off the last if too long
			if (arrWTabs.length > oPrefs.maxTabs) arrWTabs.pop();
			// store change
			oTabs[gotTab.windowId] = arrWTabs;
		} else {
			// active tab already is top-of-list so no action
		}
		// Update toolbar button
		setButton(gotTab.windowId);
	});
});

// Listen for tab attach and update oTabs
browser.tabs.onAttached.addListener((id, info) => {
	// No update to global tabIds array?
	// Update window-specific tabIds arrays
	//  Add to new
	browser.tabs.get(id).then((gotTab) => {
		// Update private window status
		if (gotTab.incognito) blnIsPrivate = true;
		else blnIsPrivate = false;
		// Update window-specific tabIds array
		var arrWTabs = oTabs[info.newWindowId];
		//   Handle case of new window (can't assume)
		if (!arrWTabs) {
			oTabs[info.newWindowId] = [id];
			arrWTabs = oTabs[info.newWindowId];
		}
		//   Handle case of tabId in the existing list
		var pos = arrWTabs.indexOf(id);
		if (pos > 0) { 
			// remove from its old position
			arrWTabs.splice(pos, 1);
			// add to front
			arrWTabs.unshift(id);
			// don't check length because we didn't change it
			// store change
			oTabs[info.newWindowId] = arrWTabs;
		} else if (pos == -1) {
			// not in list, add to front
			arrWTabs.unshift(id);
			// check length and trim off the last if too long
			if (arrWTabs.length > oPrefs.maxTabs) arrWTabs.pop();
			// store change
			oTabs[info.newWindowId] = arrWTabs;
		} else {
			// active tab already is top-of-list so no action
		}
		// Update toolbar button
		setButton(info.newWindowId);
	});
});

// Listen for window close and purge from oTabs
browser.windows.onRemoved.addListener((wid) => {
	// remove the whole array for this window
	delete oTabs[wid];
	// Update toolbar button
	setButton(wid);
});

// Updates globals and fix toolbar button for current (newly focused) window
browser.windows.onFocusChanged.addListener((wid) => {
	browser.tabs.query({active:true, windowId: wid}).then((foundtabs) => {
		if (foundtabs.length < 1) return; // some weird window?
		// Update private window status
		if (foundtabs[0].incognito) blnIsPrivate = true;
		else blnIsPrivate = false;
		// Update toolbar button
		setButton(wid);
		// Update globals
		var arrWTabs = oTabs['global'];
		// Handle case of tabId in the existing list
		var pos = arrWTabs.indexOf(foundtabs[0].id);
		if (pos > 0) { 
			// remove from its old position
			arrWTabs.splice(pos, 1);
			// add to front
			arrWTabs.unshift(foundtabs[0].id);
			// don't check length because we didn't change it
			// store change
			oTabs['global'] = arrWTabs;
		} else if (pos == -1) {
			// not in list, add to front
			arrWTabs.unshift(foundtabs[0].id);
			// check length and trim off the last if too long
			if (arrWTabs.length > oPrefs.maxGlobal) arrWTabs.pop();
			// store change
			oTabs['global'] = arrWTabs;
		} else {
			// this tab already is top-of-list so no action
		}
	}).catch((err) => {console.log('Promise rejected on tabs.query(): '+err.message);});
});


/**** Set up toolbar button listener and button/tooltip toggler ****/

// Listen for button click and switch to previous tab
browser.browserAction.onClicked.addListener((currTab) => {
	if (oPrefs.blnButtonSwitches) {
		if (oPrefs.blnSameWindow) {
			// Within window switch
			doSwitch(currTab.windowId, currTab.windowId);
		} else {
			// Unrestricted switch
			doSwitch('global', currTab.windowId);
		}
	} else {
		if (oPrefs.blnSameWindow) {
			// Current window list
			oPrefs.popuptab = 0;
			browser.browserAction.setPopup({popup: browser.extension.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
		} else {
			// Global list
			oPrefs.popuptab = 1;
			browser.browserAction.setPopup({popup: browser.extension.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
		}		
	}
});

function doSwitch(oKey, wid){
	var arrWTabs = oTabs[oKey];
	if (arrWTabs && arrWTabs.length > 1) {
		browser.tabs.update(arrWTabs[1], {active:true}).then((currTab) => {
			if (currTab.windowId != wid) browser.windows.update(currTab.windowId, {focused: true});
		});
	}
}

// Set icon image and tooltip based on ability to switch within current window
function setButton(wid){
	if (blnIsPrivate && oPrefs.blnIncludePrivate === false && oPrefs.blnButtonSwitches){
		browser.browserAction.setIcon({path: 'icons/nolasttab.png'});
		browser.browserAction.setTitle({title: 'No Quick Switch in Private Window'});
		return;
	}
	var arrWTabs = oTabs[wid];
	if (!arrWTabs){
		// window focused but tab data not available yet; assume the worst
		browser.browserAction.setIcon({path: 'icons/nolasttab.png'});
		browser.browserAction.setTitle({title: 'Last Accessed Tab Not Available'});			
		return;
	}
	if (arrWTabs.length > 1 || (oPrefs.blnSameWindow === false && oTabs['global'].length > 1)) {
		browser.browserAction.setIcon({path: 'icons/lasttab.png'});
		browser.browserAction.setTitle({title: 'Switch to Last Accessed Tab'}); 
	} else {
		browser.browserAction.setIcon({path: 'icons/nolasttab.png'});
		browser.browserAction.setTitle({title: 'Last Accessed Tab Not Available'}); 
	}
}

/**** Toolbar Button context menu ****/

browser.menus.create({
  id: "bamenu_switchwindow",
  title: "Go to Last Tab in This Window",
  contexts: ["browser_action"]
});

browser.menus.create({
  id: "bamenu_switchglobal",
  title: "Go to Last Tab Anywhere",
  contexts: ["browser_action"]
});

browser.menus.create({
  id: "bamenu_popup",
  title: "List Recent Tabs",
  contexts: ["browser_action"]
});

browser.menus.create({
  id: "bamenu_options",
  title: "Options",
  contexts: ["browser_action"]
});

browser.menus.create({
  id: "bamenu_reload",
  title: "Reload All Tabs Options",
  contexts: ["browser_action"]
});

// Context menu for RELOAD ALL TABS
if (oRATprefs.RATactive === true){
	var RATtitle = '🔄 Reload All Tabs';
} else {
	var RATtitle = '🔄 Reload Other Tabs';
}

if (oRATprefs.RATpinned === false){
	RATtitle += ' (Non-Pinned)';
}
if (oRATprefs.RATbypasscache === true){
	RATtitle += ' (Bypass Cache)';
}
browser.menus.create({
  id: 'reload_all_tabs_Fx64',
  title: RATtitle,
  contexts: ["tab"]
});

browser.menus.onClicked.addListener((menuInfo, currTab) => {
	switch (menuInfo.menuItemId) {
		case 'bamenu_switchwindow':
			// Within window switch
			doSwitch(currTab.windowId, currTab.windowId);
			break;
		case 'bamenu_switchglobal':
			// Unrestricted switch
			doSwitch('global', currTab.windowId);
			break;
		case 'bamenu_popup':
			oPrefs.popuptab = 1;
			browser.browserAction.setPopup({popup: browser.extension.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
			break;
		case 'bamenu_options':
			oPrefs.popuptab = 2;
			browser.browserAction.setPopup({popup: browser.extension.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
			break;
		case 'bamenu_reload':
			oPrefs.popuptab = 3;
			browser.browserAction.setPopup({popup: browser.extension.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
			break;
		case 'reload_all_tabs_Fx64':
			// Check modifiers
			if (menuInfo.modifiers.includes('Ctrl')){
				// Ctrl+click should call up options
				oPrefs.popuptab = 3;
				browser.browserAction.setPopup({popup: browser.extension.getURL('popup.html')})
				.then(browser.browserAction.openPopup())
				.then(browser.browserAction.setPopup({popup: ''}));
			} else if (menuInfo.modifiers.includes('Shift')){
				// Shift+click should bypass cache
				reloadAll(currTab.windowId, true);
			} else {
				// Click should execute with current preferences
				reloadAll(currTab.windowId, oRATprefs.RATbypasscache);
			}
			break;
		default:
			// TBD
		}
});

/**** MESSAGING ****/

function handleMessage(request, sender, sendResponse) {
	if ("want" in request) {
		if (request.want == "global") {
			sendResponse({
				glist: oTabs['global']
			});
			return true;
		} else if (request.want == "settings") {
			sendResponse({
				response: oPrefs,
				RAT: oRATprefs
			})
		} else {
			sendResponse({
				wlist: oTabs[request.want]
			});
			return true;
		}
	} else if ("update" in request) {
		// receive form updates, store to oPrefs, and commit to storage
		var oSettings = request["update"];
		oPrefs.blnButtonSwitches = oSettings.blnButtonSwitches;
		oPrefs.blnSameWindow = oSettings.blnSameWindow;
		oPrefs.blnIncludePrivate = oSettings.blnIncludePrivate;
		oPrefs.blnShowFavicons = oSettings.blnShowFavicons;
		oPrefs.blnKeepOpen = oSettings.blnKeepOpen;
		oPrefs.blnDark = oSettings.blnDark;
		oPrefs.blnSansSerif = oSettings.blnSansSerif;
		oPrefs.strFontSize = oSettings.strFontSize;
		oPrefs.blnBoldTitle = oSettings.blnBoldTitle;
		oPrefs.blnBoldURL = oSettings.blnBoldURL;
		oPrefs.sectionHeight = oSettings.sectionHeight;
		browser.storage.local.set({prefs: oPrefs})
			.catch((err) => {console.log('Error on browser.storage.local.set(): '+err.message);});
	} else if ("updateRAT" in request) {
		// receive form updates, store to oRATprefs, and commit to storage
		var oSettings = request["updateRAT"];
		oRATprefs.RATactive = oSettings.RATactive;
		oRATprefs.RATpinned = oSettings.RATpinned;
		oRATprefs.RATdiscarded = oSettings.RATdiscarded;
		oRATprefs.RATskiploading = oSettings.RATskiploading;
		oRATprefs.RATsequential = oSettings.RATsequential;
		oRATprefs.RATseqnum = oSettings.RATseqnum;
		oRATprefs.RATbypasscache = oSettings.RATbypasscache;
		oRATprefs.RATplaying = oSettings.RATplaying;
		browser.storage.local.set({RATprefs: oRATprefs})
			.catch((err) => {console.log('Error on browser.storage.local.set(): '+err.message);});
	} else if ("reinit" in request) {
		if (request.reinit){
			initObjects();
		}
	}
}
browser.runtime.onMessage.addListener(handleMessage);

/**** RELOAD ALL TABS ****/

function reloadAll(windId, blnBypass){
	// Fetch current window tabs, use reverse order accessed
	browser.tabs.query({windowId: windId}).then((arrAllTabs) => {
		// Sort array of tab objects in descending order by lastAccessed (numeric)
		arrAllTabs.sort(function(a,b) {return (b.lastAccessed - a.lastAccessed);});
		// Check tab properties and start reloading
		var i, arrAudibleTabs = [];
		for (i=0; i<arrAllTabs.length; i++){
			// Check reloadability
			if ((arrAllTabs[i].active === false || oRATprefs.RATactive) &&
				(arrAllTabs[i].pinned === false || oRATprefs.RATpinned) &&
				(arrAllTabs[i].discarded === false || oRATprefs.RATdiscarded) &&
				(arrAllTabs[i].status != 'loading' || oRATprefs.RATskiploading === false))
			{
				// Check/handle playing tabs
				if (arrAllTabs[i].audible === false || oRATprefs.RATplaying == 'reload'){
					// or arrAllTabs[i].mutedInfo.muted == true ||  ??
					doTabReload(arrAllTabs[i], blnBypass);
				} else if (oRATprefs.RATplaying == 'ask'){
					// Add these to a list and deal with them last
					arrAudibleTabs.push(arrAllTabs[i]);
					console.log('[reloadAll] Playing tab queued TODO');
				} else {
					// console.log('[reloadAll] Playing tab SKIPPED');
				}
			}
		}
		// Deal with asking about playing tabs TODO
		if (arrAudibleTabs.length > 0){
			console.log(arrAudibleTabs);
			/*  This doesn't work:
			if (arrAudibleTabs.length == 1){
				if(window.confirm('Reload 1 tab with playing media?')){
					doTabReload(arrAudibleTabs[0], blnBypass);
				}
			} else {
				if(window.confirm('Reload ' + arrAudibleTabs.length + ' tabs with playing media?')){
					for (i=0; i<arrAudibleTabs.length; i++){
						doTabReload(arrAudibleTabs[i], blnBypass);
					}
				}
			}
			*/
			/*  This doesn't work:
			oPrefs.popuptab = 3;
			oRATprefs.asknow = true;
			browser.browserAction.setPopup({popup: browser.extension.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
			*/
		}
	})
}
let arrQueue = [], intLoading = 0;
function doTabReload(oTab, blnBypassCache){
	if (oRATprefs.RATsequential){
		arrQueue.push({index: oTab.id, tab: oTab, bypass: blnBypassCache, working: 'waiting'});
		if (intLoading === 0){
			// Define listener to check tab.status == 'completed' TODO
			browser.tabs.onUpdated.addListener(loadMonitor);
		}
		if (intLoading < oRATprefs.RATseqnum){
			for (var i=0; i<arrQueue.length; i++){
				if (arrQueue[i].working == 'waiting'){
					arrQueue[i].working = 'loading';
					// console.log('[doTabReload] Sending: '+oTab.id+' to doQueuedReload');
					doQueuedReload(oTab.id);
				}
			}
		} else {
			// console.log('[doTabReload] ' + oTab.id+' is going to have to wait');
		}
	} else {
		browser.tabs.reload(oTab.id, { bypassCache: blnBypassCache });
	}
}
async function doQueuedReload(index){
	// Find the queued task
	if (index > -1){
		var task = arrQueue.find( objTask => objTask.index === index );	
		// console.log('[doQueuedReload] Starting on '+task.index);		
	} else {
		for (var i=0; i<arrQueue.length; i++){
			if (arrQueue[i].working == 'waiting'){
				arrQueue[i].working = 'loading';
				var task = arrQueue[i];
				// console.log('[doQueuedReload] Starting on '+task.index+' (from queue)');
				break;
			}
		}
	}
	if (!task){
		// exhausted the queue, clear it if all tasks are done
		if (intLoading === 0){
			console.log('flushing arrQueue() and loadMonitor');
			arrQueue = [];
			browser.tabs.onUpdated.removeListener(loadMonitor);
		}
		return;
	}
	// Increment the running task counter
	intLoading++;
	// Reload the tab
	await browser.tabs.reload(task.index, { bypassCache: task.bypass }).then((retval) => {
		// loadMonitor should handle
	}).catch( (err) => {
		console.log('[doQueuedReload] Failed reloading ' + task.index + ': ' + err.message);
		// Decrement the running tasks?
		intLoading--;
		// Continue with the queue
		doQueuedReload(-1);
	});
}
function loadMonitor(tabId, changeInfo, oTab){
	if (!changeInfo.status || changeInfo.status == 'loading') return;
	console.log(changeInfo);
	var task = arrQueue.find( objTask => objTask.index === tabId );	
	if (task){
		task.working = 'complete';
		// Decrement the running tasks
		intLoading--;
		// console.log('intLoading decremented to ' + intLoading);
		// console.log('[loadMonitor] Successfully reloaded ' + task.index);
		// Continue with the queue
		doQueuedReload(-1);
	}
}