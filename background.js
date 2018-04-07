/* 
  Copyright 2018. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Uses lots of code from "Active Tab History" 0.2 (2017-11-10)
  https://addons.mozilla.org/firefox/addon/active-tab-history/
*/

// Data Structure (simplified)
let tabdata = {
  _data: {},
  init: function(winid, tabid) {
	let item = {active:tabid, last:null, earlier:null};
	this._data[winid] = item;
  },
  get: function(winid, tabid) {
	if (!(winid in this._data))
	  this.init(winid, tabid);
	return this._data[winid];
  },
};

// Populate tabdata object with active tabs in open windows
browser.tabs.query({active:true}).then((foundtabs) => {
	for (let atab of foundtabs)
		tabdata.init(atab.windowId, atab.id);
});

// Listen for tab activation and update tabdata
browser.tabs.onActivated.addListener((info) => {
	let h = tabdata.get(info.windowId, info.tabId);
	//console.log('Before tab activation update: '+JSON.stringify(h));
	if (info.tabId === h.active)
		return;
	h.earlier = h.last;
	h.last = h.active;
	h.active = info.tabId;
	//console.log('After tab activation update: '+JSON.stringify(h));
	
	// Set icon image and tooltip based on ability to switch
	setButton(info.windowId, info.tabId);
});

// Listen for tab removal and purge from tabdata
browser.tabs.onRemoved.addListener((id, info) => {
	let h = tabdata.get(info.windowId, id);
	//console.log('Before tab removal update: '+JSON.stringify(h));	
	if (h.active == id){
		h.active = h.last; // Firefox may change this by activating a different tab on close
		h.last = h.earlier;
		h.earlier = null;
	} else {
		if (h.last == id){
			if (h.earlier != h.active) {
				h.last = h.earlier;
			} else {
				h.last = null;
			}
			h.earlier = null;
		}
		if (h.earlier == id) h.earlier = null;
	}
	//console.log('After tab removal update: '+JSON.stringify(h));

	// Set icon image and tooltip based on ability to switch
	setButton(info.windowId, id);
});

// Set icon image and tooltip based on ability to switch
function setButton(wid, tid){
	let h = tabdata.get(wid, tid);
	if (h.last != null) {
		browser.browserAction.setIcon({path: 'icons/lasttab.png'});
		browser.browserAction.setTitle({title: 'Switch to previous tab'}); 
	} else {
		browser.browserAction.setIcon({path: 'icons/nolasttab.png'});
		browser.browserAction.setTitle({title: 'Previous tab not available'}); 
	}
}

// Fix toolbar button for current (newly focused) window
browser.windows.onFocusChanged.addListener((wid) => {
	browser.tabs.query({active:true, windowId: wid}).then((foundtabs) => {
		setButton(wid, foundtabs[0].id);
	});
});


// Listen for button click and switch to previous tab
browser.browserAction.onClicked.addListener((something) => {
    browser.tabs.query({currentWindow:true, active:true}).then((foundtabs) => {
		let h = tabdata.get(foundtabs[0].windowId, foundtabs[0].id);
		if (h.last === null){
			console.log('NO TAB SWITCH: No previous tabid available for this window');
		} else {
			browser.tabs.update(h.last, {active:true});
		}
    });
});

