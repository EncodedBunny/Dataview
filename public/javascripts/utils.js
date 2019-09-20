function cleanString(str){
	return str.trim().toLowerCase().split(" ").join("-").replace(/[^a-z0-9\-]+/gi, "");
}

function enterSublink(sublink){
	let currentLoc = window.location.pathname;
	window.location.replace(currentLoc + (currentLoc.endsWith("/") ? "" : "/") + sublink);
}