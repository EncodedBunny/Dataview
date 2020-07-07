window.onload = function(){
	const {remote, ipcRenderer} = require("electron");
	
	ipcRenderer.on("registerUser", (event, status) => {
		document.getElementById("user").value = "";
		document.getElementById("password").value = "";
	});
	
	document.getElementById("register").addEventListener("click", (e) => {
		let encoder = new TextEncoder("utf-8");
		let salt = encoder.encode(document.getElementById("user").value);
		let pwdKey = encoder.encode(document.getElementById("password").value);
		
		window.crypto.subtle.importKey("raw", pwdKey, {name: "PBKDF2"}, false, ["deriveBits", "deriveKey"]).then(function(key) {
			return window.crypto.subtle.deriveKey(
				{"name": "PBKDF2", "salt": salt, "iterations": 1000, "hash": "SHA-256"},
				key,
				{"name": "AES-CBC", "length": 256},
				true,
				["encrypt", "decrypt"]
			);
		}).then(function (webKey) {
			return crypto.subtle.exportKey("raw", webKey);
		}).then(function (buffer) {
			console.log("Registering user " + document.getElementById("user").value + " with password " + new Uint8Array(buffer).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), ''));
			ipcRenderer.send("registerUser", document.getElementById("user").value, new Uint8Array(buffer).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), ''));
		});
	});
};