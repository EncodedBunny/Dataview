/**
 * Contains a list of locations of a device, grouped by I/O capabilities
 * @typedef {Object} LocationList
 * @property {Array} _i An array containing locations that only support input (can only be used as sensors)
 * @property {Array} _o An array containing locations that only support output (can only be used as actuators)
 * @property {Array} _io An array containing locations that can be used for both input and output
 */

/**
 * Represent a single location in a device
 * @typedef {Object} Location
 * @property {string} value The identifier of this location, this can be either unique for the whole device or for a
 * location group if it exists
 * @property {string} type The location group of this location, if the device does not have any location groups this
 * property will not be defined
 */

/**
 * Contains the information of a single location holder, which can be either a sensor or an actuator
 * @typedef {Object} LocationHolder
 * @property {string} name The user given name of this location holder
 * @property {Location} loc The location of this location holder in the device
 */
class Device{
	/**
	 * Creates a new device instance, representing a single physical device
	 * @param {string} id The id of this device
	 * @param {string} name The user given name of this device
	 * @param {Object} extraData The device specific data that will be used by the device driver
	 * @param {string} formattedName The brand or model of the physical device
	 * @param {string|undefined} model This device's model, or undefined if there is only one supported model
	 */
	constructor(id, name, extraData, formattedName, model){
		this._id = id;
		this._name = name;
		this._driver = undefined;
		this._deviceType = formattedName;
		this._model = model;
		this._extraData = extraData;
		this._sensors = {};
		this._actuators = {};
		this._locations = undefined;
	}
	
	/**
	 * The id for this device
	 * @type {string}
	 * @readonly
	 */
	get id(){
		return this._id;
	}
	
	/**
	 * The user given name for this device
	 * @type {string}
	 * @readonly
	 */
	get name(){
		return this._name;
	}
	
	/**
	 * The brand or model of the physical device in a format that will be displayed to the user
	 * @type {string}
	 * @readonly
	 */
	get deviceType(){
		return this._deviceType;
	}
	
	/**
	 * The driver responsible for this device
	 * @type {Driver}
	 * @readonly
	 */
	get driver(){
		return this._driver;
	}
	
	/**
	 * The device specific data that was provided by the user filled configuration form, usually this data will only be
	 * used by the device's driver
	 * @type {Object}
	 * @readonly
	 */
	get extraData(){
		return this._extraData;
	}
	
	get model(){
		return this._model;
	}
	
	/**
	 * The sensors of this device, where the sensor ids are the keys and their location information are the values
	 * @type {Object.<string, LocationHolder>}
	 * @readonly
	 */
	get sensors(){
		return this._sensors;
	}
	
	/**
	 * The actuators of this device, where the actuator ids are the keys and their location information are the values
	 * @type {Object.<string, LocationHolder>}
	 * @readonly
	 */
	get actuators(){
		return this._actuators;
	}
	
	/**
	 * The current available locations of this device, it is either an object containing the current free locations in
	 * this device grouped by I/O capabilities, or an object with the location group types as keys and the I/O grouped
	 * locations as keys
	 * @type {LocationList|Object.<string, LocationList>}
	 * @readonly
	 */
	get locations(){
		return this._locations;
	}
	
	/**
	 * Registers a sensor to a free location of this device
	 * @param {string} id A global unique identifier for this sensor
	 * @param {string} name The sensor's name
	 * @param {Location} location The location in this device for this sensor
	 * @param {object} extraData
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	addSensor(id, name, location, extraData){
		if(this.driver.attachSensor(this.id, id, location, extraData))
			return this._registerLocation(id,"_sensors","i", name, location);
		return false;
	}
	
	/**
	 * Registers an actuator to a free location of this device
	 * @param {string} id A global unique identifier for this actuator
	 * @param {string} name The actuator's name
	 * @param {Location} location The location in this device for this actuator
	 * @param {object} extraData
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	addActuator(id, name, location, extraData){
		if(this.driver.attachActuator(this.id, id, location, extraData))
			return this._registerLocation(id,"_actuators","o", name, location);
		return false;
	}
	
	/**
	 * Serves as a common function between the addSensor and addActuator functions, adds a LocationHolder as a value to
	 * the informed location with the id as key, removing the location for the available locations object
	 * @param {string} id The identifier of this location holder
	 * @param {string} array The object name that will store this location holder
	 * @param {'i'|'o'} capability The needed capability of this location
	 * @param {string} name The user given name of this location holder
	 * @param {Location} location The location
	 * @returns {boolean} True if the location was successfully registered, false otherwise
	 * @private
	 */
	_registerLocation(id, array, capability, name, location){
		if(this._locations.hasOwnProperty("_io") !== (location.type === undefined)) return false;
		let locList;
		if(this._locations.hasOwnProperty("_io")) {
			locList = this._locations;
		} else{
			if(!this._locations.hasOwnProperty(location.type)) return false;
			locList = this._locations[location.type];
		}
		if(locList._io.includes(Number.parseInt(location.value))){
			locList._io.remove(location.value);
		} else if(locList["_" + capability].includes(Number.parseInt(location.value))){
			locList["_" + capability].remove(location.value);
		} else {
			return false;
		}
		this[array][id] = {
			name: name,
			loc: location
		};
		return true;
	}
}

module.exports = Device;