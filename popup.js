var oPrefs;
function getSettings(){
	browser.runtime.sendMessage({
		want: "settings"
	}).then((oSettings) => {
		oPrefs = oSettings.response;
		// Change tabs if needed
		if (oPrefs.popuptab != 1){
			panelSwitch(document.querySelectorAll('nav ul li')[oPrefs.popuptab]);
		}
		// Set up form defaults
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
		if (oPrefs.blnKeepOpen){
			document.querySelector('input[name="prefkeepopen"]').setAttribute('checked', 'checked');
		} else {
			if (document.querySelector('input[name="prefkeepopen"]').hasAttribute('checked'))
				document.querySelector('input[name="prefkeepopen"]').removeAttribute('checked');
		}
		if (oPrefs.blnDark){
			document.body.className = 'dark';
			document.querySelector('input[name="prefdark"]').setAttribute('checked', 'checked');
		} else {
			document.body.className = '';
			if (document.querySelector('input[name="prefdark"]').hasAttribute('checked'))
				document.querySelector('input[name="prefdark"]').removeAttribute('checked');
		}
		if (oPrefs.sectionHeight){
			setHeight(oPrefs.sectionHeight);
			document.querySelector('input[name="prefheight"]').value = parseInt(oPrefs.sectionHeight);
		}
	}).catch((err) => {
		console.log('Problem getting settings: '+err.message);
		return {what: "damn"}; // do some defaults here
	});
}

function getGlobal(blnClear){
	browser.runtime.sendMessage({
		want: "global"
	}).then((oGlobal) => {
		var dest = document.querySelector('#tabglobal ul');
		if (blnClear) dest.innerHTML = '';
		var arrWTabs = oGlobal.response.glist;
		var oRecent = oGlobal.response.details;
		for (var j=0; j<arrWTabs.length; j++){
			if (arrWTabs[j] in oRecent){
				dest.insertAdjacentHTML('beforeend', '<li id="' + arrWTabs[j] + '"><span><span><img src="' + oRecent[arrWTabs[j]].imgPath + '">' + 
				cleanse(oRecent[arrWTabs[j]].title) + '</span><br><span>' + oRecent[arrWTabs[j]].url + '</span></span><span class="right">' + 
				oRecent[arrWTabs[j]].time + '<br><span>&nbsp;</span></span></li>\n');
			} else {
				browser.tabs.get(arrWTabs[j]).then((currTab) => {
					if (!(arrWTabs[j] in oRecent)){
						oRecent[arrWTabs[j]] = {"url":null, "title":null, "time":null};
					}
					oRecent[arrWTabs[j]].url = currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '');
					oRecent[arrWTabs[j]].title = currTab.title;
					oRecent[arrWTabs[j]].time = new Date(currTab.lastAccessed).toLocaleTimeString();
					oRecent[arrWTabs[j]].incog = currTab.incognito;
					oRecent[arrWTabs[j]].imgPath = (currTab.incognito) ? 'icons/privateBrowsing.svg' : 'icons/defaultFavicon.svg';
				}).then(function () {
					dest.insertAdjacentHTML('beforeend', '<li id="' + arrWTabs[j] + '"><span><span><img src="' + oRecent[arrWTabs[j]].imgPath + '">' + 
					cleanse(oRecent[arrWTabs[j]].title) + '</span><br><span>' + oRecent[arrWTabs[j]].url + '</span></span><span class="right">' + 
					oRecent[arrWTabs[j]].time + '<br><span>&nbsp;</span></span></li>\n');
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
			var arrWTabs = oWindow.response.wlist;
			var oRecent = oWindow.response.details;
			for (var j=0; j<arrWTabs.length; j++){
				if (arrWTabs[j] in oRecent){
					dest.insertAdjacentHTML('beforeend', '<li id="' + arrWTabs[j] + '"><span><span><img src="' + oRecent[arrWTabs[j]].imgPath + '">' + 
					cleanse(oRecent[arrWTabs[j]].title) + '</span><br><span>' + oRecent[arrWTabs[j]].url + '</span></span><span class="right">' + 
					oRecent[arrWTabs[j]].time + '<br><span>&nbsp;</span></span></li>\n');
				} else {
					browser.tabs.get(arrWTabs[j]).then((currTab) => {
						if (!(arrWTabs[j] in oRecent)){
							oRecent[arrWTabs[j]] = {"url":null, "title":null, "time":null};
						}
						oRecent[arrWTabs[j]].url = currTab.url.replace(/https:\/\//, '').replace(/http:\/\//, '');
						oRecent[arrWTabs[j]].title = currTab.title;
						oRecent[arrWTabs[j]].time = new Date(currTab.lastAccessed).toLocaleTimeString();
						oRecent[arrWTabs[j]].incog = currTab.incognito;
						oRecent[arrWTabs[j]].imgPath = (currTab.incognito) ? 'icons/privateBrowsing.svg' : 'icons/defaultFavicon.svg';
					}).then(function () {
						dest.insertAdjacentHTML('beforeend', '<li id="' + arrWTabs[j] + '"><span><span><img src="' + oRecent[arrWTabs[j]].imgPath + '">' + 
						cleanse(oRecent[arrWTabs[j]].title) + '</span><br><span>' + oRecent[arrWTabs[j]].url + '</span></span><span class="right">' + 
						oRecent[arrWTabs[j]].time + '<br><span>&nbsp;</span></span></li>\n');
					});
				}
				if (j==14) break;
			}
		}).catch((err) => {console.log('Problem getting window: '+err.message);});
	});
}

/**** Event handlers ****/

function panelClick(evt){
	var tgt = evt.target;
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
	while (tgt.nodeName != "LI"){
		tgt = tgt.parentNode;
		if (tgt.nodeName == "UL"){
			console.log('Reached UL!');
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
				// Change window, close panel
				browser.windows.update(newTab.windowId, {focused: true});
				self.close();
			}
		});
	});
}

getSettings();
getGlobal();
getWindow(false);
document.querySelector('nav > ul').addEventListener('click', panelClick, false);
document.querySelector('#tabthiswin').addEventListener('click', gotoTab, false);
document.querySelector('#tabglobal').addEventListener('click', gotoTab, false);
document.querySelector('#btnSave').addEventListener('click', updatePrefs, false);
document.querySelector('#btnReset').addEventListener('click', clearForm, false);
document.querySelector('input[name="prefdark"]').addEventListener('click', updateDarkmode, false);
document.querySelector('input[name="prefheight"]').addEventListener('change', setHeight, false);
document.querySelector('#height490').addEventListener('click', revertHeight, false);

function updatePrefs(evt){
	// Update oPrefs
	if (document.querySelector('input[value="bswitch"]').checked) oPrefs.blnButtonSwitches = true;
	else oPrefs.blnButtonSwitches = false;
	if (document.querySelector('input[value="swin"]').checked) oPrefs.blnSameWindow = true;
	else oPrefs.blnSameWindow = false;
	if (document.querySelector('input[name="prefprivate"]').checked) oPrefs.blnIncludePrivate = true;
	else oPrefs.blnIncludePrivate = false;
	if (document.querySelector('input[name="preficons"]').checked) oPrefs.blnShowFavicons = true;
	else oPrefs.blnShowFavicons = false;
	if (document.querySelector('input[name="prefkeepopen"]').checked) oPrefs.blnKeepOpen = true;
	else oPrefs.blnKeepOpen = false;
	if (document.querySelector('input[name="prefdark"]').checked) oPrefs.blnDark = true;
	else oPrefs.blnDark = false;
	var intHeight = document.querySelector('input[name="prefheight"]').value;
	if (intHeight >= 300 && intHeight <= 1000){
		oPrefs.sectionHeight = '' + intHeight + 'px';
	}
	// send to background script
	browser.runtime.sendMessage({
		update: oPrefs
	});
	// cancel form submit
	return false;
}
function cleanse(txt){
	return txt.replace(/\</g, '&lt;').replace(/\>/g, '&gt;');
}
function updateDarkmode(evt){
	if (evt && evt.target) var chk = evt.target;
	else var chk = document.querySelector('input[name="prefdark"]');
	if (chk.checked){
		document.body.className = 'dark';
	} else {
		document.body.className = '';
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
	document.getElementById('frmOpts').reset();
	updateDarkmode(null);
	document.querySelector('input[name="prefheight"]').value = parseInt(oPrefs.sectionHeight);
	setHeight(oPrefs.sectionHeight);
}
