document.getElementById('btnLaunch').addEventListener('click', function(evt){
	browser.runtime.sendMessage({
		launchOptions: 'launchOptions'
	});
}, false);
