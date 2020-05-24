const SerialPort = require("serialport");
const Delimiter = require('@serialport/parser-delimiter');
const Ready = require('@serialport/parser-ready');

let ports = {};
let availablePorts = [];

module.exports = {
	getSerialPorts: function() {
		return new Promise(resolve => {
			SerialPort.list().then(pts => {
				let inUse = Object.keys(ports);
				availablePorts = pts.filter(port => {
					return inUse.indexOf(port.comName.trim()) === -1;
				});
				resolve(availablePorts);
			});
		});
	},
	getCachedSerialPorts: function(){
		module.exports.getSerialPorts();
		return availablePorts;
	},
	openPort: function(name, options, cmdDelimiter, readySequence, onReady) {
		let n = name.trim();
		if(!ports.hasOwnProperty(n)) {
			ports[n] = {
				port: new SerialPort(n, options),
				queue: [],
				currentHandler: undefined,
				isReady: false
			};
			ports[n].stream = ports[n].port;
			
			let finishInit = () => {
				ports[n].port.drain();
				
				if(cmdDelimiter !== undefined)
					ports[n].stream = ports[n].port.pipe(new Delimiter({delimiter: cmdDelimiter}));
				
				ports[n].isReady = true;
				ports[n].stream.on("data", data => {
					if(ports[n].currentHandler === undefined)
						_processQueue(n);
					else if(ports[n].currentHandler(data) !== true){
						ports[n].currentHandler = undefined;
						_processQueue(n);
					}
				});
			};
			
			if(readySequence !== undefined) {
				ports[n].stream = ports[n].port.pipe(new Ready({delimiter: readySequence}));
				ports[n].stream.on("ready", () => {
					finishInit();
					if(onReady && typeof onReady === "function")
						onReady();
				});
			} else
				finishInit();
			
			return true;
		}
		return false;
	},
	sendData: function(name, data, onResponse){
		let n = name.trim();
		if(!ports.hasOwnProperty(n)) return false;
		let toSend = (!Buffer.isBuffer(data) && typeof data !== "string" && !Array.isArray(data)) ?
			Buffer.from([typeof data === "object" ? JSON.stringify(data) : data]) : data;
		ports[n].queue.push({
			data: toSend,
			handler: onResponse
		});
		_processQueue(n);
		return true;
	},
	changeDelimeter: function(name, delimiter){
		if(delimiter !== undefined) {
			ports[name].stream = ports[name].port.pipe(new Delimiter({delimiter: delimiter}));
		} else{
			ports[name].stream = ports[name].port;
		}
	},
	closePort: function(name) {
		let n = name.trim();
		if(ports.hasOwnProperty(n)) {
			return new Promise((resolve, reject) => {
				ports[n].port.drain(err => {
					if(err) reject(err);
					ports[n].port.close(err2 => {
						if(err2) reject(err2);
						delete ports[n];
						resolve();
					});
				});
			});
		}
		return undefined;
	},
	isReady: function (name) {
		let n = name.trim();
		return ports.hasOwnProperty(n) && ports[n].isReady;
	},
	getPort: function (name) {
		let n = name.trim();
		return ports.hasOwnProperty(n) ? ports[n].port : undefined;
	}
};

module.exports.getSerialPorts();

setInterval(module.exports.getSerialPorts,10*1000);

function _processQueue(name){
	if(ports[name].queue.length > 0 && ports[name].currentHandler === undefined){
		let cmd = ports[name].queue.pop();
		ports[name].currentHandler = cmd.handler;
		ports[name].port.write(cmd.data);
	}
}