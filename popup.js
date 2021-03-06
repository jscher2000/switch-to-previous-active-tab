var oPrefs, oRATprefs;
var dNow = new Date(); 
var dMidnight = new Date(dNow.getFullYear(), dNow.getMonth(), dNow.getDate(), 0, 0, 0);
var oRecent = {};
var reinitPrivate = false;
var reinitFavicons = false;
var arrSkip = [];

function getSettings(){
	browser.runtime.sendMessage({
		want: "settings"
	}).then((oSettings) => {
		oPrefs = oSettings.response;
		oRATprefs = oSettings.RAT;		
		// Change tabs if needed
		if (oPrefs.popuptab != 1){
			panelSwitch(document.querySelectorAll('nav ul li')[oPrefs.popuptab]);
		}
		// Set up form defaults
		setFormControls();
		setRATFormControls();
		// Set URL display
		if (oPrefs.blnShowURLLine == false){
			document.getElementById('panels').className = 'compact';
		}
	}).catch((err) => {
		console.log('Problem getting settings: '+err.message);
	});
}

function setFormControls(){
	if (oPrefs.blnButtonSwitches){
		document.querySelector('input[value="bswitch"]').setAttribute('checked', 'checked');
		if (document.querySelector('input[value="blist"]').hasAttribute('checked'))
			document.querySelector('input[value="blist"]').removeAttribute('checked');
	} else {
		document.querySelector('input[value="blist"]').setAttribute('checked', 'checked');
		if (document.querySelector('input[value="bswitch"]').hasAttribute('checked'))
			document.querySelector('input[value="bswitch"]').removeAttribute('checked');
	}
	if (oPrefs.blnSameWindow){
		document.querySelector('input[value="swin"]').setAttribute('checked', 'checked');
		if (document.querySelector('input[value="sglob"]').hasAttribute('checked'))
			document.querySelector('input[value="sglob"]').removeAttribute('checked');
	} else {
		document.querySelector('input[value="sglob"]').setAttribute('checked', 'checked');
		if (document.querySelector('input[value="swin"]').hasAttribute('checked'))
			document.querySelector('input[value="swin"]').removeAttribute('checked');
	}
	if (oPrefs.blnShowURLLine){
		document.querySelector('input[value="showurl"]').setAttribute('checked', 'checked');
		if (document.querySelector('input[value="hideurl"]').hasAttribute('checked'))
			document.querySelector('input[value="hideurl"]').removeAttribute('checked');
	} else {
		document.querySelector('input[value="hideurl"]').setAttribute('checked', 'checked');
		if (document.querySelector('input[value="showurl"]').hasAttribute('checked'))
			document.querySelector('input[value="showurl"]').removeAttribute('checked');
	}
	if (oPrefs.blnKeepOpen){
		document.querySelector('input[name="prefkeepopen"]').setAttribute('checked', 'checked');
	} else {
		if (document.querySelector('input[name="prefkeepopen"]').hasAttribute('checked'))
			document.querySelector('input[name="prefkeepopen"]').removeAttribute('checked');
	}
	// Privacy-related preferences
	if (oPrefs.blnIncludePrivate){
		document.querySelector('input[name="prefprivate"]').setAttribute('checked', 'checked');
	} else {
		if (document.querySelector('input[name="prefprivate"]').hasAttribute('checked'))
			document.querySelector('input[name="prefprivate"]').removeAttribute('checked');
	}
	if (oPrefs.blnShowFavicons){
		document.querySelector('input[name="preficons"]').setAttribute('checked', 'checked');
	} else {
		if (document.querySelector('input[name="preficons"]').hasAttribute('checked'))
			document.querySelector('input[name="preficons"]').removeAttribute('checked');
	}
	// Appearance adjustments
	switch (oPrefs.blnDark){
		case true: //dark
			document.body.classList.add('dark');
			document.querySelector('option[value="colordark"]').setAttribute('selected', 'selected');
			break;
		case false: //light
			document.body.classList.remove('dark');
			document.querySelector('option[value="colorlight"]').setAttribute('selected', 'selected');
			break;
		default: //auto
			if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('dark');
			else document.body.classList.remove('dark');
			document.querySelector('option[value="colorauto"]').setAttribute('selected', 'selected');		
	}
	switch (oPrefs.blnColorbars){
		case true: //blue
			document.body.classList.add('blue');
			document.body.classList.remove('gray');
			document.querySelector('option[value="barsblue"]').setAttribute('selected', 'selected');
			break;
		case false: //gray
			document.body.classList.add('gray');
			document.body.classList.remove('blue');
			document.querySelector('option[value="barsgray"]').setAttribute('selected', 'selected');
			break;
		default: //no bars
			document.body.classList.remove('blue');
			document.body.classList.remove('gray');
			document.querySelector('option[value="barsnone"]').setAttribute('selected', 'selected');		
	}
	if (oPrefs.blnSansSerif){
		document.body.style.setProperty('font-family', 'sans-serif', 'important');
		document.querySelector('input[name="prefsans"]').setAttribute('checked', 'checked');
	} else {
		document.body.style.removeProperty('font-family');
		if (document.querySelector('input[name="prefsans"]').hasAttribute('checked'))
			document.querySelector('input[name="prefsans"]').removeAttribute('checked');
	}
	if (oPrefs.strFontSize){
		document.body.style.setProperty('--body-size', oPrefs.strFontSize, 'important');
		document.querySelector('option[value="' + oPrefs.strFontSize + '"]').setAttribute('selected', 'selected');
	} else {
		document.body.style.removeProperty('--body-size');
		document.querySelector('option[value="14px"]').setAttribute('selected', 'selected');
	}
	if (oPrefs.blnBoldTitle){
		document.body.style.setProperty('--title-weight', 'bold', 'important');
		document.querySelector('input[name="prefboldtitle"]').setAttribute('checked', 'checked');
	} else {
		document.body.style.removeProperty('--title-weight');
		if (document.querySelector('input[name="prefboldtitle"]').hasAttribute('checked'))
			document.querySelector('input[name="prefboldtitle"]').removeAttribute('checked');
	}
	if (oPrefs.blnBoldURL){
		document.body.style.setProperty('--url-weight', 'bold', 'important');
		document.querySelector('input[name="prefboldurl"]').setAttribute('checked', 'checked');
	} else {
		document.body.style.removeProperty('--url-weight');
		if (document.querySelector('input[name="prefboldurl"]').hasAttribute('checked'))
			document.querySelector('input[name="prefboldurl"]').removeAttribute('checked');
	}
	if (oPrefs.sectionHeight){
		setHeight(oPrefs.sectionHeight);
		document.querySelector('input[name="prefheight"]').value = parseInt(oPrefs.sectionHeight);
	}
}
function setRATFormControls(){
	if (oRATprefs.RATshowcommand == true){
		document.querySelector('#selReloShow').selectedIndex = 0;
	} else {
		document.querySelector('#selReloShow').selectedIndex = 1;
	}
	if (oRATprefs.RATactive == true){
		document.querySelector('#selReloActive').selectedIndex = 0;
	} else {
		document.querySelector('#selReloActive').selectedIndex = 1;
	}
	if (oRATprefs.RATpinned == true){
		document.querySelector('#selReloPinned').selectedIndex = 0;
	} else {
		document.querySelector('#selReloPinned').selectedIndex = 1;
	}
	if (oRATprefs.RATdiscarded == true){
		document.querySelector('#selReloDiscarded').selectedIndex = 0;
	} else {
		document.querySelector('#selReloDiscarded').selectedIndex = 1;
	}
	if (oRATprefs.RATbypasscache == true){
		document.querySelector('#selReloBypass').selectedIndex = 1;
	} else {
		document.querySelector('#selReloBypass').selectedIndex = 0;
	}
	switch (oRATprefs.RATplaying){
		case 'reload':
			document.querySelector('#selReloAudible').selectedIndex = 1;
			break;
		case 'ask':
			document.querySelector('#selReloAudible').selectedIndex = 2;
			break;
		default:
			// no change
	}
	if (oRATprefs.RATsequential !== true){
		document.querySelector('#selReloSeq').selectedIndex = document.querySelector('#selReloSeq').options.length - 1;
	} else {
		document.querySelector('#selReloSeq').selectedIndex = oRATprefs.RATseqnum - 1;
	}
	if (oRATprefs.RATgotoAttn == true){
		document.querySelector('#selReloAttention').selectedIndex = 1;
	} else {
		document.querySelector('#selReloAttention').selectedIndex = 0;
	}
}

function getGlobal(blnClear){
	browser.runtime.sendMessage({
		want: "global"
	}).then((oGlobal) => {
		var dest = document.querySelector('#tabglobal ul');
		if (blnClear) dest.innerHTML = '';
		var arrWTabs = oGlobal.glist;
		for (var j=0; j<arrWTabs.length; j++){
			if (arrWTabs[j] in oRecent){
				if (oPrefs.blnIncludePrivate || oRecent[arrWTabs[j]].incog === false){
					addListItem(arrWTabs[j], dest);
				}
			} else {
				browser.tabs.get(arrWTabs[j]).then((currTab) => {
					if (!(currTab.id in oRecent)){
						oRecent[currTab.id] = {"url":null, "title":null, "time":null, "icon":null, "incog":null, "imgPath":null};
					}
					oRecent[currTab.id].url = currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '');
					oRecent[currTab.id].title = currTab.title;
					oRecent[currTab.id].time = (currTab.lastAccessed > dMidnight) ? new Date(currTab.lastAccessed).toLocaleTimeString() : new Date(currTab.lastAccessed).toLocaleDateString();
					oRecent[currTab.id].icon = (currTab.favIconUrl) ? currTab.favIconUrl : "icons/defaultFavicon.svg";
					oRecent[currTab.id].incog = currTab.incognito;
					oRecent[currTab.id].imgPath = oRecent[currTab.id].icon;
					if (oPrefs.blnIncludePrivate || oRecent[currTab.id].incog === false){
						addListItem(currTab.id, dest);
					}
				});
			}
			if (j==29) break;
		}
	}).catch((err) => {console.log('Problem getting global: '+err.message);});
}

function getWindow(blnClear){
	browser.windows.getCurrent().then( (wind) => {
		browser.runtime.sendMessage({
			want: wind.id
		}).then((oWindow) => {
			var dest = document.querySelector('#tabthiswin ul');
			if (blnClear) dest.innerHTML = '';
			var arrWTabs = oWindow.wlist;
			if (arrWTabs){
				for (var j=0; j<arrWTabs.length; j++){
					if (arrWTabs[j] in oRecent){
						if (j == 0 && arrWTabs.length == 1 && oRecent[arrWTabs[j]].title == 'Recent Tabs Popup'
							&& location.href.replace(location.host, '') == 'moz-extension:///popup.html'){
							// Disable Window list and break
							document.getElementById('twin').setAttribute('disabled', 'disabled');
						}
						if (oPrefs.blnIncludePrivate || oRecent[arrWTabs[j]].incog === false){
							addListItem(arrWTabs[j], dest);
						}
					} else {
						browser.tabs.get(arrWTabs[j]).then((currTab) => {
							if (j == 0 && arrWTabs.length == 1 && currTab.title == 'Recent Tabs Popup'
								&& location.href.replace(location.host, '') == 'moz-extension:///popup.html'){
								// Disable Window list and break
								document.getElementById('twin').setAttribute('disabled', 'disabled');
							}
							if (!(currTab.id in oRecent)){
								oRecent[currTab.id] = {"url":null, "title":null, "time":null, "icon":null, "incog":null, "imgPath":null};
							}
							oRecent[currTab.id].url = currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '');
							oRecent[currTab.id].title = currTab.title;
							oRecent[currTab.id].time = (currTab.lastAccessed > dMidnight) ? new Date(currTab.lastAccessed).toLocaleTimeString() : new Date(currTab.lastAccessed).toLocaleDateString();
							oRecent[currTab.id].icon = (currTab.favIconUrl) ? currTab.favIconUrl : "icons/defaultFavicon.svg";
							oRecent[currTab.id].incog = currTab.incognito;
							oRecent[currTab.id].imgPath = oRecent[currTab.id].icon;
							if (oPrefs.blnIncludePrivate || oRecent[currTab.id].incog === false){
								addListItem(currTab.id, dest);
							}
						});
					}
					if (j==14 && oPrefs.blnShowURLLine == true) break;
				}
			}
		}).catch((err) => {console.log('Problem getting window: '+err.message);});
		if (wind.incognito){
			var mask = document.createElement('img');
			mask.src = 'icons/pbmaskonpurple.svg';
			mask.setAttribute('style', 'position:absolute;right:18px;margin-top:-6px;');
			document.getElementsByTagName('nav')[0].appendChild(mask);
		}
	});
}

function getSkip(){
	browser.runtime.sendMessage({
		want: "skip"
	}).then((oSkip) => {
		arrSkip = oSkip.list;
	}).catch((err) => {console.log('Problem getting skip list: '+err.message);});
}

function fixPath(tabdata){
	// Firefox 63 saves a data URI instead of using the original URL
	if (tabdata.icon.indexOf('data:image/png;base64,') == 0 || tabdata.icon.indexOf('data:image/x-icon;base64,') == 0){
		return tabdata.imgPath;
	}
	// For Firefox 62 and earlier, or if the tab was never visited in Firefox 63
	if (tabdata.incog){
		return 'icons/privateBrowsing.svg';
	} else if (tabdata.icon.indexOf('http://') == 0 || tabdata.icon.indexOf('https://') == 0){
		if (oPrefs.blnShowFavicons){
			return tabdata.imgPath;
		} else {
			return 'icons/defaultFavicon.svg';
		}
	} else if (tabdata.url.indexOf('file:///') == 0){
		return 'icons/folder-16.svg';
	} else {
		return 'icons/square.svg';
	}
}

function addListItem(onetab, list){
	var newLI = document.getElementById('newLI');
	var clone = document.importNode(newLI.content, true);
	// Populate the template
	var elTemp = clone.querySelector('li');
	elTemp.id = onetab;
	if (arrSkip.includes(onetab)){
		elTemp.className = 'skip';
	}
	elTemp.setAttribute('incog', oRecent[onetab].incog);
	elTemp = clone.querySelector('span > span > img');
	elTemp.setAttribute('src', fixPath(oRecent[onetab]));
	elTemp = clone.querySelectorAll('span > span');
	elTemp[0].appendChild(document.createTextNode(oRecent[onetab].title));
	if (oPrefs.blnShowURLLine == true){
		elTemp[1].appendChild(document.createTextNode(oRecent[onetab].url));
	} else {
		elTemp[0].closest('li').setAttribute('title', oRecent[onetab].url);
		elTemp = clone.querySelectorAll('span > br');
		elTemp[1].remove();
		elTemp[0].remove();
	}
	elTemp = clone.querySelector('span.right');
	elTemp.insertBefore(document.createTextNode(oRecent[onetab].time), elTemp.firstChild);
	// Add the item to the list
	list.appendChild(clone);
}

/**** Event handlers ****/

function panelClick(evt){
	var tgt = evt.target;
	if (tgt.hasAttribute('disabled')) return;
	panelSwitch(tgt);
}

function panelSwitch(tab){
	if (tab.className == 'vis') return;
	var tabs = document.querySelectorAll('nav ul li');
	for (var i=0; i<tabs.length; i++){
		if (tabs[i].id == tab.id){
			tabs[i].className = 'vis';
			document.getElementById(tabs[i].getAttribute('panel')).style.display = 'block';
		} else {
			tabs[i].className = '';
			document.getElementById(tabs[i].getAttribute('panel')).style.display = '';
		}
	}
}

function gotoTab(evt){
	var tgt = evt.target;
	if (tgt.nodeName != "LI"){
		tgt = tgt.closest('li');
		if (!tgt){
			console.log('Error finding LI');
			return;
		}
	}
	browser.tabs.update(parseInt(tgt.id), {active:true}).then((newTab) => {
		browser.windows.getCurrent().then((wind) => {
			if (newTab.windowId == wind.id){
				if (oPrefs.blnKeepOpen){
					// Staying in same window, update panel
					getWindow(true);
					getGlobal(true);
				} else {
					self.close();
				}
			} else {
				// Change window
				browser.windows.update(newTab.windowId, {focused: true});
				// Close panel => BUGGY, FOCUS SHIFTS, DISABLE FOR NOW v1.8.2
				//self.close();
			}
		});
	});
}

getSettings();
getGlobal(true);
getWindow(true);
getSkip();
document.querySelector('nav > ul').addEventListener('click', panelClick, false);
document.querySelector('#tabthiswin').addEventListener('click', gotoTab, false);
document.querySelector('#tabglobal').addEventListener('click', gotoTab, false);
document.querySelector('#btnSave').addEventListener('click', updatePrefs, false);
document.querySelector('#btnReset').addEventListener('click', clearForm, false);
document.querySelector('select[name="prefdark"]').addEventListener('change', updateDarkmode, false);
document.querySelector('select[name="colorbars"]').addEventListener('change', updateColorbars, false);
document.querySelector('input[name="prefsans"]').addEventListener('click', updatefont, false);
document.querySelector('select[name="fontsize"]').addEventListener('change', updatefont, false);
document.querySelector('input[name="prefboldtitle"]').addEventListener('click', updateweightvar, false);
document.querySelector('input[name="prefboldurl"]').addEventListener('click', updateweightvar, false);
document.querySelector('input[name="prefheight"]').addEventListener('change', setHeight, false);
document.querySelector('#height490').addEventListener('click', revertHeight, false);
document.querySelector('#btnReinit').addEventListener('click', doReinit, false);
document.querySelector('#btnReloSave').addEventListener('click', updateRATPrefs, false);
document.querySelector('#btnReloReset').addEventListener('click', setRATFormControls, false);

function updatePrefs(evt){
	// Update oPrefs
	if (document.querySelector('input[value="bswitch"]').checked) oPrefs.blnButtonSwitches = true;
	else oPrefs.blnButtonSwitches = false;
	if (document.querySelector('input[value="swin"]').checked) oPrefs.blnSameWindow = true;
	else oPrefs.blnSameWindow = false;
	if (document.querySelector('input[value="showurl"]').checked) oPrefs.blnShowURLLine = true;
	else oPrefs.blnShowURLLine = false;
	if (document.querySelector('input[name="prefprivate"]').checked){
		if (oPrefs.blnIncludePrivate != true) reinitPrivate = true;
		oPrefs.blnIncludePrivate = true;
	} else {
		if (oPrefs.blnIncludePrivate != false) reinitPrivate = true;
		oPrefs.blnIncludePrivate = false;
	}
	if (document.querySelector('input[name="preficons"]').checked){
		if (oPrefs.blnShowFavicons != true) reinitFavicons = true;
		oPrefs.blnShowFavicons = true;
	} else {
		if (oPrefs.blnShowFavicons != false) reinitFavicons = true;
		oPrefs.blnShowFavicons = false;
	}
	if (document.querySelector('input[name="prefkeepopen"]').checked) oPrefs.blnKeepOpen = true;
	else oPrefs.blnKeepOpen = false;
	var prefdark = document.querySelector('select[name="prefdark"]');
	switch (prefdark.value){
		case 'colordark':
			oPrefs.blnDark = true;
			break;
		case 'colorlight':
			oPrefs.blnDark = false;
			break;
		default: //auto
			oPrefs.blnDark = undefined;
	}
	var colorbars = document.querySelector('select[name="colorbars"]');
	switch (colorbars.value){
		case 'barsblue':
			oPrefs.blnColorbars = true;
			break;
		case 'barsgray':
			oPrefs.blnColorbars = false;
			break;
		default: // flat
			oPrefs.blnColorbars = undefined;
	}
	if (document.querySelector('input[name="prefsans"]').checked) oPrefs.blnSansSerif = true;
	else oPrefs.blnSansSerif = false;
	oPrefs.strFontSize = document.querySelector('select[name="fontsize"]').value;
	if (document.querySelector('input[name="prefboldtitle"]').checked) oPrefs.blnBoldTitle = true;
	else oPrefs.blnBoldTitle = false;
	if (document.querySelector('input[name="prefboldurl"]').checked) oPrefs.blnBoldURL = true;
	else oPrefs.blnBoldURL = false;
	var intHeight = document.querySelector('input[name="prefheight"]').value;
	if (intHeight >= 300 && intHeight <= 1000){
		oPrefs.sectionHeight = '' + intHeight + 'px';
	}
	// send to background script
	browser.runtime.sendMessage({
		update: oPrefs
	});
	// Need to refresh lists if the private or favicon prefs were changed
	if (reinitPrivate || reinitFavicons){
		getGlobal(true);
		getWindow(true);
	}
	// cancel form submit
	return false;
}
function cleanse(txt){
	return txt.replace(/\</g, '&lt;').replace(/\>/g, '&gt;');
}
function updateDarkmode(evt){
	if (evt && evt.target) var tgt = evt.target;
	else var tgt = document.querySelector('select[name="prefdark"]');
	switch (tgt.value){
		case 'colordark':
			document.body.classList.add('dark');
			break;
		case 'colorlight':
			document.body.classList.remove('dark');
			break;
		default: //auto
			if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('dark');
			else document.body.classList.remove('dark');
	}
}
function updateColorbars(evt){
	if (evt && evt.target) var tgt = evt.target;
	else var tgt = document.querySelector('select[name="colorbars"]');
	switch (tgt.value){
		case 'barsblue': //blue
			document.body.classList.add('blue');
			document.body.classList.remove('gray');
			break;
		case 'barsgray': //gray
			document.body.classList.add('gray');
			document.body.classList.remove('blue');
			break;
		default: //no bars
			document.body.classList.remove('blue');
			document.body.classList.remove('gray');
	}
}
function updateweightvar(evt){
	if (evt && evt.target) var chk = evt.target;
	if (chk.getAttribute('name') == 'prefboldtitle'){
		if (chk.checked){
			document.body.style.setProperty('--title-weight', 'bold', 'important');
		} else {
			document.body.style.removeProperty('--title-weight');
		}
	}
	if (chk.getAttribute('name') == 'prefboldurl'){
		if (chk.checked){
			document.body.style.setProperty('--url-weight', 'bold', 'important');
		} else {
			document.body.style.removeProperty('--url-weight');
		}
	}
}
function updatefont(evt){
	if (evt && evt.target) var tgt = evt.target;
	if (tgt.getAttribute('name') == 'fontsize'){
		document.body.style.setProperty('--body-size', tgt.value, 'important');
	}
	if (tgt.getAttribute('name') == 'prefsans'){
		if (tgt.checked){
			document.body.style.setProperty('font-family', 'sans-serif', 'important');
		} else {
			document.body.style.removeProperty('font-family');
		}
	}
}
function setHeight(inp){
	if (typeof inp == 'string'){
		// add or modify style block
		var r = document.createTextNode('section{height: '+inp+';}');
		var s = document.getElementById('panelheight');
		if (!s){
			s = document.createElement('style');
			s.id = 'panelheight';
			document.body.appendChild(s);
		}
		s.appendChild(r);
		document.getElementById('taboptions').style.height = '';
	} else {
		if (inp.target){
			document.getElementById('taboptions').style.height = '' + inp.target.value + 'px';
		} else {
			console.log('inp is some unknown '+ typeof inp);
		}
	}
}
function revertHeight(evt){
	document.querySelector('input[name="prefheight"]').value = 490;
	setHeight('490px');
}
function clearForm(evt){
	// BUG: triggers a change of tab in some cases (private mode settings)
	document.getElementById('frmOpts').reset();
	updateDarkmode(null);
	updateColorbars(null);
	document.querySelector('input[name="prefheight"]').value = parseInt(oPrefs.sectionHeight);
	setHeight(oPrefs.sectionHeight);
}
function doReinit(evt){
	if(confirm('Clear recent tabs lists and requery all tabs?')){
		browser.runtime.sendMessage({
			reinit: true
		});
		self.close();
	}
}
function updateRATPrefs(evt){
	// update oRATprefs
	if (document.querySelector('#selReloShow').value == "true") oRATprefs.RATshowcommand = true;
	else oRATprefs.RATshowcommand = false;
	if (document.querySelector('#selReloActive').value == "true") oRATprefs.RATactive = true;
	else oRATprefs.RATactive = false;
	if (document.querySelector('#selReloPinned').value == "true") oRATprefs.RATpinned = true;
	else oRATprefs.RATpinned = false;
	if (document.querySelector('#selReloDiscarded').value == "true") oRATprefs.RATdiscarded = true;
	else oRATprefs.RATdiscarded = false;
	if (document.querySelector('#selReloBypass').value == "true") oRATprefs.RATbypasscache = true;
	else oRATprefs.RATbypasscache = false;
	oRATprefs.RATplaying = document.querySelector('#selReloAudible').value;
	if (document.querySelector('#selReloSeq').value == "all") oRATprefs.RATsequential = false;
	else {
		oRATprefs.RATsequential = true;
		oRATprefs.RATseqnum = document.querySelector('#selReloSeq').value;
	}
	if (document.querySelector('#selReloAttention').value == "true") oRATprefs.RATgotoAttn = true;
	else oRATprefs.RATgotoAttn = false;
	// send to background script
	browser.runtime.sendMessage({
		updateRAT: oRATprefs
	});
	// cancel form submit
	return false;
}
