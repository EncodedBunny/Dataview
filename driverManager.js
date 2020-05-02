const fs = require("fs-extra");
const path = require("path");
let Driver = require("./driver");

let driversDir = path.join(__dirname, "drivers");
let driversJsonPath = path.join(driversDir, "drivers.json");
let driversFile = fs.readJSONSync(driversJsonPath);
let drivers = {};
let managers = {
	serial: require("./serialManager")
};

for(const name of driversFile.installed) {
	if(!drivers.hasOwnProperty(name))
		drivers[name] = new Driver(name, managers);
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

module.exports = {
	getDriversForms: function(){
		let forms = {};
		let ports = managers.serial.getCachedSerialPorts();
		for(const driver of Object.values(drivers)) {
			let form = driver.configForm;
			if(driver.supportedConnections !== undefined && driver.supportedConnections.length > 0){
				for(let connectionType of driver.supportedConnections){
					switch(connectionType) {
						case "serial":
							let serialPorts = [];
							for(let port of ports){
								serialPorts.push(port.comName + " (" + driver.getNameForSerialPort(port.vendorId, port.productId) + ")");
							}
							form.serialPort = {
								type: "list",
								isTitled: true,
								title: "Serial Port",
								items: serialPorts
							};
							break;
						case "wifi":
							// Not yet supported
							break;
						default:
							break;
					}
				}
			}
			if(driver.deviceModels !== undefined){
				form.model = {
					type: "list",
					isTitled: true,
					title: "Model",
					items: Object.keys(driver.deviceModels)
				};
			}
			forms[driver.formattedName] = form;
		}
		return forms;
	},
	getInstalledDrivers: function(){
		let names = [];
		for(const driver of Object.values(drivers))
			names.push(driver.formattedName);
		return names;
	},
	getDriver: function(name){
		if(name === undefined) return undefined;
		let res = drivers[name];
		if(res === undefined)
			for(let driver of Object.values(drivers))
				if(driver.formattedName === name){
					res = driver;
					break;
				}
		return res;
	},
	installDriver: function(driverPath){
		return new Promise((resolve, reject) => {
			if(!fs.existsSync(driverPath) || !fs.lstatSync(driverPath).isDirectory() || !fs.existsSync(path.join(driverPath, "package.json"))) {
				reject("No valid driver was found on the provided path (" + driverPath + ")");
				return;
			}
			try {
				let name = fs.readJSONSync(path.join(driverPath, "package.json")).name;
				if(driversFile.installed.indexOf(name) === -1){
					fs.move(driverPath, path.join(driversDir, name)).then(() => {
						driversFile.installed.push(name);
						fs.writeJsonSync(driversJsonPath, driversFile);
						resolve();
					}).catch(reject);
				} else
					reject();
			} catch (e) {
				reject("Invalid driver package.json");
			}
		});
	}
};