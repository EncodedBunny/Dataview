const fs = require("fs-extra");
const path = require("path");
let Device = require("./device");

/**
 * A class that acts as a wrapper around the module of a driver, being responsible for all operations that are common
 * between all drivers
 */
class Driver{
	/**
	 * Loads the module of a driver
	 * @param {string} name The name of the driver's module
	 * @param {Object} managers An object that contains the resource managers available for the underlying driver
	 */
	constructor(name, managers){
		this._name = name;
		this._folder = path.join(__dirname, "drivers", name);
		this._driver = require(this._folder)(managers);
		this._driverJson = fs.readJsonSync(path.join(this._folder, "driver.json"));
		this._modelsJson = fs.pathExistsSync(path.join(this._folder, "models.json")) ? fs.readJsonSync(path.join(this._folder, "models.json")) : undefined;
		
		if(this._modelsJson){
			for(let model of Object.values(this._modelsJson)){
				if(model.hasOwnProperty("i2c")){
					Driver._parseI2C(model);
				}
			}
		} else{
			Driver._parseI2C(this._driverJson);
		}
	}
	
	/**
	 * Registers a non-registered device to this driver
	 * @param {Device} device The non-registered device to be registered
	 * @returns {Promise} True if the device was successfully registered, false if the device is already registered to
	 * a driver or an error occurred
	 */
	attachDevice(device){
		return new Promise((resolve, reject) => {
			if(!(device instanceof Device) || device.driver !== undefined) return reject();
			this._driver.registerDevice(device.id, device.extraData).then(() => {
				device._driver = this;
				let locations = this.getLocationLayout(device.model);
				if(typeof locations !== "object"){
					locations = Driver._parseLocationData(locations);
				} else {
					for (let type of Object.keys(locations))
						locations[type] = Driver._parseLocationData(locations[type]);
				}
				device._locations = locations;
				resolve();
			}).catch(err => {
				reject();
			});
		});
	}
	
	/**
	 * Informs the underlying driver to attach a sensor to a registered device
	 * @param {string} deviceID The id of the device which will contain the sensor
	 * @param {string} sensorID The id that will be used for this sensor
	 * @param {Location} location The location of the sensor within the device
	 * @param {Object} extraData Additional information required for the underlying driver, may be undefined
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	attachSensor(deviceID, sensorID, location, extraData){
		if(!deviceID || !sensorID || !location) return false;
		return this._driver.registerSensor(deviceID, location, sensorID, extraData);
	}
	
	/**
	 * Informs the underlying driver to attach an actuator to a registered device
	 * @param {string} deviceID The id of the device which will contain the actuator
	 * @param {string} actuatorID The id that will be used for this actuator
	 * @param {Location} location The location of the actuator within the device
	 * @param {Object} extraData Additional information required for the underlying driver, may be undefined
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	attachActuator(deviceID, actuatorID, location, extraData){
		if(!deviceID || !actuatorID || !location) return false;
		return this._driver.registerActuator(deviceID, location, actuatorID, extraData);
	}
	
	/**
	 * Informs the underlying driver to modify the configuration of an existing sensor
	 * @param {string} deviceID The id of the device that contains the sensor
	 * @param {string} sensorID The id of the sensor
	 * @param {Object} extraData Additional information required for the underlying driver, may be undefined
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	configureSensor(deviceID, sensorID, extraData){
		if(!deviceID || !sensorID) return false;
		return this._driver.configureSensor(deviceID, sensorID, extraData);
	}
	
	/**
	 * Informs the underlying driver to modify the configuration of an existing actuator
	 * @param {string} deviceID The id of the device that contains the actuator
	 * @param {string} actuatorID The id of the actuator
	 * @param {Object} extraData Additional information required for the underlying driver, may be undefined
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	configureActuator(deviceID, actuatorID, extraData){
		if(!deviceID || !actuatorID) return false;
		return this._driver.configureActuator(deviceID, actuatorID, extraData);
	}
	
	/**
	 * Informs the underlying driver to remove an existing sensor
	 * @param {string} deviceID The id of the device that contains the sensor
	 * @param {string} sensorID The id of the sensor
	 * @returns {boolean} True if the sensor was removed, false otherwise
	 */
	detachSensor(deviceID, sensorID){
		if(!deviceID || !sensorID) return false;
		return this._driver.unregisterSensor(deviceID, sensorID);
	}
	
	/**
	 * Polls the underlying driver for the current value of a registered sensor
	 * @param {string} deviceID The id of the device that contains the sensor
	 * @param {string} sensorID The id of the sensor
	 * @returns {Promise|undefined} A promise that will resolve to the value of the sensor and reject if there was an
	 * error during communication with the physical device, or undefined if the parameters contained invalid information
	 */
	getSensorValue(deviceID, sensorID){
		if(!deviceID || !sensorID) return undefined;
		return this._driver.getSensorValue(deviceID, sensorID);
	}
	
	/**
	 * Informs the underlying driver to set a value to an existing actuator
	 * @param {string} deviceID The id of the device that contains the actuator
	 * @param {string} actuatorID The id of the actuator
	 * @param {number} value The value that the actuator will be set to
	 * @returns {Promise|undefined} A promise that will resolve if the value was successfully set and reject if there was
	 * an error during communication with the physical device, or undefined if the parameters contained invalid information
	 */
	setActuatorValue(deviceID, actuatorID, value){
		if(!deviceID || !actuatorID || value === undefined) return undefined;
		return this._driver.setActuatorValue(deviceID, actuatorID, value);
	}
	
	readSPI8(deviceID, cpin, miso){
		if(!deviceID || !cpin || !miso || !this._driver.readSPI8) return undefined;
		return this._driver.readSPI8(deviceID, cpin, miso);
	}
	
	readSPI16(deviceID, cpin, miso){
		if(!deviceID || !cpin || !miso) return undefined;
		if(this._driver.readSPI16){
			return this._driver.readSPI16(deviceID, cpin, miso);
		} else if(this._driver.readSPI8){
			return (this._driver.readSPI8(deviceID, cpin, miso) << 8) | this._driver.readSPI8(deviceID, cpin, miso);
		}
		return undefined;
	}
	
	readSPI24(deviceID, cpin, miso){
		if(!deviceID || !cpin || !miso) return undefined;
		if(this._driver.readSPI24){
			return this._driver.readSPI24(deviceID, cpin, miso);
		} else if(this._driver.readSPI8){
			if(this._driver.readSPI16){
				return (this._driver.readSPI16(deviceID, cpin, miso) << 8) | this._driver.readSPI8(deviceID, cpin, miso);
			} else {
				return (this._driver.readSPI8(deviceID, cpin, miso) << 16) | (this._driver.readSPI8(deviceID, cpin, miso) << 8) | this._driver.readSPI8(deviceID, cpin, miso);
			}
		}
	}
	
	transferSPI8(deviceID, scl, miso, mosi, value){
		if(!deviceID || !scl || !miso || !mosi || value === undefined || !this._driver.transferSPI8) return undefined;
		return this._driver.transferSPI8(deviceID, scl, miso, mosi, value);
	}
	
	swapEndianness16(x){
		return ((x << 8) | ((x >> 8) & 0xFF)) & 0xFFFF;
	}
	
	setOutputValue(deviceID, location, value){
		if(!deviceID || !location || value === undefined) return undefined;
		return this._driver.outputValue(deviceID, location, value);
	}
	
	getInputValue(deviceID, location){
		if(!deviceID || !location) return undefined;
		return this._driver.inputValue(deviceID, location);
	}
	
	/**
	 * The layout of the physical locations of the device described by this driver
	 * @returns {Object} The value of the layout property exactly as defined in the device.json file
	 * @readonly
	 */
	getLocationLayout(model){
		if(this.deviceModels && this.deviceModels.hasOwnProperty(model) && this.deviceModels[model].hasOwnProperty("layout")){
			return this.deviceModels[model].layout;
		}
		return this._driverJson.locations.layout;
	}
	
	getExtraInputs(model){
		if(this.deviceModels && this.deviceModels.hasOwnProperty(model) && this.deviceModels[model].hasOwnProperty("inputs")){
			return this.deviceModels[model].inputs;
		}
		return this._driverJson.inputs;
	}
	
	getI2C(model){
		if(this.deviceModels && this.deviceModels.hasOwnProperty(model) && this.deviceModels[model].hasOwnProperty("i2c")){
			return this.deviceModels[model].i2c;
		} else{
			return this._driverJson.i2c;
		}
	}
	
	getSupportedProtocols(model){
		if(this.deviceModels && this.deviceModels.hasOwnProperty(model) && this.deviceModels[model].hasOwnProperty("supportedProtocols")){
			return this.deviceModels[model].supportedProtocols || [];
		} else{
			return this._driverJson.supportedProtocols || [];
		}
	}
	
	getProtocolLocations(model){
		if(this.deviceModels && this.deviceModels.hasOwnProperty(model) && this.deviceModels[model].hasOwnProperty("protocolLocations")){
			return this.deviceModels[model].protocolLocations || [];
		} else{
			return this._driverJson.protocolLocations || [];
		}
	}
	
	getNameForSerialPort(vendorId, productId){
		if(this.deviceModels){
			for (const [name, model] of Object.entries(this.deviceModels)) {
				if (
					model.hasOwnProperty("serialIDs")
					&& model.serialIDs.hasOwnProperty(vendorId)
					&& model.serialIDs[vendorId].indexOf(productId) !== -1
				) {
					return name;
				}
			}
		}
		return "Unknown";
	}
	
	/**
	 * The label names that should be displayed in the device's configuration form
	 * @returns {Object.<string, string>} The value of the forms property exactly as defined in the device.json file
	 * @readonly
	 */
	get locationLabels(){
		return this._driverJson.locations.form;
	}
	
	get configForm(){
		return this._driverJson.configForm || {};
	}
	
	get supportedConnections(){
		return this._driverJson.supportedConnections;
	}
	
	get deviceModels(){
		return this._modelsJson;
	}
	
	get formattedName(){
		return this._driverJson.name || this._name;
	}
	
	get name(){
		return this._name;
	}
	
	/**
	 * Parses the location value of the location sections of the device.json file
	 * @param {string|Object} data The location value
	 * @returns {{_o: Array, _io: Array, _i: Array}} The locations described in the location value, grouped by
	 * I/O capabilities
	 * @private
	 */
	static _parseLocationData(data) {
		let res = {
			_i: [],
			_o: [],
			_io: []
		};
		if(typeof data === "object"){
			for(let type in data){
				if(data.hasOwnProperty(type)){
					let key = "_" + (type.length > 2 ? type.charAt(0).toLowerCase() : type.toLowerCase());
					if(res.hasOwnProperty(key)) {
						res[key] = Driver._parseLocationString(data[type]);
					}
				}
			}
		} else if(typeof data === "string"){
			res._io = Driver._parseLocationString(data);
		}
		
		return res;
	}
	
	/**
	 * Parses a location string as defined in the device.json file
	 * @param str The location string
	 * @returns {Array} An array containing the expansion of the location string, each element of this array is a
	 * location identifier
	 * @private
	 */
	static _parseLocationString(str){
		let intervals = str.trim().split(" ");
		let locs = [];
		for(let s of intervals){
			if(s.length > 0){
				let sep = s.indexOf("...");
				if (sep > -1) {
					let a = Number.parseInt(s.substring(0, sep));
					let b = Number.parseInt(s.substring(sep + 3));
					for (let i = a; i <= b; i++)
						if (!locs.includes(i))
							locs.push(i);
				} else {
					let i = Number.parseInt(s);
					if (!locs.includes(i))
						locs.push(i);
				}
			}
		}
		return locs;
	}
	
	static _parseI2C(src){
		if(src.i2c && src.i2c.sda && src.i2c.scl){
			let sda = src.i2c.sda.split(" ");
			src.i2c.sda = {
				type: sda.slice(0, sda.length-1).join(" "),
				value: sda[sda.length-1]
			};
			let scl = src.i2c.scl.split(" ");
			src.i2c.scl = {
				type: scl.slice(0, scl.length-1).join(" "),
				value: scl[scl.length-1]
			};
		}
	}
}

module.exports = Driver;