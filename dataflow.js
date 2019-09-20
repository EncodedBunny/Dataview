const DF_FILE_NODE_PATH = 0;
const DF_FILE_NODE_POSITION = 1;
const DF_FILE_NODE_PROPERTIES = 2;

const DF_FILE_POSITION_X = 0;
const DF_FILE_POSITION_Y = 1;

const DF_FILE_CON_FROM_NODE = 0;
const DF_FILE_CON_FROM_SLOT = 1;
const DF_FILE_CON_TO_NODE = 2;
const DF_FILE_CON_TO_SLOT = 3;

class Dataflow {
	/**
	 * Creates a new dataflow from a dataflow structure of a file
	 * @param fileStructure The dataflow structure, this structure comes from a JSON file that possess the following
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
	constructor(fileStructure){
		this.flowTree = [];
		this.structure = {nodes: [], connections: [], transform: [1, 0, 0, 1, 0, 0]};
		
		if(fileStructure)
			this.loadFileStructure(fileStructure);
	}
	
	connect(fromNode, fromIndex, toNode, toIndex){
		if(this._insideTree(fromNode) && this._insideTree(toNode)){
			let success = fromNode.connectOutput(fromIndex, toNode, toIndex);
			if(success) this._evaluateDeepness(toNode);
			return success;
		}
		return false;
	}
	
	activate(){
		for(const node of this.flowTree[0])
			node.activate();
	}
	
	loadFileStructure(fileStructure){
		let indexConversion = [];
		
		for(const index in fileStructure.nodes){
			let metaNode = fileStructure.nodes[index];
			if(!Dataflow._checkFileArray(metaNode,DF_FILE_NODE_PROPERTIES+1)) continue;
			let position = metaNode[DF_FILE_NODE_POSITION], props = metaNode[DF_FILE_NODE_PROPERTIES];
			if(!Dataflow._checkFileArray(position,DF_FILE_POSITION_Y+1)) continue;
			let node = Dataflow.createNode(metaNode[DF_FILE_NODE_PATH], position[DF_FILE_POSITION_X],
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
				if(!originNodeLoc || !destNodeLoc || !this.flowTree[originNodeLoc.level] || !this.flowTree[destNodeLoc.level]) continue;
				let originNode = this.flowTree[originNodeLoc.level][originNodeLoc.index],
					originSlot = metaConnection[DF_FILE_CON_FROM_SLOT],
					destNode = this.flowTree[destNodeLoc.level][destNodeLoc.index],
					destSlot = metaConnection[DF_FILE_CON_TO_SLOT];
				if(originSlot >= originNode.outputNumber || destSlot >= destNode.inputNumber) continue;
				this.connect(originNode, originSlot, destNode, destSlot);
			}
		
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
	
	addNode(node){
		this._ensureTreeLevel(node.numberOfInputs);
		this.flowTree[node.numberOfInputs].push(node);
		return this._evaluateDeepness(node);
	}
	
	/**
	 * Generates a JSON object compliant with the dataflow file format defined in the beginning of this file that contains
	 * the current structure of this Dataflow object
	 * @returns {*} The structure of this object as a JSON object
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
	
	_evaluateDeepness(node){
		if(this._insideTree(node)){
			let level = 0;
			for(const connection of Object.values(node.inputConnections))
				if(connection.owner.deepness+1 > level)
					level = connection.owner.deepness+1;
			if(node.deepness !== level)
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
	// TODO: Add default properties
	static registerNode(title, category, inputLabels, outputLabels, workerFunction){
		let cat = Dataflow._cleanString(category);
		let t = Dataflow._cleanString(title);
		if(!Dataflow._registeredNodes.hasOwnProperty(cat)) Dataflow._registeredNodes[cat] = {name: category, nodes: {}};
		if(!Dataflow._registeredNodes[cat].nodes.hasOwnProperty(t)){
			Dataflow._registeredNodes[cat].nodes[t] = {title: title, category: category, inputLabels: inputLabels, outputLabels: outputLabels, workerFunction: workerFunction};
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
	
	static createNode(path, x, y, properties){
		let splitPath = path.split("/");
		if(splitPath.length !== 2) return undefined;
		let category = splitPath[0], nodeTitle = splitPath[1];
		if(!Dataflow._registeredNodes.hasOwnProperty(category) || !Dataflow._registeredNodes[category].nodes.hasOwnProperty(nodeTitle)) return undefined;
		let nodeSpec = Dataflow._registeredNodes[category].nodes[nodeTitle];
		return new Node(nodeSpec.inputLabels.length, nodeSpec.outputLabels.length, x, y, nodeSpec.workerFunction, path, properties);
	}
	
	static createNodeFromSpec(nodeSpec, x, y, properties){
		return new Node(nodeSpec.inputLabels.length, nodeSpec.outputLabels.length, x, y, nodeSpec.workerFunction, properties);
	}
	
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
Dataflow.registerNode("Constant Value","Inputs",[],["value"],() => {
	return [3];
});
Dataflow.registerNode("Graph","Output",["y"],[],() => {
	return [];
});
Dataflow.registerNode("Sum","Math",["x", "y"],["result"],(input) => {
	return [input[0]+input[1]];
});
Dataflow.registerNode("Another Node","Math",["1", "2", "3"],["out"],(input) => {
	return [input[0]+input[1]+input[2]];
});

class Node {
	constructor(inputNumber, outputNumber, x, y, workerFunction, path, properties){
		this.inputNumber = inputNumber;
		this.outputNumber = outputNumber;
		this.x = x;
		this.y = y;
		this.path = path;
		this.in = [];
		this.out = [];
		this.inputSlots = {};
		this.outputSlots = [];
		this.worker = workerFunction;
		this.properties = properties || {};
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
	
	activate(){
		let ready = true;
		for(let i = 0; i < this.in.length; i++)
			if(this.in[i] === undefined) {
				ready = false;
				break;
			}
		if(ready){
			let out = this.worker(this.in);
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
		return [this.x, this.y];
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
		return Node._checkIndex(index, maxIndex) && slot;
	}
}

module.exports = Dataflow;