const DF_FILE_NODE_PATH = 0;
const DF_FILE_NODE_POSITION = 1;
const DF_FILE_NODE_PROPERTIES = 2;

const DF_FILE_POSITION_X = 0;
const DF_FILE_POSITION_Y = 1;

const DF_FILE_CON_FROM_NODE = 0;
const DF_FILE_CON_FROM_SLOT = 1;
const DF_FILE_CON_TO_NODE = 2;
const DF_FILE_CON_TO_SLOT = 3;

/**
 * Represents a slot name that also has type information
 * @typedef {Object} Dataflow~TypedName
 * @property {string} name The name of the slot
 * @property {string} type The type of data that the slot handles
 */
class Dataflow {
	/**
	 * Creates a new empty dataflow
	 */
	constructor(){
		this.flowTree = [];
		this.structure = {nodes: [], connections: [], transform: [1, 0, 0, 1, 0, 0]};
		this._registeredNodes = {};
	}
	
	/**
	 * Connects two nodes in this dataflow
	 * @param {Node} fromNode The node from where the connection will start
	 * @param {number} fromIndex The output slot index of the start node
	 * @param {Node} toNode The node to where the connection will go
	 * @param {number} toIndex The input slot index of the end node
	 * @param {boolean} dontEvaluate Whether the end node's hierarchical position should be evaluated and the node node
	 * be moved to this position
	 * @returns {boolean} True if the connection was made, false otherwise
	 */
	connect(fromNode, fromIndex, toNode, toIndex, dontEvaluate){
		if(this._insideTree(fromNode) && this._insideTree(toNode)){
			let success = fromNode.connectOutput(fromIndex, toNode, toIndex);
			if(success && dontEvaluate !== true) this._evaluateDeepness(toNode);
			return success;
		}
		return false;
	}
	
	/**
	 * Activates the nodes in this dataflow, layer by layer. If nodes required to the activation of other nodes fail, then
	 * the activation of these nodes will fail aswell
	 */
	async activate(){
		for(const node of this.flowTree[0])
			await node.activate();
	}
	
	/**
	 * Loads a dataflow structure into this dataflow, overriding it's current structure
	 * @param {Object} fileStructure The dataflow structure, this structure comes from a JSON file that possess the following
	 * format:
	 * {
	 *     nodes: [
	 *     		[<path>, <position>, {<properties>}],
	 *     		["category/title", [1, 2], {"prop1": 5}], <-- Node of path "category/title" positioned at x: 1, y: 2 with
	 *     		...															one property named "prop1" with the value of 5
	 *     ],
	 *     connections: [
	 *     		[<fromNode>, <fromSlot>, <toNode>, <toIndex>],
	 *     		[0, 1, 2, 0], <-- Connection from the second slot of the node at "nodes" array index 0 to the first slot
	 *     		...				  of the node index 2
	 *     ],
	 *     transform: [number, number, number, number, number, number] <-- The six values of the 2D transformation
	 * }																   DOMMatrix of the DataflowEditor's canvas
	 */
	loadFileStructure(fileStructure){
		if(fileStructure === undefined) return;
		this.flowTree = [];
		let indexConversion = [];
		
		for(const index in fileStructure.nodes){
			let metaNode = fileStructure.nodes[index];
			if(!Dataflow._checkFileArray(metaNode,DF_FILE_NODE_PROPERTIES+1)) continue;
			let position = metaNode[DF_FILE_NODE_POSITION], props = metaNode[DF_FILE_NODE_PROPERTIES];
			if(!Dataflow._checkFileArray(position,DF_FILE_POSITION_Y+1)) continue;
			let node = this.createNode(metaNode[DF_FILE_NODE_PATH], position[DF_FILE_POSITION_X],
				position[DF_FILE_POSITION_Y], props);
			if(!node) continue;
			indexConversion[index] = this.addNode(node);
		}
		
		metaConnectionLoop:
			for(const metaConnection of fileStructure.connections){
				if(!Dataflow._checkFileArray(metaConnection,DF_FILE_CON_TO_SLOT+1)) continue;
				for(const index of metaConnection)
					if(!Number.isInteger(index) || index < 0) continue metaConnectionLoop;
				let originNodeLoc = indexConversion[metaConnection[DF_FILE_CON_FROM_NODE]],
					destNodeLoc = indexConversion[metaConnection[DF_FILE_CON_TO_NODE]];
				if(originNodeLoc === undefined || destNodeLoc === undefined || !this.flowTree[originNodeLoc.level] || !this.flowTree[destNodeLoc.level]) continue;
				let originNode = this.flowTree[originNodeLoc.level][originNodeLoc.index],
					originSlot = metaConnection[DF_FILE_CON_FROM_SLOT],
					destNode = this.flowTree[destNodeLoc.level][destNodeLoc.index],
					destSlot = metaConnection[DF_FILE_CON_TO_SLOT];
				if(originSlot >= originNode.outputNumber || destSlot >= destNode.inputNumber) continue;
				this.connect(originNode, originSlot, destNode, destSlot, true);
			}
		
		this._iterateNodes(node => {
			this._evaluateDeepness(node);
		});
		
		this.structure.transform = fileStructure.transform;
	}
	
	verifyFileStructure(fileStructure){
		return !(!fileStructure.hasOwnProperty("nodes")
			|| !fileStructure.hasOwnProperty("connections")
			|| !fileStructure.hasOwnProperty("transform")
			|| fileStructure.nodes.constructor !== Array
			|| fileStructure.connections.constructor !== Array
			|| fileStructure.transform.constructor !== Array
			|| fileStructure.transform.length < 6);
	}
	
	getNodesByPath(path){
		let result = [];
		this._iterateNodes(node => {
			if(node.nodePath === path) result.push(node);
		});
		return result;
	}
	
	/**
	 * Inserts a node in this dataflow and moves it to it's correct hierarchical position
	 * @param {Node} node The node to be inserted
	 * @returns {boolean} True if the operation was a success, false otherwise
	 */
	addNode(node){
		this._ensureTreeLevel(node.numberOfInputs);
		this.flowTree[node.numberOfInputs].push(node);
		return this._evaluateDeepness(node);
	}
	
	/**
	 * Registers a node type to this {@link Dataflow} instance
	 * @param {string} title The node's title
	 * @param {string} category The node's category
	 * @param {Array.<(string|Dataflow~TypedName)>} inputLabels The names of the input slots, the size of this array will also determine the
	 * number of input slots
	 * @param {Array.<(string|Dataflow~TypedName)>} outputLabels The names of the output slots, the size of this array will also determine
	 * the number of output slots
	 * @param {function} workerFunction The function which will receive this node's input data and produce it's output
	 * data, aswell as doing any other actions that should be made at the moment of the node activation
	 * @param {Object.<string, *>} [defaultProperties] The default values for the properties of this node, this will be
	 * used not only to define the defaults of each property, but also to define what properties the node has
	 * @returns {string} The unique path of this node, or an empty string if the registration failed
	 */
	registerNode(title, category, inputLabels, outputLabels, workerFunction, defaultProperties){
		let cat = Dataflow._cleanString(category);
		let t = Dataflow._cleanString(title);
		if(!this._registeredNodes.hasOwnProperty(cat)) this._registeredNodes[cat] = {name: category, nodes: {}};
		if(!this._registeredNodes[cat].nodes.hasOwnProperty(t)){
			let prop = defaultProperties || {};
			if(!prop.hasOwnProperty("name"))
				prop.name = title;
			this._registeredNodes[cat].nodes[t] = {title: title, category: category, inputLabels: inputLabels, outputLabels: outputLabels, workerFunction: workerFunction, defaultProperties: prop};
			return cat + "/" + t;
		}
		return "";
	}
	
	/**
	 * Creates a new {@link Node} instance of an already registered node type
	 * @param {string} path The path of the node type, as returned by the {@link Dataflow#registerNode} function
	 * @param {number} x The editor window x coordinate of this node
	 * @param {number} y The editor window y coordinate of this node
	 * @param {Object.<string, *>} properties The values for the properties of this node instance
	 * @returns {Node|undefined} The generated node instance, or undefined if the creation failed
	 */
	createNode(path, x, y, properties){
		let splitPath = path.split("/");
		if(splitPath.length !== 2) return undefined;
		let category = splitPath[0], nodeTitle = splitPath[1];
		if((!this._registeredNodes.hasOwnProperty(category)
			|| !this._registeredNodes[category].nodes.hasOwnProperty(nodeTitle))
			&& (!Dataflow._registeredNodes.hasOwnProperty(category)
				|| !Dataflow._registeredNodes[category].nodes.hasOwnProperty(nodeTitle))) return undefined;
		let nodeSpec = this._registeredNodes.hasOwnProperty(category) ? this._registeredNodes[category].nodes[nodeTitle]
			|| Dataflow._registeredNodes[category].nodes[nodeTitle] : Dataflow._registeredNodes[category].nodes[nodeTitle];
		return new Node(nodeSpec.inputLabels.length, nodeSpec.outputLabels.length, x, y, nodeSpec.workerFunction, path, properties);
	}
	
	/**
	 * Generates a JSON object compliant with the dataflow file format defined in the beginning of this file that contains
	 * the current structure of this dataflow
	 * @returns {Object} The structure of this object as a JSON object
	 */
	get fileStructure(){
		this.structure.nodes = [];
		this.structure.connections = [];
		this._iterateNodes(node => this.structure.nodes.push([node.nodePath, node.position, node.properties]));
		for(let n = 0; n < this.structure.nodes.length; n++){
			let fromNode = this.structure.nodes[n];
			for(let x = 0; x < fromNode.connections.length; x++)
				for(let c = 0; c < fromNode.connections[x].connections.length; c++){
					let con = fromNode.connections[x].connections[c];
					for(let t = 0; t < this.structure.nodes.length; t++)
						if(this.structure.nodes[t] === con.node)
							this.structure.connections.push([n, x, t, con.index]);
				}
		}
		return this.structure;
	}
	
	get webStructure(){
		this.structure.registeredNodes = this._registeredNodes;
		// for(const cat of Object.keys(this._registeredNodes)){
		// 	this.structure.registeredNodes[cat] = {name: this._registeredNodes[cat].name, nodes: {}};
		// 	for(const node of Object.keys(this._registeredNodes[cat].nodes)){
		// 		let n = this._registeredNodes[cat][node];
		// 		let webNode = {};
		// 		for(const key of Object.keys(n)){
		// 			if(key !== "workerFunction")
		// 				webNode[key] = n[key];
		// 		}
		// 		this.structure.registeredNodes[cat][node] = webNode;
		// 	}
		// }
		this.structure.nodes = [];
		this.structure.connections = [];
		this._iterateNodes(node => {
			this.structure.nodes.push({path: node.path, position: node.position, properties: node.properties})
		});
		let n = 0;
		this._iterateNodes(fromNode => {
			for(let x = 0; x < fromNode.connections.length; x++)
				for(let c = 0; c < fromNode.connections[x].connections.length; c++){
					let con = fromNode.connections[x].connections[c];
					let t = 0;
					this._iterateNodes(toNode => {
						if(toNode === con.node) {
							this.structure.connections.push({fromNode: n, fromSlot: x, toNode: t, toSlot: con.index});
							return true;
						}
						t++;
					});
				}
			n++;
		});
		return this.structure;
	}
	
	_evaluateDeepness(node){
		if(this._insideTree(node)){
			let level = 0;
			for(const connection of Object.values(node.inputConnections))
				if(connection.owner.deepness+1 > level)
					level = connection.owner.deepness+1;
			return this._moveInTree(node, level);
		}
		return undefined;
	}
	
	_moveInTree(node, level){
		for(let i = 0; i < this.flowTree[node.deepness].length; i++)
			if(this.flowTree[node.deepness][i] === node){
				let n = this.flowTree[node.deepness][i];
				this.flowTree[node.deepness].splice(i, 1);
				this._ensureTreeLevel(level);
				n.deepness = level;
				this.flowTree[level].push(n);
				return {level: level, index: this.flowTree[level].length-1};
			}
		return undefined;
	}
	
	_insideTree(node){
		return this._iterateNodes(n => n === node);
	}
	
	_iterateNodes(callback, reverse){
		if(reverse) {
			for (let i = this.flowTree.length - 1; i >= 0; i--)
				if(this.flowTree[i])
					for(let n = this.flowTree[i].length-1; n >= 0; n--)
						if(callback(this.flowTree[i][n]))
							return true;
		}else {
			for (const level of this.flowTree)
				if(level)
					for(const n of level)
						if(callback(n))
							return true;
		}
		return false;
	}
	
	_ensureTreeLevel(level){
		if(!this.flowTree[level]) this.flowTree[level] = [];
	}
	
	// TODO: Move to another place
	static _cleanString(str){
		return str.trim().toLowerCase().split(" ").join("-").replace(/[^a-z0-9\-]+/gi, "");
	}
	
	// TODO: Add support for undefined number of inputs
	/**
	 * Registers a node type to all {@link Dataflow} instances
	 * @param {string} title The node's title
	 * @param {string} category The node's category
	 * @param {Array.<(string|Dataflow~TypedName)>} inputLabels The names of the input slots, the size of this array will also determine the
	 * number of input slots
	 * @param {Array.<(string|Dataflow~TypedName)>} outputLabels The names of the output slots, the size of this array will also determine
	 * the number of output slots
	 * @param {function} workerFunction The function which will receive this node's input data and produce it's output
	 * data, aswell as doing any other actions that should be made at the moment of the node activation
	 * @param {Object.<string, *>} [defaultProperties] The default values for the properties of this node, this will be
	 * used not only to define the defaults of each property, but also to define what properties the node has
	 * @returns {string} The unique path of this node, or an empty string if the registration failed
	 */
	static registerGlobalNode(title, category, inputLabels, outputLabels, workerFunction, defaultProperties){
		let cat = Dataflow._cleanString(category);
		let t = Dataflow._cleanString(title);
		if(!Dataflow._registeredNodes.hasOwnProperty(cat)) Dataflow._registeredNodes[cat] = {name: category, nodes: {}};
		if(!Dataflow._registeredNodes[cat].nodes.hasOwnProperty(t)){
			let prop = defaultProperties || {};
			if(!prop.hasOwnProperty("name"))
				prop.name = title;
			Dataflow._registeredNodes[cat].nodes[t] = {title: title, category: category, inputLabels: inputLabels, outputLabels: outputLabels, workerFunction: workerFunction, defaultProperties: prop};
			return cat + "/" + t;
		}
		return "";
	}
	
	static unregisterNode(path){
		let splitPath = path.split("/");
		if(splitPath.length !== 2) return false;
		let category = splitPath[0], nodeTitle = splitPath[1];
		if(!Dataflow._registeredNodes.hasOwnProperty(category) || !Dataflow._registeredNodes[category].nodes.hasOwnProperty(nodeTitle)) return false;
		delete Dataflow._registeredNodes[category].nodes[t];
		return true;
	}
	
	static createNodeFromSpec(nodeSpec, x, y, properties){
		return new Node(nodeSpec.inputLabels.length, nodeSpec.outputLabels.length, x, y, nodeSpec.workerFunction, properties);
	}
	
	/**
	 * The node paths available for any dataflow instance
	 * @readonly
	 */
	static get registeredNodes(){
		return Dataflow._registeredNodes;
	}
	
	/**
	 * TODO: Move to file utils file
	 * This function checks whether the value passed to argument "value" is an array and optionally checks if it has a
	 * minimal length of "minLength"
	 * @param value The value to be checked
	 * @param minLength The minimal length expected from this array, this value can be omitted, in which case no check
	 * will be made
	 * @returns {boolean} True if value is an array with the optional specified minimal length, false otherwise
	 * @private
	 */
	static _checkFileArray(value, minLength){
		return value.constructor === Array && (Number.isInteger(minLength) ? value.length >= minLength : true)
	}
}
Dataflow._registeredNodes = {};
Dataflow.registerGlobalNode("Constant Number","Values",[],["value"],(input, props) => {
	return [Number.isInteger(props.value) ? Number.parseInt(props.value) : Number.parseFloat(props.value)];
},{value: 0});
Dataflow.registerGlobalNode("Constant Boolean","Values",[],[{name: "value", type: "boolean"}],(input, props) => {
	return [props.value === "true"];
},{
	value: {
		value: "true",
		possibleValues: ["true", "false"]
	}
});
Dataflow.registerGlobalNode("Random Float","Values",[],["value"],() => {
	return [Math.random()];
});
Dataflow.registerGlobalNode("Random Boolean","Values",[],[{name: "value", type: "boolean"}],() => {
	return [Math.random() >= 0.5];
});
Dataflow.registerGlobalNode("Pi","Values",[],["\uD835\uDF0B"],() => {
	return [Math.PI];
});
Dataflow.registerGlobalNode("Euler's Number","Values",[],["e"],() => {
	return [Math.E];
});
Dataflow.registerGlobalNode("Sum","Math",["x", "y"],["x+y"],(input) => {
	return [input[0]+input[1]];
});
Dataflow.registerGlobalNode("Subtract","Math",["x", "y"],["x-y"],(input) => {
	return [input[0]-input[1]];
});
Dataflow.registerGlobalNode("Multiply","Math",["x", "y"],["x*y"],(input) => {
	return [input[0]*input[1]];
});
Dataflow.registerGlobalNode("Divide","Math",["x", "y"],["x/y"],(input) => {
	return [input[0]/input[1]];
});
Dataflow.registerGlobalNode("Exponentiate","Math",["x", "n"],["x\u207F"],(input) => {
	return [input[0]**input[1]];
});
Dataflow.registerGlobalNode("Sine","Math",["x"],["sin(x)"],(input) => {
	return [Math.sin(x)];
});
Dataflow.registerGlobalNode("Cosine","Math",["x"],["cos(x)"],(input) => {
	return [Math.cos(x)];
});
Dataflow.registerGlobalNode("Tangent","Math",["x"],["tan(x)"],(input) => {
	return [Math.tan(x)];
});
Dataflow.registerGlobalNode("Natural Log","Math",["x"],["ln(x)"],(input) => {
	return [Math.log(x)];
});
Dataflow.registerGlobalNode("Log2","Math",["x"],["log\u2082(x)"],(input) => {
	return [Math.log2(x)];
});
Dataflow.registerGlobalNode("Log10","Math",["x"],["log\u2081\u2080(x)"],(input) => {
	return [Math.log10(x)];
});
Dataflow.registerGlobalNode("If","Control",["x", "y"],[{name: "result", type: "boolean"}],(input, props) => {
	let x = input[0], y = input[1], res;
	switch (props.comparison) {
		default:
		case "x == y":
			res = x === y;
			break;
		case "x != y":
			res = x !== y;
			break;
		case "x < y":
			res = x < y;
			break;
		case "x > y":
			res = x > y;
			break;
		case "x <= y":
			res = x <= y;
			break;
		case "x >= y":
			res = x >= y;
			break;
	}
	return [res];
},{
	comparison: {
		value: "x == y",
		possibleValues: ["x == y", "x != y", "x < y", "x > y", "x <= y", "x >= y"]
	}
});
Dataflow.registerGlobalNode("Branch","Control",["value", {name: "condition", type: "boolean"}],["true", "false"],(input) => {
	return input[1] ? [input[0], undefined] : [undefined, input[0]];
});
Dataflow.registerGlobalNode("Boolean to Number","Conversion",[{name: "boolean", type: "boolean"}],["number"],(input) => {
	return input[0] ? [1] : [0];
});
Dataflow.registerGlobalNode("Analog Voltage","Conversion",["analog"],["voltage"],(input, props) => {
	return [props.maxAnalogVoltage*input[0]/(Math.pow(2, props.adcBitResolution)-1)];
},{
	adcBitResolution: { value: 10 },
	maxAnalogVoltage: { value: 5 }
});

Dataflow.registerGlobalNode("Float to Integer","Conversion",["float"],["integer"],(input, props) => {
	let x = input[0], res;
	switch (props.roundingMode) {
		default:
		case "Round":
			res = Math.round(input[0]);
			break;
		case "Floor":
			res = Math.floor(input[0]);
			break;
		case "Ceil":
			res = Math.ceil(input[0]);
			break;
	}
	return [res];
},{
	roundingMode: {
		value: "Round",
		possibleValues: ["Round", "Floor", "Ceil"]
	}
});

class Node {
	constructor(inputNumber, outputNumber, x, y, workerFunction, path, properties){
		this.inputNumber = inputNumber;
		this.outputNumber = outputNumber;
		this.x = x;
		this.y = y;
		this.path = path;
		this.in = [];
		let i = this.inputNumber;
		while(i--) this.in[i] = undefined;
		this.out = [];
		this.inputSlots = {};
		this.outputSlots = [];
		this.worker = workerFunction;
		this.properties = properties || {};
		this._propVals = {};
		for(let key of Object.keys(this.properties))
			this._propVals[key] = typeof this.properties[key] === "object" && this.properties[key].hasOwnProperty("value") ? this.properties[key].value : this.properties[key];
		for(let i = 0; i < this.outputNumber; i++) {
			let self = {index: i, owner: this, connections: [], connect: (node, index) => {
					self.connections.push({node: node, index: index});
				}, disconnect: (node, index) => {
					self.connections = self.connections.filter(connection => connection.node !== node || connection.index !== index);
				}};
			this.outputSlots[i] = self;
		}
		this.processDeepness = this.inputNumber;
	}
	
	setInput(index, value){
		if(index >= 0 && index < this.in.length) {
			this.in[index] = value;
			return true;
		}
		return false;
	}
	
	async activate(){
		let ready = true;
		for(let i = 0; i < this.in.length; i++)
			if(this.in[i] === undefined) {
				ready = false;
				break;
			}
		if(ready){
			let out;
			if(this.worker[Symbol.toStringTag] === "AsyncFunction")
				out = await this.worker(this.in, this._propVals);
			else
				out = this.worker(this.in, this._propVals);
			if(out.length !== this.outputSlots.length) return false;
			for(let i = 0; i < this.outputSlots.length; i++) {
				this.out[i] = out[i];
				for(const connection of this.outputSlots[i].connections) {
					connection.node.setInput(connection.index, this.out[i]);
					connection.node.activate();
				}
			}
			for(let i = 0; i < this.in.length; i++) this.in[i] = undefined;
			return true;
		}
		return false;
	}
	
	get numberOfInputs(){
		return this.inputNumber;
	}
	
	get numberOfOutputs(){
		return this.outputNumber;
	}
	
	get outputs(){
		return this.out;
	}
	
	get position(){
		return {x: this.x, y: this.y};
	}
	
	get inputConnections(){
		return this.inputSlots;
	}
	
	get connections(){
		return this.outputSlots;
	}
	
	set deepness(val){
		this.processDeepness = val;
	}
	
	get deepness(){
		return this.processDeepness;
	}
	
	get nodePath(){
		return this.path;
	}
	
	connectInput(inputIndex, fromSlot){
		if(Node._checkConnection(inputIndex, this.inputNumber, fromSlot)){
			if(this.inputSlots[inputIndex]) this.inputSlots[inputIndex].disconnect(this, inputIndex);
			this.inputSlots[inputIndex] = fromSlot;
			fromSlot.connect(this, inputIndex);
			return true;
		}
		return false;
	}
	
	connectOutput(outputIndex, toNode, toIndex){
		if(Node._checkIndex(outputIndex, this.outputNumber))
			return toNode.connectInput(toIndex, this.outputSlots[outputIndex]);
		return false;
	}
	
	static _checkIndex(index, maxIndex){
		return index >= 0 && (maxIndex < 0 || index < maxIndex);
	}
	
	static _checkConnection(index, maxIndex, slot) {
		return Node._checkIndex(index, maxIndex) && slot !== undefined;
	}
}

module.exports = Dataflow;