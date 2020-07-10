const Dataflow = require("./dataflow");
const uuid = require("uuid/v4");
let Device = require("./device");

const peripherals = {
	"Max6675": require("./peripherals/max6675"),
	"BMP280": require("./peripherals/bmp280")
};

/**
 * Manages all the devices, used to add/remove devices, aswell as sensors and actuators to them
 * @module DeviceManager
 */
module.exports = function (driverManager) {
	/**
	 * @exports DeviceManager
	 */
	let module = {};
	let devices = {};
	
	/**
	 * Creates and registers a new device
	 * @param {string} name The user given name for this device
	 * @param {string} type The brand or model of this device, as it will be displayed to the user
	 * @param {Object} extraData The device specific information obtained from the forms provided by the device's driver,
	 * if the driver did not provide a form, then this parameter may be null
	 * @returns {Promise} The id of the registered device, or undefined if an error occurred
	 */
	module.addDevice = function(name, type, extraData, model){
		return new Promise((resolve, reject) => {
			if(!name) return reject();
			let nameT = name.trim();
			if(nameT.length <= 0 || module.getDeviceByName(nameT) !== undefined) return reject();
			let driver = driverManager.getDriver(type);
			let id = uuid();
			let device = new Device(id, nameT, extraData, type, model);
			driver.attachDevice(device).then(() => {
				devices[id] = device;
				resolve(id);
			}).catch(reject);
		});
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
		let id = uuid();
		if(device.addSensor(id, senName, location, extraData)){
			Dataflow.registerGlobalNode(senName + " (" + device.name + ")", "Sensors", [], ["value"], async () => {
				let x = await device.driver.getSensorValue(device.id, id);
				return [x];
			});
			return true;
		}
		return false;
	};
	
	module.addPeripheral = function(deviceID, name, model, extraData){
		if(!name) return false;
		let perName = name.trim();
		if(perName <= 0) return false;
		let device = devices[deviceID];
		if(!device) return false;
		let id = uuid();
		let peripheral = peripherals[model];
		if(peripheral.onCreate !== undefined){
			device.addPeripheral(id, perName, peripheral.protocols, peripheral.onCreate(device, extraData), extraData);
			let worker;
			if(peripheral.dataflow.worker[Symbol.toStringTag] === "AsyncFunction"){
				worker = async () => {
					return await peripheral.dataflow.worker(device, extraData, ...arguments);
				};
			} else{
				worker = () => {
					return peripheral.dataflow.worker(device, extraData, ...arguments);
				}
			}
			Dataflow.registerGlobalNode(perName + " (" + device.name + ")", "Peripherals", peripheral.dataflow.inputs, peripheral.dataflow.outputs, worker);
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
		let id = uuid();
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
			res.push({id: id, device: devices[id]});
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
	
	module.getPeripheralForm = function(deviceId, model){
		let form = peripherals[model].form;
		let device = devices[deviceId];
		let protLocs = device.driver.getProtocolLocations(device.model);
		
		for(let field of Object.values(form)){
			if(field.type.startsWith("location")){
				field.items = [];
				if(field.type.indexOf("_") > -1 && field.type.lastIndexOf("_") < field.type.length-1) {
					let capability = field.type.split("_")[1];
					switch (capability) {
						case "spi":
							for(let type of protLocs["spi"]){
								let locs = device.locations[type]._io.map((loc) => {
									return type + " " + loc;
								});
								field.items.push(...locs);
							}
							break;
					}
				}
				field.type = "list";
			}
		}
		return form;
	};
	
	module.getPeripherals = function(availableProtocols){
		let res = {};
		for(let [model, peripheral] of Object.entries(peripherals)){
			if(peripheral.protocols.every(p => availableProtocols.includes(p))){
				res[model] = peripheral;
			}
		}
		return res;
	};
	
	/**
	 * Sets the I2C status in a device, if the device does not support I2C this operation will fail
	 * @param {string} deviceId The id of the device
	 * @param {boolean} enabled Whether to enable or disable I2C
	 * @returns {boolean} True if the I2C status was changed, false if the operation fails
	 */
	module.setI2C = function(deviceId, enabled){
		let device = devices[deviceId];
		if(!device) return false;
		return device.setI2C(enabled);
	};
	
	return module;
};