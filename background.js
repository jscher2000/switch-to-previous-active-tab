/* 
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  version 0.3 - revise and prepopulate data structure
  version 0.4 - add window/global switch, context menu items on toolbar button
  version 0.5 - add recent tabs list (requires tabs permission)
  version 0.6 - private windows excluded unless selected; handle detach/attach
  version 0.7 - popup list, add storage
  version 0.8 - refine popup behavior, color scheme/height options
  version 0.9 - option to show site icons on the popup, rebuild button ERROR
  version 1.0 - option to show site icons on the popup, rebuild button
  version 1.1 - don't build oRecent until the list is requested
  version 1.2 - fix bug in popup.js
  version 1.3 - adapt to new site icon storage in Fx63
  version 1.4 - more appearance options: sans-serif font, font-size, bold title, bold URL
  version 1.5 - Reload All Tabs (initial implementation), use HTML template instead of insertAdjacentHTML
  version 1.6 - Option to hide the Reload All Tabs command
  version 1.7 - Fix for 1.6
  version 1.8 - Handle keyboard shortcut (Alt+Shift+Left via manifest.json)
  version 1.8.1 - Change keyboard shortcut for Mac to avoid conflict with selecting to beginning of word
  version 1.8.2 - Bug fix for Global list not changing windows
  version 1.9 - For Reload All Tabs, option to automatically go to tabs needing attention
  version 1.9.5 - Bypass selected extension page (Panorama Tabs) for quick switch
  version 1.9.6 - Update color scheme options
  version 2.0 - Add tab skipping for hidden and discarded tabs for quick switch
  version 2.0.1 - Remove hidden tabs from lists by default
  version 2.0.2 - Bug fix for discarded tabs at startup
*/

/**** Create and populate data structure ****/
// Default starting values
var oPrefs = {
	maxTabs: 30,				// maximum tabIds to store per window
	maxGlobal: 60,				// maximum tabIds to store across all windows
	popuptab: 1,				// default tab in popup.html
	blnButtonSwitches: true,	// Whether button switches immediately or shows recents	
	blnSameWindow: true,		// Button switches within same window vs. global
	blnShowURLLine: true,		// Show URL on separate line in lists
	blnIncludePrivate: false,	// Include private window tabs
	blnShowFavicons: false,		// Whether to retrieve site icons on recents list
	blnKeepOpen: false,			// When switching in the same window, keep popup open (default switched in v2.0)
	blnDark: undefined,			// Toggle colors to bright-on-dark (true=dark, false=light, undefined=auto)
	blnColorbars: true,			// Use color bar background for list (true=blue, false=gray, undefined=mono)
	blnSansSerif: false,		// Whether to use the default sans-serif font
	strFontSize: "14px",		// Default font size for popup
	blnBoldTitle: false,		// Whether to bold the window title
	blnBoldURL: false,			// Whether to bold the page URL
	sectionHeight: "490px",		// Height of list panel sections
	blnSkipDiscarded: true,		// Whether to skip discarded tabs in quick switch
	blnSkipHidden: true,		// Whether to skip hidden tabs in quick switch/omit from lists
	extPageSkipTitle: ['Panorama View'],
	extPageSkipUrl: []
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
	// version 2.0.2 (this was running asynchronously with default preferences in 2.0.1 and earlier)
	initObjects();
}).catch((err) => {console.log('Error retrieving "prefs" from storage: '+err.message);});

// Preferences for RELOAD ALL TABS
var RATitem = null; // for context menu item
var oRATprefs = {
	RATshowcommand: true,		// Show Reload All Tabs on the menu
	RATactive: true,			// whether to include the active tab
	RATpinned: true,			// whether to include pinned tabs
	RATdiscarded: true,			// whether to include discarded tabs
	RATskiploading: true,		// whether to skip reloading tabs that are still loading
	RATsequential: true,		// use sequential (false = don't wait)
	RATseqnum: 3,				// simultaneous requests if RATsequential == true
	RATbypasscache: false,		// always bypass cache (false = bypass on Shift+click)
	RATplaying: 'skip',			// how to handle tabs with audible media (ask, skip, reload)
	asknow: false,				// Flag to show user buttons about playing tabs
	RATgotoAttn: false			// Automatically go to tabs needing attention
}

// Update oRATprefs from storage, set up the context menu item
browser.storage.local.get("RATprefs").then((results) => {
	if (results.RATprefs != undefined){
		if (JSON.stringify(results.RATprefs) != '{}'){
			var arrSavedPrefs = Object.keys(results.RATprefs)
			for (var j=0; j<arrSavedPrefs.length; j++){
				oRATprefs[arrSavedPrefs[j]] = results.RATprefs[arrSavedPrefs[j]];
			}
		}
	}
	RATmenusetup();
}).catch((err) => {console.log('Error retrieving "RATprefs" from storage: '+err.message);});

var oTabs = {};			// store arrays of tabId's in descending order by lastAccessed

function initObjects(){
	// Initialize oTabs object with up to maxTabs recent tabs per window
	oTabs = {}; // flush
	var params = {};
	if (oPrefs.blnSkipHidden){
		params.hidden = false;
	}
	browser.tabs.query(params).then((arrAllTabs) => {
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
			// Add extension page to skip list if needed (v1.9.5)
			if (oPrefs.extPageSkipTitle.includes(arrAllTabs[i].title) && arrAllTabs[i].url.indexOf('moz-extension:') === 0 || 
				oPrefs.extPageSkipUrl.includes(arrAllTabs[i].url) ) {
				if (!('skip' in oTabs)) {
					oTabs['skip'] = [arrAllTabs[i].id];
				} else {
					arrWTabs = oTabs['skip'];
					arrWTabs.push(arrAllTabs[i].id);
					oTabs['skip'] = arrWTabs;
				}
			}
			// Add discarded tab to skip list if needed (v2.0.1)
			if (oPrefs.blnSkipDiscarded && arrAllTabs[i].discarded) {
				if (!('skip' in oTabs)) {
					oTabs['skip'] = [arrAllTabs[i].id];
				} else {
					arrWTabs = oTabs['skip'];
					arrWTabs.push(arrAllTabs[i].id);
					oTabs['skip'] = arrWTabs;
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
		// Add extension page to skip list if needed (v1.9.5)
		if (oPrefs.extPageSkipTitle.includes(currTab.title) && currTab.url.indexOf('moz-extension:') === 0 || 
			oPrefs.extPageSkipUrl.includes(currTab.url) ) {
			if (!('skip' in oTabs)) {
				oTabs['skip'] = [info.tabId];
			} else {
				arrWTabs = oTabs['skip'];
				// Add if tabId is not in the existing list
				var pos = arrWTabs.indexOf(info.tabId);
				if (pos == -1) {
					arrWTabs.push(info.tabId);
					oTabs['skip'] = arrWTabs;
				}
			}
		}
		// Add discarded tab to skip list if needed (v2.0/.1)
		if (oPrefs.blnSkipDiscarded && currTab.discarded) {
			if (!('skip' in oTabs)) {
				oTabs['skip'] = [info.tabId];
			} else {
				arrWTabs = oTabs['skip'];
				arrWTabs.push(info.tabId);
				oTabs['skip'] = arrWTabs;
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
	// Remove from skip list if needed (v1.9.5)
	if (('skip' in oTabs)) {
		arrWTabs = oTabs['skip'];
		pos = arrWTabs.indexOf(id);
		if (pos > -1) { 
			// remove from its old position
			arrWTabs.splice(pos, 1);
			// store change
			oTabs['skip'] = arrWTabs;
		}
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

// Listen for tab updates - discarded and hidden (v2.0)
function updateSkipList(tabId, changeInfo, oTab){
	if (oPrefs.blnSkipDiscarded && changeInfo.discarded) { // add to skip list
		if (!('skip' in oTabs)) {
			oTabs['skip'] = [tabId];
		} else {
			var arrWTabs = oTabs['skip'];
			if (arrWTabs.includes(tabId) === false){ // Let's not duplicate
				arrWTabs.push(tabId);
				oTabs['skip'] = arrWTabs;
			}
		}
	} else { // remove from skip list, except skippable extension pages
		if (('skip' in oTabs) && 
				!(oPrefs.extPageSkipTitle.includes(oTab.title) && oTab.url.indexOf('moz-extension:') === 0 || 
				oPrefs.extPageSkipUrl.includes(oTab.url))) {
			arrWTabs = oTabs['skip'];
			var pos = arrWTabs.indexOf(tabId);
			if (pos > -1) { 
				// remove from the array
				arrWTabs.splice(pos, 1);
				// store change
				oTabs['skip'] = arrWTabs;
			}
		}
	}
	if (oPrefs.blnSkipHidden && changeInfo.hasOwnProperty('hidden')) { // remove from tab lists (v2.0.1)
		if (changeInfo.hidden == true){
			// Update global tabIds array
			var arrWTabs = oTabs['global'];
			//   Handle case of tabId in the existing list
			var pos = arrWTabs.indexOf(tabId);
			if (pos > -1) { 
				// remove from its old position
				arrWTabs.splice(pos, 1);
				// store change
				oTabs['global'] = arrWTabs;
			}
			// Update window-specific tabIds array
			var arrWTabs = oTabs[oTab.windowId];
			//   Handle case of tabId in the existing list
			var pos = arrWTabs.indexOf(tabId);
			if (pos > -1) { 
				// remove from its old position
				arrWTabs.splice(pos, 1);
				// store change
				oTabs[oTab.windowId] = arrWTabs;
			}
			// Update toolbar button
			setButton(oTab.windowId);
		} else {
			// it's back!!
			// Update private window status
			if (oTab.incognito) blnIsPrivate = true;
			else blnIsPrivate = false;
			// Update global tabIds array
			var arrWTabs = oTabs['global'];
			//   Do not re-add if it exists
			var pos = arrWTabs.indexOf(tabId);
			if (pos == -1) {
				// not in list, add to front
				arrWTabs.unshift(tabId);
				// store change
				oTabs['global'] = arrWTabs;
			}
			// Update window-specific tabIds array
			var arrWTabs = oTabs[oTab.windowId];
			if (!arrWTabs) {
				//   Handle case of new window, possibly a restored window with multiple tabs, so query it
				browser.tabs.query({windowId: oTab.windowId}).then((foundtabs) => {
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
				//   Do not re-add if it exists
				var pos = arrWTabs.indexOf(tabId);
				if (pos == -1) {
					// not in list, add to front
					arrWTabs.unshift(tabId);
					// check length and trim off the last if too long
					if (arrWTabs.length > oPrefs.maxTabs) arrWTabs.pop();
					// store change
					oTabs[oTab.windowId] = arrWTabs;
				}
			}
			// fix sort order
			browser.tabs.query({}).then((arrAllTabs) => {
				// Update window-specific tabIds array
				var arrWTabs = oTabs[oTab.windowId];
				arrWTabs.sort(function(a,b) {
					var aObj = arrAllTabs.find(oT => oT.id === a);
					var bObj = arrAllTabs.find(oT => oT.id === b);
					return (bObj.lastAccessed - aObj.lastAccessed);
				});
				// store sorted list
				oTabs[oTab.windowId] = arrWTabs;
				// Update global tabIds array
				arrWTabs = oTabs['global'];
				arrWTabs.sort(function(a,b) {
					var aObj = arrAllTabs.find(oT => oT.id === a);
					var bObj = arrAllTabs.find(oT => oT.id === b);
					return (bObj.lastAccessed - aObj.lastAccessed);
				});
				// store sorted list
				oTabs['global'] = arrWTabs;
			});
		}
	} else { // remove from skip list, except skippable extension pages
		if (('skip' in oTabs) && 
				!(oPrefs.extPageSkipTitle.includes(oTab.title) && oTab.url.indexOf('moz-extension:') === 0 || 
				oPrefs.extPageSkipUrl.includes(oTab.url))) {
			arrWTabs = oTabs['skip'];
			var pos = arrWTabs.indexOf(tabId);
			if (pos > -1) { 
				// remove from the array
				arrWTabs.splice(pos, 1);
				// store change
				oTabs['skip'] = arrWTabs;
			}
		}
	}
}
browser.tabs.onUpdated.addListener(updateSkipList, {properties: ["discarded", "hidden"]});

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
			browser.browserAction.setPopup({popup: browser.runtime.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
		} else {
			// Global list
			oPrefs.popuptab = 1;
			browser.browserAction.setPopup({popup: browser.runtime.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
		}		
	}
});

function doSwitch(oKey, wid){
	var arrWTabs = oTabs[oKey];
	if (arrWTabs && arrWTabs.length > 1) {
		newTabIndex = 1;
		if (oTabs['skip'] && oTabs['skip'].length > 0){
			while (newTabIndex < arrWTabs.length + 1){
				if (!oTabs['skip'].includes(arrWTabs[newTabIndex])) break;
				newTabIndex++
			}
		}
		browser.tabs.update(arrWTabs[newTabIndex], {active:true}).then((currTab) => {
			if (currTab.windowId != wid) browser.windows.update(currTab.windowId, {focused: true});
		});
	}
}

// Set icon image and tooltip based on ability to switch within current window
function setButton(wid){
	if (blnIsPrivate && oPrefs.blnIncludePrivate === false && oPrefs.blnButtonSwitches){
		browser.browserAction.setIcon({path: 'icons/nolasttab-32.png'});
		browser.browserAction.setTitle({title: 'No Quick Switch in Private Window'});
		return;
	}
	var arrWTabs = oTabs[wid];
	if (!arrWTabs){
		// window focused but tab data not available yet; assume the worst
		browser.browserAction.setIcon({path: 'icons/nolasttab-32.png'});
		browser.browserAction.setTitle({title: 'Last Accessed Tab Not Available'});			
		return;
	}
	if (arrWTabs.length > 1 || (oPrefs.blnSameWindow === false && oTabs['global'].length > 1)) {
		if (oPrefs.blnDark === true || (oPrefs.blnDark === undefined && window.matchMedia('(prefers-color-scheme: dark)').matches)) browser.browserAction.setIcon({path: 'icons/lasttab-32-light.png'});
		else browser.browserAction.setIcon({path: 'icons/lasttab-32.png'});
		browser.browserAction.setTitle({title: 'Switch to Last Accessed Tab'}); 
	} else {
		browser.browserAction.setIcon({path: 'icons/nolasttab-32.png'});
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
function RATmenusetup(){
	if (oRATprefs.RATshowcommand === true && RATitem === null){
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
		RATitem = browser.menus.create({
		  id: 'reload_all_tabs_Fx64',
		  title: RATtitle,
		  contexts: ["tab"]
		});
	} else if (oRATprefs.RATshowcommand === false && RATitem !== null) {
		browser.menus.remove('reload_all_tabs_Fx64').catch( (err) => {
			console.log('Error removing RAT menu item: ' + err.description) 
		});
		RATitem = null;
	}
}

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
			browser.browserAction.setPopup({popup: browser.runtime.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
			break;
		case 'bamenu_options':
			oPrefs.popuptab = 2;
			browser.browserAction.setPopup({popup: browser.runtime.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
			break;
		case 'bamenu_reload':
			oPrefs.popuptab = 3;
			browser.browserAction.setPopup({popup: browser.runtime.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
			break;
		case 'reload_all_tabs_Fx64':
			// Check modifiers
			if (menuInfo.modifiers.includes('Ctrl')){
				// Ctrl+click should call up options 
				// Use popup window in case browserAction is overflowed or removed
				oPrefs.popuptab = 3;
				browser.windows.create({
					url: browser.runtime.getURL('popup.html'),
					type: 'popup', state: 'normal',
					top: 50, width: 698, height: 588
				});
			} else if (menuInfo.modifiers.includes('Shift')){
				// Shift+click should bypass cache
				reloadAll(currTab.id, currTab.windowId, true);
			} else {
				// Click should execute with current preferences
				reloadAll(currTab.id, currTab.windowId, oRATprefs.RATbypasscache);
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
		} else if (request.want == "skip") {
			if (!oTabs['skip']){
				oTabs['skip'] = [];
			}
			sendResponse({
				list: oTabs['skip']
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
		oPrefs.blnShowURLLine = oSettings.blnShowURLLine;
		oPrefs.blnIncludePrivate = oSettings.blnIncludePrivate;
		oPrefs.blnShowFavicons = oSettings.blnShowFavicons;
		oPrefs.blnKeepOpen = oSettings.blnKeepOpen;
		oPrefs.blnDark = oSettings.blnDark;
		oPrefs.blnColorbars = oSettings.blnColorbars;
		oPrefs.blnSansSerif = oSettings.blnSansSerif;
		oPrefs.strFontSize = oSettings.strFontSize;
		oPrefs.blnBoldTitle = oSettings.blnBoldTitle;
		oPrefs.blnBoldURL = oSettings.blnBoldURL;
		oPrefs.sectionHeight = oSettings.sectionHeight;
		var doReinit = false;
		if (oPrefs.blnSkipDiscarded != oSettings.blnSkipDiscarded || oPrefs.blnSkipHidden != oSettings.blnSkipHidden){
			doReinit = true; // rebuild the arrays to fix the skip list
		}
		oPrefs.blnSkipDiscarded = oSettings.blnSkipDiscarded;
		oPrefs.blnSkipHidden = oSettings.blnSkipHidden;
		browser.storage.local.set({prefs: oPrefs})
			.catch((err) => {console.log('Error on browser.storage.local.set(): '+err.message);});
		if (doReinit) initObjects();
	} else if ("updateRAT" in request) {
		// receive form updates, store to oRATprefs, and commit to storage
		var oSettings = request["updateRAT"];
		oRATprefs.RATshowcommand = oSettings.RATshowcommand;
		oRATprefs.RATactive = oSettings.RATactive;
		oRATprefs.RATpinned = oSettings.RATpinned;
		oRATprefs.RATdiscarded = oSettings.RATdiscarded;
		oRATprefs.RATskiploading = oSettings.RATskiploading;
		oRATprefs.RATsequential = oSettings.RATsequential;
		oRATprefs.RATseqnum = oSettings.RATseqnum;
		oRATprefs.RATbypasscache = oSettings.RATbypasscache;
		oRATprefs.RATplaying = oSettings.RATplaying;
		oRATprefs.RATgotoAttn = oSettings.RATgotoAttn;
		browser.storage.local.set({RATprefs: oRATprefs})
			.catch((err) => {console.log('Error on browser.storage.local.set(): '+err.message);});
		RATmenusetup();
	} else if ("reinit" in request) {
		if (request.reinit){
			initObjects();
		}
	}
}
browser.runtime.onMessage.addListener(handleMessage);

/**** RELOAD ALL TABS ****/

let arrQueue = [], intLoading = 0, attnQueue = [], attnCurrent = 0, attnReturn = 0;
function reloadAll(currentTabId, windId, blnBypass){
	if (oRATprefs.RATgotoAttn) {
		// Define listener to handle tabs needing attention (e.g., re-POST)
		browser.tabs.onUpdated.addListener(attnHandler);
		attnQueue = []; 
		attnCurrent = 0;
		attnReturn = currentTabId;
	}
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
			browser.browserAction.setPopup({popup: browser.runtime.getURL('popup.html')})
			.then(browser.browserAction.openPopup())
			.then(browser.browserAction.setPopup({popup: ''}));
			*/
		}
	})
}
function doTabReload(oTab, blnBypassCache){
	if (oRATprefs.RATsequential){
		arrQueue.push({index: oTab.id, tab: oTab, bypass: blnBypassCache, working: 'waiting'});
		if (intLoading === 0){
			// Define listener to check tab.status == 'completed'
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
function attnHandler(tabId, changeInfo, oTab){
	if (changeInfo.attention){
		// Keep track of tabs needing attention and visit them sequentially
		attnQueue.push(tabId);
		if (attnCurrent === 0){
			attnCurrent = tabId;
			browser.tabs.update(attnCurrent, {active:true});
		}
		//console.log(attnQueue);
	} else if (changeInfo.status && tabId == attnCurrent){
		if (changeInfo.status == 'loading'){
			// This one is reloading, we can move on
			//console.log(attnQueue);
			// Take this tab off the list
			var index = attnQueue.indexOf(tabId);
			if (index !== -1) attnQueue.splice(index, 1);
			//console.log(attnQueue);
			// Go to the next one
			if (attnQueue.length > 0){
				attnCurrent = attnQueue[0];
				browser.tabs.update(attnCurrent, {active:true});
			} else if (attnReturn !== 0){
				browser.tabs.update(attnReturn, {active:true});
			}
		}
	}
}

/**** Keyboard shortcut handler ****/
browser.commands.onCommand.addListener(strName => {
	if (strName === 'previous-tab'){
		// Within window switch (first need to get the current window)
		browser.windows.getCurrent().then((currWin) => {
			doSwitch(currWin.id, currWin.id);
		})
	}
})