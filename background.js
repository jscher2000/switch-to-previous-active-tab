/* 
  Copyright 2018. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Revision 0.3 - revise and prepopulate data structure
  Revision 0.4 - add window/global switch, context menu items on toolbar button
  Revision 0.5 - add recent tabs list (requires tabs permission)
  Revision 0.6 - private windows excluded unless selected; handle detach/attach
  Revision 0.7 - popup list, add storage
*/

/**** Create and populate data structure ****/
// Default starting values
var oPrefs = {
	maxTabs: 15,				// maximum tabIds to store per window
	maxGlobal: 60,				// maximum tabIds to store across all windows
	popuptab: 1,				// default tab in popup.html
	blnButtonSwitches: true,	// Whether button switches immediately or shows recents	
	blnSameWindow: true,		// Button switches within same window vs. global
	blnIncludePrivate: false,	// Include private window tabs
	blnShowFavicons: false		// Whether to show site icons on recents list
}
// Update oPrefs from storage
browser.storage.local.get("prefs").then((results) => {
	if (JSON.stringify(results) != '{}') oPrefs = results.prefs;
}).catch((err) => {console.log('Error retrieving storage: '+err.message);});

var oTabs = {};			// store arrays of tabId's in descending order by lastAccessed
var oRecent = {};		// store titles and URLs for MRU popup

function initObjects(){
	// Initialize oTabs object with up to maxTabs recent tabs per window
	browser.tabs.query({}).then((arrAllTabs) => {
		// Sort array of tab objects in descending order by lastAccessed (numeric)
		arrAllTabs.sort(function(a,b) {return (b.lastAccessed - a.lastAccessed);});
		// Store tabIds to oTabs
		var i, gCount = 0, arrWTabs;
		for (i=0; i<arrAllTabs.length; i++){
			if (oPrefs.blnIncludePrivate == true || arrAllTabs[i].incognito === false){
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
		}
		//console.log('initialized => '+JSON.stringify(oTabs));
	}).then(function(){
		// make current window's active tab the first in the global array if it isn't already
		browser.tabs.query({windowId: browser.windows.WINDOW_ID_CURRENT, active: true}).then((arrQTabs) => {
			if (arrQTabs.length < 1) console.log('Error getting active tab in current window');
			else {
				if (oPrefs.blnIncludePrivate == true || arrQTabs[0].incognito === false){
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
					//console.log('global-update => '+JSON.stringify(oTabs));
				}

				// Update toolbar button
				setButton(arrQTabs[0].windowId);
			}
		})
	}).then(function(){
		// Populate oRecent
		var arrWTabs = oTabs['global'];
		for (var j=0; j<arrWTabs.length; j++){
			updateRecent(arrWTabs[j]);
		}
	});
}

initObjects();

/**** Set up tab and window listeners to keep the data fresh ****/

// Listen for tab activation and update oTabs
browser.tabs.onActivated.addListener((info) => {
	//console.log('Handling onActivated for id: '+info.tabId);
	browser.tabs.get(info.tabId).then((currTab) => {
		if (oPrefs.blnIncludePrivate == true || currTab.incognito === false){
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
			//console.log('onActivated => '+JSON.stringify(oTabs));

			// Update toolbar button
			setButton(info.windowId);
			
			// Update Recents
			updateRecent(info.tabId);
		}
	}).catch((err) => {console.log('Promise rejected on tabs.get(): '+err.message);});
});


// Listen for tab removal and purge from oTabs
browser.tabs.onRemoved.addListener((id, info) => {
	//console.log('Handling onRemoved for id: '+id);
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
		//console.log('onRemoved => '+JSON.stringify(oTabs));

		// Update toolbar button
		setButton(info.windowId);
	}

	// Update Recents
	if (id in oRecent) delete oRecent[id];
});

// Listen for tab detach and update oTabs
browser.tabs.onDetached.addListener((id, info) => {
	//console.log('Handling onDetached for id: '+id);
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
		if (oPrefs.blnIncludePrivate == true || gotTab.incognito === false){
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
			//console.log('tab-detached: '+id+' => '+JSON.stringify(oTabs));
		}
	});

	// Update Recents
	updateRecent(id);
});

// Listen for tab attach and update oTabs
browser.tabs.onAttached.addListener((id, info) => {
	//console.log('Handling onAttached for id: '+id);
	// No update to global tabIds array?
	
	// Update window-specific tabIds arrays
	//  Add to new
	browser.tabs.get(id).then((gotTab) => {
		if (oPrefs.blnIncludePrivate == true || gotTab.incognito === false){
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
			//console.log('tab-attached: '+id+' => '+JSON.stringify(oTabs));
		}
	});

	// Update Recents
	updateRecent(id);
});


// Listen for window close and purge from oTabs
browser.windows.onRemoved.addListener((wid) => {
	//console.log('Handling window.onRemoved for wid: '+wid);
	// remove the whole array for this window
	delete oTabs[wid];
	// Update toolbar button
	setButton(wid);
	//console.log('window-removed: '+wid+' => '+JSON.stringify(oTabs));
});

// Updates globals and fix toolbar button for current (newly focused) window
browser.windows.onFocusChanged.addListener((wid) => {
	//console.log('Handling onFocusChanged for wid: '+wid);
	browser.tabs.query({active:true, windowId: wid}).then((foundtabs) => {
		if (foundtabs.length < 1) return; // some weird window?
		// Update toolbar button
		setButton(wid);
		if (oPrefs.blnIncludePrivate == true || foundtabs[0].incognito === false){
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
			//console.log('window-focused => '+JSON.stringify(oTabs));

			// Update Recents
			updateRecent(foundtabs[0].id);
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
	// TODO: dim icon in private windows if nonfunctional there
	var arrWTabs = oTabs[wid];
	if (!arrWTabs) return; // window focused but tab data not available yet
	if (arrWTabs.length > 1) {
		browser.browserAction.setIcon({path: 'icons/lasttab.png'});
		browser.browserAction.setTitle({title: 'Switch to Last Accessed Tab'}); 
	} else if (oPrefs.blnSameWindow || oTabs['global'].length < 2) {
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
		default:
			// TBD
		}
});

/**** "Recent List" Functions ****/
var dNow = new Date(); 
var dMidnight = new Date(dNow.getFullYear(), dNow.getMonth(), dNow.getDate(), 0, 0, 0); 

function updateRecent(tid){
	// Populate oRecent for this tab (if necessary)
	browser.tabs.get(tid).then((currTab) => {
		if (!(tid in oRecent)){
			oRecent[tid] = {"url":null, "title":null, "time":null};
		}
		oRecent[tid].url = currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '');
		oRecent[tid].title = currTab.title;
		oRecent[tid].time = (currTab.lastAccessed > dMidnight) ? new Date(currTab.lastAccessed).toLocaleTimeString() : new Date(currTab.lastAccessed).toLocaleDateString();
		oRecent[tid].incog = currTab.incognito;
		oRecent[tid].imgPath = (currTab.incognito) ? 'icons/privateBrowsing.svg' : 'icons/defaultFavicon.svg';
		//oRecent[tid].icon = (currTab.favIconUrl) ? currTab.favIconUrl : "icons/defaultFavicon.svg";
	});
}

var recentIds = {};

browser.tabs.onUpdated.addListener((tid, chgInfo, currTab) => {
	if ('url' in chgInfo){
		if (tid in oRecent){
			if (oRecent[tid].url != currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '')){
				oRecent[tid].url = currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '');
				oRecent[tid].title = currTab.title;
				oRecent[tid].time = (currTab.lastAccessed > dMidnight) ? new Date(currTab.lastAccessed).toLocaleTimeString() : new Date(currTab.lastAccessed).toLocaleDateString();
				oRecent[tid].incog = currTab.incognito;
				oRecent[tid].imgPath = (currTab.incognito) ? 'icons/privateBrowsing.svg' : 'icons/defaultFavicon.svg';
				//oRecent[tid].icon = (currTab.favIconUrl) ? currTab.favIconUrl : "icons/defaultFavicon.svg";
			}
		}
	}
});

/**** MESSAGING ****/

function handleMessage(request, sender, sendResponse) {
	if ("want" in request) {
		if (request.want == "global") {
			var oGlobal = {};
			oGlobal['glist'] = oTabs['global'];
			oGlobal['details'] = oRecent;
			sendResponse({
				response: oGlobal
			});
			return true;
		} else if (request.want == "settings") {
			sendResponse({
				response: oPrefs
			})
		} else {
			var oWindow = {};
			oWindow['wlist'] = oTabs[request.want];
			oWindow['details'] = oRecent;
			sendResponse({
				response: oWindow
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
		browser.storage.local.set({prefs: oPrefs})
			.catch((err) => {console.log('Error on browser.storage.local.set(): '+err.message);});
	}
}
browser.runtime.onMessage.addListener(handleMessage);
