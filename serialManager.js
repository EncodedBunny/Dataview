const SerialPort = require("serialport");
const Delimiter = require('@serialport/parser-delimiter');

module.exports = function(){
	let module = {};
	let ports = {};
	
	module.getSerialPorts = function() {
		return SerialPort.list();
	};
	
	module.openPort = function(name, options, cmdDelimiter) {
		if(!ports.hasOwnProperty(name)) {
			ports[name] = {
				port: new SerialPort(name, options),
				queue: [],
				currentHandler: undefined
			};
			ports[name].stream = ports[name].port;
			
			if(cmdDelimiter !== undefined)
				ports[name].stream = ports[name].port.pipe(new Delimiter({delimiter: cmdDelimiter}));
			
			ports[name].stream.on('data', data => {
				if(ports[name].currentHandler === undefined)
					_processQueue(name);
				else if(ports[name].currentHandler(data) !== true){
					ports[name].currentHandler = undefined;
					_processQueue(name);
				}
			});
			return true;
		}
		return false;
	};
	
	module.sendData = function(name, data, onResponse){
		if(!ports.hasOwnProperty(name)) return false;
		let toSend = (!Buffer.isBuffer(data) && typeof data !== "string" && !Array.isArray(data)) ?
			Buffer.from([typeof data === "object" ? JSON.stringify(data) : data]) : data;
		ports[name].queue.push({
			data: toSend,
			handler: onResponse
		});
		_processQueue(name);
		return true;
	};
	
	module.closePort = function(name) {
		if(ports.hasOwnProperty(name)) {
			return new Promise((resolve, reject) => {
				ports[name].port.drain(err => {
					if(err) reject(err);
					ports[name].port.close(err2 => {
						if(err2) reject(err2);
						delete ports[name];
						resolve();
					});
				});
			});
		}
		return undefined;
	};
	
	function _processQueue(name){
		if(ports[name].queue.length > 0 && ports[name].currentHandler === undefined){
			let cmd = ports[name].queue.pop();
			ports[name].currentHandler = cmd.handler;
			ports[name].port.write(cmd.data);
		}
	}
	
	return module;
};