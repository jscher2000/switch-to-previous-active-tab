/* 
  Copyright 2018. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Revision 0.3
*/

/**** Create and populate data structure ****/

var oTabs = {};

// TODO make this user configurable
var maxTabs = 5;

// Initialize oTabs object with up to maxTabs recent tabs per window
browser.tabs.query({}).then((arrAllTabs) => {
	// Sort array of tab objects in descending order by lastAccessed (numeric)
	arrAllTabs.sort(function(a,b) {return (b.lastAccessed - a.lastAccessed);});
	// Store tabIds to oTabs
	var i, arrWTabs;
	for (i=0; i<arrAllTabs.length; i++){
		// Add to global list for i=0 through maxTabs-1 (order among windows is unpredictable)
		if (i < maxTabs) {
			if (!('global' in oTabs)) {
				oTabs['global'] = [arrAllTabs[i].id];
			} else {
				arrWTabs = oTabs['global'];
				arrWTabs.push(arrAllTabs[i].id);
				oTabs['global'] = arrWTabs;
			}
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
	//console.log('initialized => '+JSON.stringify(oTabs));
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
				if (arrWTabs.length > maxTabs) arrWTabs.pop();
				// store change
				oTabs['global'] = arrWTabs;
			} else {
				// this tab already is top-of-list so no action
			}
			//console.log('global-update => '+JSON.stringify(oTabs));

			// Update toolbar button
			setButton(arrQTabs[0].windowId);
		}
	})
});


/**** Set up tab and window listeners to keep the data fresh ****/

// Listen for tab activation and update oTabs
browser.tabs.onActivated.addListener((info) => {
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
		if (arrWTabs.length > maxTabs) arrWTabs.pop();
		// store change
		oTabs['global'] = arrWTabs;
	} else {
		// active tab already is top-of-list so no action
	}
	// Update window-specific tabIds array
	var arrWTabs = oTabs[info.windowId];
	//   Handle case of new window
	if (!arrWTabs) {
		oTabs[info.windowId] = [info.tabId];
		arrWTabs = oTabs[info.windowId];
	}
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
	//console.log('onActivated => '+JSON.stringify(oTabs));

	// Update toolbar button
	setButton(info.windowId);
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
	// Update window-specific tabIds array
	var arrWTabs = oTabs[info.windowId];
	//   Handle case of tabId in the existing list
	var pos = arrWTabs.indexOf(id);
	if (pos > -1) { 
		// remove from its old position
		arrWTabs.splice(pos, 1);
		// store change
		oTabs[info.windowId] = arrWTabs;
		// TODO we can remove the object if this removal closes the window
	}
	//console.log('onRemoved => '+JSON.stringify(oTabs));

	// Update toolbar button
	setButton(info.windowId);
});

// Updates globals and fix toolbar button for current (newly focused) window
browser.windows.onFocusChanged.addListener((wid) => {
	browser.tabs.query({active:true, windowId: wid}).then((foundtabs) => {
		if (foundtabs.length < 1) return; // some weird window?
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
			if (arrWTabs.length > maxTabs) arrWTabs.pop();
			// store change
			oTabs['global'] = arrWTabs;
		} else {
			// this tab already is top-of-list so no action
		}
		//console.log('window-focused => '+JSON.stringify(oTabs));
	});
});


/**** Set up toolbar button listener and button/tooltip toggler ****/

// Listen for button click and switch to previous tab
browser.browserAction.onClicked.addListener((currTab) => {
	// Within window switch
	var arrWTabs = oTabs[currTab.windowId];
	if (arrWTabs.length > 1) {
		browser.tabs.update(arrWTabs[1], {active:true});
	} else {
		console.log('NO TAB SWITCH: No previous tabid available for this window');
	}
});
// TODO add context menu or options or other magic to enable both within window and global switching
// TODO add context menu list (last accessed tab history) -- different permissions

// Set icon image and tooltip based on ability to switch within current window
function setButton(wid){
	var arrWTabs = oTabs[wid];
	if (!arrWTabs) return; // window focused but tab data not available yet
	if (arrWTabs.length > 1) {
		browser.browserAction.setIcon({path: 'icons/lasttab.png'});
		browser.browserAction.setTitle({title: 'Switch to Last Accessed Tab'}); 
	} else {
		browser.browserAction.setIcon({path: 'icons/nolasttab.png'});
		browser.browserAction.setTitle({title: 'Last Accessed Tab Not Available'}); 
	}
}
