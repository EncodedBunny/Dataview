document.getElementById("addExperiment").addEventListener("click", () => {
	let newSensorWindow = displayWindow("Add New Experiment", 450, createForm({
		"name": {
			"type": "textbox",
			"isTitled": true
		}
	}, "add", data => {
		socket.emit("addExperiment", {name: data.name}, uuid => {
			if(uuid !== undefined)
				enterSublink(uuid);
			else
				alert("An error occurred");
			closeWindow(newSensorWindow);
		});
	}));
});