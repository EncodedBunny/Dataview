window.onload = function(){
	const {remote, ipcRenderer} = require("electron");
	
	ipcRenderer.on("portValue", (event, port) => {
		document.getElementById("port").value = port;
	});
};