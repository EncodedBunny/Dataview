const fs = require("fs-extra");
const path = require("path");
const npm = require("npm");
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

/**
 * Manages the installed drivers
 * @module DriverManager
 */
module.exports = {
	/**
	 * Retrieves the device configuration forms for all the installed drivers
	 * @returns {Object} An object that can be used to build a user interface to retrieve the information needed by each
	 * driver to configure a device
	 */
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
	/**
	 * Retrieves a list of all loaded drivers
	 * @returns {Driver[]} An array containing the instances of all loaded drivers
	 */
	getInstalledDrivers: function(){
		return Object.values(drivers);
	},
	/**
	 * Retrieves a single driver by it's module name or by it's display name, attempting first to find the driver by the
	 * former name
	 * @param {string} name The module name or display name of the driver
	 * @returns {Driver|undefined} The instance of the requested driver, or undefined if a driver with the given name
	 * could not be found
	 */
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
	/**
	 * Attempts to install the driver located at the given folder as a node module
	 * @param {string} driverPath The path of the folder containing a valid driver
	 * @returns {Promise} A promise that resolves with the module name of driver if the installation was successful, or
	 * rejects with a string informing the error that occurred
	 */
	installDriver: function(driverPath){
		return new Promise((resolve, reject) => {
			if(!fs.existsSync(driverPath) || !fs.lstatSync(driverPath).isDirectory() || !fs.existsSync(path.join(driverPath, "package.json"))) {
				reject("No valid driver was found on the provided file");
				return;
			}
			try {
				let name = fs.readJSONSync(path.join(driverPath, "package.json")).name;
				if(driversFile.installed.indexOf(name) === -1 && !drivers.hasOwnProperty(name)){
					fs.move(driverPath, path.join(driversDir, name)).then(() => {
						npm.load({
							loaded: false
						},err => {
							if(err){
								reject(err);
								return;
							}
							
							npm.commands.install([path.join(driversDir, name)], (err2, data) => {
								if(err2){
									reject(err2);
									return;
								}
								driversFile.installed.push(name);
								fs.writeJsonSync(driversJsonPath, driversFile);
								drivers[name] = new Driver(name, managers);
								resolve(name);
							});
						});
					}).catch(reject);
				} else
					reject("Driver already installed");
			} catch (e) {
				reject("Invalid driver package.json");
			}
		});
	}
};

//module.exports.installDriver("C:/Users/User/Downloads/arduino-driver");