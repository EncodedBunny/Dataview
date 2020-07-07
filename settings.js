const fs = require("fs");
const path = require("path");

const settingsFile = path.join(__dirname, "settings.json");
let pendingUpdate = -1;
let changesPending = false;

let settings = {};
let listeners = {};

let tmp = JSON.parse(fs.readFileSync(settingsFile).toString("utf8"));
for(let key of Object.keys(tmp)){
	settings[key] = tmp[key];
}

fs.watch(settingsFile, () => {
	if(pendingUpdate === -1){
		pendingUpdate = setTimeout(() => {
			pendingUpdate = -1;
			let tmp = JSON.parse(fs.readFileSync(settingsFile).toString("utf8"));
			for(let key of Object.keys(settings)){
				let val = tmp[key];
				if(settings[key] !== val){
					settings[key] = val;
					if(listeners.hasOwnProperty(key)){
						for(let listener of listeners[key]){
							listener(val);
						}
					}
				}
			}
		}, 1000);
	}
});

setInterval(() => {
	if(changesPending){
		changesPending = false;
		fs.writeFileSync(settingsFile, JSON.stringify(settings));
	}
}, 5000);

module.exports = {
	/**
	 * Retrieves a value from the settings file that maps to the key provided
	 * @param {string} key The key that maps to the desired value in the settings file
	 * @param {Function} [callback] A callback that will be called every time the value mapped to this key changes, the
	 * new value will be passed as the only argument to this callback
	 * @returns {number|boolean|string|undefined} The value mapped to this key, or undefined if either this key is not
	 * mapped to anything or if the callback parameter was passed, in which case the value associated with the key will
	 * be passed as a argument to the callback
	 */
	getSetting: function(key, callback){
		if(callback !== undefined){
			if(!listeners.hasOwnProperty(key)){
				listeners[key] = [];
			}
			listeners[key].push(callback);
			callback(settings[key]);
		} else{
			return settings[key];
		}
	},
	/**
	 * Sets a value to be mapped by the provided key in the settings file, overriding the previous value mapped to this
	 * key, if any
	 * @param {string} key The key that will be used to map this value
	 * @param {number|boolean|string} value The value mapped by this key
	 * @returns {number|boolean|string|undefined} The previous value mapped to this key, or undefined if none
	 */
	setSetting: function(key, value){
		let prev = settings[key];
		if(prev !== value) {
			settings[key] = value;
			changesPending = true;
		}
		return prev;
	}
};