function cleanString(str){
	return str.trim().toLowerCase().split(" ").join("-").replace(/[^a-z0-9\-]+/gi, "");
}