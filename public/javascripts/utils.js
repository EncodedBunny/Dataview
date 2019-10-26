function cleanString(str){
	return str.trim().toLowerCase().split(" ").join("-").replace(/[^a-z0-9\-]+/gi, "");
}

function enterSublink(sublink){
	let currentLoc = window.location.pathname;
	window.location.assign(currentLoc + (currentLoc.endsWith("/") ? "" : "/") + sublink);
}

function enterSuperlink(){
	window.location.assign(window.location.pathname.split("/").slice(0, -1).join("/"));
}

function reload(){
	window.location.reload();
}