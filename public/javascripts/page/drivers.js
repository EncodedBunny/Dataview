document.getElementById("driverRoot").addEventListener("change",function() {
	document.getElementById("fileInputText").innerText = this.files[0].name;
	document.getElementById("installBtn").disabled = false;
});

document.getElementById("installBtn").onclick = () => {
	let formData = new FormData();
	let fileInput = document.getElementById("driverRoot");
	
	formData.append(fileInput.name, fileInput.files[0]);
	
	let req = new XMLHttpRequest();
	req.open("POST", "/drivers", true);
	
	let statusWin = createStatusWindow("Installing driver...");
	
	req.onload = function() {
		if(this.status === 200) {
			statusWin.finish("Driver successfully installed",() => {
				reload();
			})
		} else {
			statusWin.error("An error occurred: " + req.response,() => {
				reload();
			});
		}
	};
	
	req.send(formData);
	displayWindow("Install Driver",450, statusWin.content,{ noClose: true, marginBottom: false });
};

function openDriverInstallDialog(){
	let window = displayWindow("Install Driver",450, createForm({
		"file": {
			"title": "Driver",
			"type": "file",
			"isTitled": true
		}
	},"install",data => {
		let statusWin = createStatusWindow("Installing driver...");
		closeWindow(window);
		displayWindow("Installing",450, statusWin.content,{ noClose: true, marginBottom: false });
		console.log(data);
		socket.emit("installDriver", {path: data.file}, status => {
			if(status){
				statusWin.finish("Device successfully added", () => {
					enterSublink(uuid);
				});
			} else{
				statusWin.error("An error occurred while configuring the device", () => {
					reload();
				});
			}
		});
	}));
}