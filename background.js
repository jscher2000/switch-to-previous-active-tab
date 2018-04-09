/* 
  Copyright 2018. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Revision 0.3 - revise and prepopulate data structure
  Revision 0.4 - add window/global switch, context menu items on toolbar button
  Revision 0.5 - add recent tabs list (requires tabs permission)
  Revision 0.6 - private windows excluded unless selected; handle detach/attach
*/

/**** Create and populate data structure ****/

// TODO make this user configurable
var maxTabs = 5;      // maximum tabIds to store per window
var maxGlobal = 15;   // maximum tabIds to store across all windows

var oTabs = {};
var oRecent = {};
function initObjects(){
	// Initialize oTabs object with up to maxTabs recent tabs per window
	browser.tabs.query({}).then((arrAllTabs) => {
		// Sort array of tab objects in descending order by lastAccessed (numeric)
		arrAllTabs.sort(function(a,b) {return (b.lastAccessed - a.lastAccessed);});
		// Store tabIds to oTabs
		var i, gCount = 0, arrWTabs;
		for (i=0; i<arrAllTabs.length; i++){
			if (blnIgnorePrivate === false || arrAllTabs[i].incognito != true){
				// Add to global list for i=0 through maxGlobal-1 (order among windows is unpredictable)
				if (gCount < maxGlobal) {
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
					if (arrWTabs.length < maxTabs) {
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
				if (blnIgnorePrivate === false || arrQTabs[0].incognito != true){
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
						if (arrWTabs.length > maxGlobal) arrWTabs.pop();
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
		if (blnIgnorePrivate === false || currTab.incognito != true){
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
				if (arrWTabs.length > maxGlobal) arrWTabs.pop();
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
							if (arrWTabs.length < maxTabs) {
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
					if (arrWTabs.length > maxTabs) arrWTabs.pop();
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
			updateRecentMenu();
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
	updateRecentMenu();
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
		if (blnIgnorePrivate === false || gotTab.incognito != true){
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
				if (arrWTabs.length > maxTabs) arrWTabs.pop();
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
	updateRecentMenu();
});

// Listen for tab attach and update oTabs
browser.tabs.onAttached.addListener((id, info) => {
	//console.log('Handling onAttached for id: '+id);
	// No update to global tabIds array?
	
	// Update window-specific tabIds arrays
	//  Add to new
	browser.tabs.get(id).then((gotTab) => {
		if (blnIgnorePrivate === false || gotTab.incognito != true){
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
				if (arrWTabs.length > maxTabs) arrWTabs.pop();
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
	updateRecentMenu();
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
		if (blnIgnorePrivate === false || foundtabs[0].incognito != true){
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
				if (arrWTabs.length > maxGlobal) arrWTabs.pop();
				// store change
				oTabs['global'] = arrWTabs;
			} else {
				// this tab already is top-of-list so no action
			}
			//console.log('window-focused => '+JSON.stringify(oTabs));

			// Update Recents
			updateRecent(foundtabs[0].id);
			updateRecentMenu();
		}
	}).catch((err) => {console.log('Promise rejected on tabs.query(): '+err.message);});
});


/**** Set up toolbar button listener and button/tooltip toggler ****/

var blnSameWindow = true;
var blnIgnorePrivate = true;

// Listen for button click and switch to previous tab
browser.browserAction.onClicked.addListener((currTab) => {
	if (blnSameWindow) {
		// Within window switch
		doSwitch(currTab.windowId, currTab.windowId);
	} else {
		// Unrestricted switch
		doSwitch('global', currTab.windowId);
	}
});

function doSwitch(oKey, wid){
	var arrWTabs = oTabs[oKey];
	if (arrWTabs.length > 1) {
		browser.tabs.update(arrWTabs[1], {active:true}).then((currTab) => {
			if (currTab.windowId != wid) browser.windows.update(currTab.windowId, {focused: true});
		});
	}
}

// Set icon image and tooltip based on ability to switch within current window
function setButton(wid){
	var arrWTabs = oTabs[wid];
	if (!arrWTabs) return; // window focused but tab data not available yet
	if (arrWTabs.length > 1) {
		browser.browserAction.setIcon({path: 'icons/lasttab.png'});
		browser.browserAction.setTitle({title: 'Switch to Last Accessed Tab'}); 
	} else if (blnSameWindow || oTabs['global'].length < 2) {
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
  id: "bamenu_chk_window",
  type: "checkbox",
  title: "Button Switches Within the Same Window",
  contexts: ["browser_action"],
  checked: blnSameWindow
});

browser.menus.create({
  id: "bamenu_chk_private",
  type: "checkbox",
  title: "Ignore Private Window Tabs",
  contexts: ["browser_action"],
  checked: blnIgnorePrivate
});

browser.menus.create({
  id: "bamenu_recentlist",
  title: "Recently Active Tabs",
  contexts: ["browser_action"]
});

for (var j=0; j<maxGlobal; j++){
	browser.menus.create({
		id: "recent"+j,
		title: "TBD",
		contexts: ["browser_action"],
		parentId: "bamenu_recentlist"
	});
}

browser.menus.create({
  id: "bamenu_endseparator",
  type: "separator",
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
		case 'bamenu_chk_window':
			if (menuInfo.checked) blnSameWindow = true;
			else blnSameWindow = false;
			setButton(currTab.windowId);
			break;
		case 'bamenu_chk_private':
			if (menuInfo.checked) blnIgnorePrivate = true;
			else blnIgnorePrivate = false;
			// Rebuild lists immediately
			oTabs['global'] = [];
			initObjects();
			break;
		case 'bamenu_recentlist':
			// Refresh/build submenu items?
			break;
		default:
			// Handle the "recent" list
			if (menuInfo.parentMenuItemId == 'bamenu_recentlist'){
				if (recentIds[menuInfo.menuItemId] != 'noop'){
					browser.tabs.update(recentIds[menuInfo.menuItemId], {active:true}).then((newTab) => {
						if (newTab.windowId != currTab.windowId) browser.windows.update(newTab.windowId, {focused: true});
					});
				}
				break;
			}
	}
});

/**** "Recent List" Functions ****/

function updateRecent(tid){
	// Populate oRecent for this tab (if necessary)
	browser.tabs.get(tid).then((currTab) => {
		if (!(tid in oRecent)){
			oRecent[tid] = {"url":null, "title":null, "time":null};
		}
		oRecent[tid].url = currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '');
		oRecent[tid].title = currTab.title;
		oRecent[tid].time = new Date(currTab.lastAccessed).toLocaleTimeString();
		oRecent[tid].incog = (currTab.incognito) ? '{p} ' : '';
		// console.log('oRecent => '+JSON.stringify(oRecent));
	});
}

var recentIds = {};

// Update context menu list (last accessed tab history)
function updateRecentMenu(){
	var arrWTabs = oTabs['global'];
	for (var j=0; j<arrWTabs.length; j++){
		recentIds["recent"+j] = arrWTabs[j];
		if (arrWTabs[j] in oRecent){
			browser.menus.update("recent"+j, {
				title: oRecent[arrWTabs[j]].time + ' - ' + oRecent[arrWTabs[j]].incog + oRecent[arrWTabs[j]].url 
			});
		} else {
			browser.tabs.get(arrWTabs[j]).then((currTab) => {
				if (!(arrWTabs[j] in oRecent)){
					oRecent[arrWTabs[j]] = {"url":null, "title":null, "time":null};
				}
				oRecent[arrWTabs[j]].url = currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '');
				oRecent[arrWTabs[j]].title = currTab.title;
				oRecent[arrWTabs[j]].time = new Date(currTab.lastAccessed).toLocaleTimeString();
				oRecent[arrWTabs[j]].incog = (currTab.incognito) ? '{p} ' : '';
			}).then(function () {
				browser.menus.update("recent"+j, {
					title: oRecent[arrWTabs[j]].time + ' - ' + oRecent[arrWTabs[j]].incog + oRecent[arrWTabs[j]].url 
				});
			});
		}
	}
	for (var i=arrWTabs.length; i<maxGlobal; i++){
		recentIds["recent"+i] = 'noop';
		browser.menus.update("recent"+i, {
			title: ""
		});
	}
}

browser.tabs.onUpdated.addListener((tid, chgInfo, currTab) => {
	if ('url' in chgInfo){
		if (tid in oRecent){
			if (oRecent[tid].url != currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '')){
				oRecent[tid].url = currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '');
				oRecent[tid].title = currTab.title;
				oRecent[tid].time = new Date(currTab.lastAccessed).toLocaleTimeString();
				updateRecentMenu();
			}
		}
	}
});