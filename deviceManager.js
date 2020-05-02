const Dataflow = require("./dataflow");
const uuid = require("uuid/v4");
let Device = require("./device");

/**
 * @module DeviceManager
 */
module.exports = function (driverManager) {
	let module = {};
	let devices = {};
	
	/**
	 * Creates and registers a new device
	 * @param {string} name The user given name for this device
	 * @param {string} type The brand or model of this device, as it will be displayed to the user
	 * @param {Object} extraData The device specific information obtained from the forms provided by the device's driver,
	 * if the driver did not provide a form, then this parameter may be null
	 * @returns {undefined|string} The id of the registered device, or undefined if an error occurred
	 */
	module.addDevice = function(name, type, extraData, model){
		if(!name) return undefined;
		let nameT = name.trim();
		if(nameT.length <= 0 || module.getDeviceByName(nameT) !== undefined) return undefined;
		let driver = driverManager.getDriver(type);
		let id;
		do{
			id = uuid();
		} while(devices[id] !== undefined);
		let device = new Device(id, nameT, extraData, type, model);
		if(driver.attachDevice(device)){
			devices[id] = device;
			return id;
		}
		return undefined;
	};
	
	/**
	 * Registers a sensor to an existing device and adds it's node to be used in Dataflow programming
	 * @param {string} deviceID The id of the device
	 * @param {string} name The user given name for this sensor
	 * @param {Location} location The location of this sensor
	 * @param {Object} extraData If the driver requires additional information, it should be provided via this parameter,
	 * usually this parameter is undefined
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	module.addSensor = function(deviceID, name, location, extraData){
		if(!name) return false;
		let senName = name.trim();
		if(senName <= 0) return false;
		let device = devices[deviceID];
		if(!device) return false;
		let id = uuid(); // TODO: Verify uniqueness with respect to all devices (or a faster alternative, maybe global UUIDs)
		if(device.addSensor(id, senName, location, extraData)){
			Dataflow.registerGlobalNode(senName + " (" + device.name + ")", "Sensors", [], ["value"], async () => {
				let x = await device.driver.getSensorValue(device.id, id);
				return [x];
			});
			return true;
		}
		return false;
	};
	
	/**
	 * Registers an actuator to an existing device and adds it's node to be used in Dataflow programming
	 * @param {string} deviceID The id of the device
	 * @param {string} name The user given name for this actuator
	 * @param {Location} location The location of this actuator
	 * @param {Object} extraData If the driver requires additional information, it should be provided via this parameter,
	 * usually this parameter is undefined
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	module.addActuator = function(deviceID, name, location, extraData){
		if(!name) return false;
		let actName = name.trim();
		if(actName <= 0) return false;
		let device = devices[deviceID];
		if(!device) return false;
		let id = uuid(); // TODO: Verify uniqueness with respect to all devices (or a faster alternative, maybe global UUIDs)
		if(device.addActuator(id, actName, location, extraData)){
			Dataflow.registerGlobalNode(actName + " (" + device.name + ")", "Actuators", ["value"], [], async (input) => {
				try {
					await device.driver.setActuatorValue(device.id, id, input[0]);
					return [];
				} catch(e){
					return undefined;
				}
			});
			return true;
		}
		return false;
	};
	
	/**
	 * Modifies a configuration of an existing sensor without having to remove and add it again
	 * @param {string} deviceID The id of the device that holds this sensor
	 * @param {string} sensorID The id of the sensor
	 * @param {Location} location The new (or unmodified) location of this sensor
	 * @param {Object} extraData The new (or unmodified) data used by the driver
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	module.configureSensor = function(deviceID, sensorID, location, extraData){
		let device = devices[deviceID];
		if(!device) return false;
		let res = device.driver.configureSensor(device.id, sensorID, extraData); // TODO: Incomplete, completely ignores location
		if(res) device.sensors[sensorID].loc = location;
		return res;
	};
	
	/**
	 * Modifies a configuration of an existing actuator without having to remove and add it again
	 * @param {string} deviceID The id of the device that holds this actuator
	 * @param {string} actuatorID The id of the actuator
	 * @param {Location} location The new (or unmodified) location of this actuator
	 * @param {Object} extraData The new (or unmodified) data used by the driver
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	module.configureActuator = function(deviceID, actuatorID, location, extraData){
		let device = devices[deviceID];
		if(!device) return false;
		let res = device.driver.configureActuator(device.id, actuatorID, extraData); // TODO: Incomplete, completely ignores location
		if(res) device.actuators[actuatorID].loc = location;
		return res;
	};
	
	/**
	 * Removes an existing sensor from a device
	 * @param deviceID The id of the device
	 * @param sensorID The id of the sensor
	 * @returns {boolean} True if the sensor was removed, false otherwise
	 */
	module.removeSensor = function(deviceID, sensorID){
		let device = devices[deviceID];
		if(!device) return false;
		let status = device.driver.detachSensor(device.id, sensorID);
		if(status) delete device.sensors[sensorID];
		return status;
	};
	
	/**
	 * Retrieves the current registered devices
	 * @returns {Array.<{id: string, device: Object}>} An array of objects where each object contains a devices id and
	 * it's information, as provided by the {@link Device#webInfo} function
	 */
	module.getDevices = function() {
		let res = [];
		for(const id of Object.keys(devices)) {
			res.push({id: id, device: devices[id].webInfo});
		}
		return res;
	};
	
	/**
	 * Retrieves an array of the current registered devices' {@link Device} instances
	 * @returns {Device[]} An array of the current registered devices without their ids
	 */
	module.getDeviceList = function(){
		return Object.values(devices);
	};
	
	/**
	 * Retrieves a single registered device by it's id
	 * @param {string} id The id of the device
	 * @returns {Device|undefined} The device that matches the id parameter or undefined if none match
	 */
	module.getDevice = function(id) {
		return devices[id];
	};
	
	/**
	 * Retrieves a single registered device by it's user given name
	 * @param {string} name The user given name of the device
	 * @returns {Device|undefined} The device that possesses the same user given name as the name parameter or undefined
	 * if one is not found
	 */
	module.getDeviceByName = function(name) {
		for(const device of Object.values(devices))
			if(device.name === name)
				return device;
		return undefined;
	};
	
	/**
	 * Retrieves a registered sensor from a registered device
	 * @param {string} deviceId The id of the device
	 * @param {string} sensorId The id of the sensor
	 * @returns {LocationHolder|undefined} The location and name of the sensor or undefined if one is not found
	 */
	module.getSensor = function(deviceId, sensorId){
		let device = devices[deviceId];
		if(device)
			return device.sensors[sensorId];
		return undefined;
	};
	
	return module;
};