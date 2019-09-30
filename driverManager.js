const fs = require("fs");
const path = require("path");
const {spawn} = require("child_process");
let driversFile = JSON.parse(fs.readFileSync(path.join(__dirname, "drivers.json"), "utf8"));
let drivers = [];

for(const device of driversFile.installed)
	loadDriver(device);

function loadDriver(device){
	if(isDriverLoaded(device)) return false;
	try {
		drivers[device] = require(device)();
		return true;
	} catch (e) {
		return false;
	}
}

function installDriver(driverPath, onSuccess, onFail){ // TODO: Use promises
	if(!fs.existsSync(driverPath) || !fs.lstatSync(driverPath).isDirectory() || !fs.existsSync(path.join(driverPath, "package.json"))) return false;
	let name = JSON.parse(fs.readFileSync(path.join(driverPath, "package.json"), "utf8")).name;
	let eFunc = () => {};
	let res = spawn("npm" + (process.platform === "win32" ? ".cmd" : ""), ["install", driverPath]);
	res.on("close", (status) => {
		if(status !== 0) return (onFail || eFunc)();
		if(!driversFile.installed.contains(name)) {
			driversFile.installed.push(name);
			_saveChanges();
		}
		(onSuccess || eFunc)();
	});
	return true;
	/*let progress = onProgress || function() {}; // Prevent undefined
	progress(0, "check");
	if(driverJson === path.basename(driverJson) || !fs.existsSync(driverJson) || !fs.lstatSync(driverJson).isFile()) return false;
	try {
		let json = JSON.parse(fs.readFileSync(driverJson, "utf8"));
		if(!json.device || json.device.trim().length <= 0 || !json.formattedName || json.formattedName.trim().length <= 0 || !json.driverFile || !json.layoutFile) return false;
		let finalJson = {device: json.device.trim().toLowerCase().split(" ").join("-"), formattedName: json.formattedName.trim()};
		if(fs.existsSync(path.join(driversFolder, finalJson.device))) return false;
		const driverFile = path.join(driverJson, json.driverFile);
		const layoutFile = path.join(driverJson, json.layoutFile);
		if(!fs.lstatSync().isFile(driverFile) || !fs.lstatSync().isFile(layoutFile)) return false;
		progress(0.2, "copy"); // TODO: Check if driverJson is an actual valid driver (digitally signed drivers(?))
		const driverFolder = path.join(driversFolder, finalJson.device);
		fs.mkdirSync(driverFolder);
		fs.writeFileSync(path.join(driverFolder, "driver.json"), JSON.stringify(finalJson));
		fs.copyFile(layoutFile, path.join(driverFolder, "layout.json"));
		progress(0.6, "install");
		// TODO: execSync();
		fs.copyFile(driverFile, path.join(driverFolder, "driver.node"));
		progress(0.8, "clean");
		fs.unlinkSync(driverJson);
		progress(0.9, "save");
		driversFile.installed.push(finalJson.device);
		progress(1, "done");
	} catch (e) {
		return false;
	}*/
}

function isDriverLoaded(device){
	return drivers.hasOwnProperty(device);
}

function getDriversForms(){
	let forms = {};
	for(const driver of Object.values(drivers))
		forms[driver.formattedName] = driver.deviceLayout;
	return forms;
}

function getDeviceSensorLayout(device){
	if(drivers[device])
		return drivers[device].sensorLayout;
	return undefined;
}

function getDriversSensorForms(){
	let forms = {};
	for(const driver of Object.values(drivers))
		forms[driver.formattedName] = driver.sensorLayout;
	return forms;
}

function getInstalledDrivers(){
	let names = [];
	for(const driver of Object.values(drivers))
		names.push(driver.formattedName);
	return names;
}

function formattedNameToBaseName(formatted){
	for(const [name, driver] of Object.entries(drivers))
		if(driver.formattedName === formatted)
			return name;
	return undefined;
}

function baseNameToFormattedName(name){
	return (drivers[name] ? drivers[name].formattedName : undefined);
}

function _saveChanges(sync){
	if(sync === true)
		fs.writeFileSync(path.join(__dirname, "drivers.json"), JSON.stringify(driversFile));
	else
		fs.writeFile(path.join(__dirname, "drivers.json"), JSON.stringify(driversFile));
}

function attachDevice(device, deviceID) {
	if(!device || !device.driver || !device.name || !device.extraData || !drivers[device.driver]) return false;
	if(drivers[device.driver].registerDevice(deviceID, device.extraData))
		return drivers[device.driver].addListener(deviceID, device.listener);
	return false;
}

function attachSensor(driver, deviceID, extraData){
	if(!driver || !deviceID || !extraData || !drivers[driver]) return -1;
	return drivers[driver].registerSensor(deviceID, extraData);
}

function detachSensor(device, deviceID, sensorID){
	if(!drivers[device.driver] || !device.sensors[sensorID]) return false;
	return drivers[device.driver].unregisterSensor(deviceID, device.sensors[sensorID].id);
}

/*setInterval(_saveChanges, 5 * 60 * 1000);

process.on("exit", () => {
	_saveChanges(true);
});*/

module.exports = {
	loadDriver, installDriver, isDriverLoaded, getDriversForms, getInstalledDrivers, formattedNameToBaseName, baseNameToFormattedName, getDriversSensorForms, getDeviceSensorLayout, attachSensor, attachDevice, detachSensor
};