function insert_flash()
{
	var params = {}
	location.search.substr(1).split('&').filter(Boolean).map(function(pair) {
		pair = pair.split('=')
		params[pair[0]] = pair[1]
	})

	var url = params.demo == 'true' ? "flash/plane_demo.swf" : "flash/seat_chooser.swf"
	console.log("url", url)
	var swfVersionStr = "10.3.0";
	var xiSwfUrlStr = "";
	var flashvars = {}
	flashvars.config_url = "config.xml";
	flashvars.registration_number = params.tourid;
	flashvars.seats_info_url = "trs.xml?";
	flashvars.seat_request = "trs.xml?";
	
	var params = {};
	params.quality = "high";
	params.bgcolor = "#ffffff";
	params.play = "true";
	params.loop = "true";
	params.wmode = "window";
	params.scale = "noscale";
	params.menu = "false";
	params.devicefont = "false";
	params.salign = "";
	params.base = "flash"
	params.allowscriptaccess = "sameDomain";
	params.allowFullScreen = "true";
	
	var attributes = {};
	attributes.id = "registration";
	attributes.name = "registration";
	attributes.align = "middle";
	swfobject.createCSS("html", "height:100%; background-color: #ffffff;");
	swfobject.createCSS("#flash_cont", "height:100%;");
	swfobject.createCSS("body", "margin:0; padding:0; overflow:hidden; height:100%;");
	
	swfobject.embedSWF(
		url,
		"flash_cont",
		"100%",
		"100%",
		swfVersionStr,
		xiSwfUrlStr,
		flashvars,
		params,
		attributes
	);
}

console.log("here")

var f = function() {
	document.body.style.display = 'block'
	document.body.innerHTML = "<div id='flash_cont'></div>"
	setTimeout(insert_flash, 100)
}

window.onload = f
