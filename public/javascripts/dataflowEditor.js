class Dataflow {
	constructor(structure){
		this.struct = structure || {flowTree: [], transform: new DOMMatrix([1, 0, 0, 1, 0, 0])};
		
		for(let l = 0; l < this.struct.flowTree.length; l++){
			for(let n = 0; n < this.struct.flowTree[l].length; n++){
				let nodeSpec = this.struct.flowTree[l][n];
				let node = Dataflow.createNode(nodeSpec.path, nodeSpec.x, nodeSpec.y);
				if(node)
					this.struct.flowTree[l][n] = node;
				else throw "Invalid structure object";
			}
		}
		
		// TODO: Generate flow tree from structure object/string
	}
	
	connect(fromNode, fromIndex, toNode, toIndex){
		if(this._insideTree(fromNode) && this._insideTree(toNode)){
			let success = fromNode.connectOutput(fromIndex, toNode, toIndex);
			if(success) this._evaluateDeepness(toNode);
			return success;
		}
		return false;
	}
	
	getNodesByPath(path){
		let result = [];
		this._iterateNodes(node => {
			if(node.nodePath === path) result.push(node);
		});
		return result;
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
		return false;
	}
	
	_moveInTree(node, level){
		for(let i = 0; i < this.struct.flowTree[node.deepness].length; i++)
			if(this.struct.flowTree[node.deepness][i] === node){
				let n = this.struct.flowTree[node.deepness][i];
				this.struct.flowTree[node.deepness].splice(i, 1);
				this._ensureTreeLevel(level);
				n.deepness = level;
				this.struct.flowTree[level].push(n);
				return true;
			}
		return false;
	}
	
	_insideTree(node){
		return this._iterateNodes(n => n === node);
	}
	
	_iterateNodes(callback, reverse){
		if(reverse) {
			for (let i = this.struct.flowTree.length - 1; i >= 0; i--)
				if(this.struct.flowTree[i])
					for(let n = this.struct.flowTree[i].length-1; n >= 0; n--)
						if(callback(this.struct.flowTree[i][n]))
							return true;
		}else {
			for (const level of this.struct.flowTree)
				if(level)
					for(const n of level)
						if(callback(n))
							return true;
		}
		return false;
	}
	
	_ensureTreeLevel(level){
		if(!this.struct.flowTree[level]) this.struct.flowTree[level] = [];
	}
	
	get fileStructure(){
		let struct = {nodes: [], connections: []};
		this._iterateNodes(node => struct.nodes.push([node.nodePath, node.position, node.properties]));
		for(let n = 0; n < struct.nodes.length; n++){
			let fromNode = struct.nodes[n];
			for(let x = 0; x < fromNode.connections.length; x++)
				for(let c = 0; c < fromNode.connections[x].connections.length; c++){
					let con = fromNode.connections[x].connections[c];
					for(let t = 0; t < struct.nodes.length; t++)
						if(struct.nodes[t] === con.node)
							struct.connections.push([n, x, t, con.index]);
				}
		}
		return struct;
	}
	
	// TODO: Add support for undefined number of inputs
	static registerNode(title, category, inputLabels, outputLabels, workerFunction){
		let cat = cleanString(category);
		let t = cleanString(title);
		if(!Dataflow._registeredNodes.hasOwnProperty(cat))
			Dataflow._registeredNodes[cat] = {nodes: []};
		if(!Dataflow._registeredNodes[cat].nodes.hasOwnProperty(t))
			Dataflow._registeredNodes[cat].nodes[t] = {title: title, category: category, inputLabels: inputLabels, outputLabels: outputLabels};
	}
	
	static unregisterNode(path){
		let splitPath = path.split("/");
		if(splitPath.length !== 2) return false;
		let category = splitPath[0], nodeTitle = splitPath[1];
		if(!Dataflow._registeredNodes.hasOwnProperty(category) || !Dataflow._registeredNodes[category].nodes.hasOwnProperty(nodeTitle)) return false;
		delete Dataflow._registeredNodes[category].nodes[t];
		let nodeDom = document.getElementById("nodeItem-" + category + "-" + nodeTitle);
		nodeDom.parentNode.removeChild(nodeDom);
		if(Dataflow._registeredNodes[category].nodes.length <= 0) document.getElementById("editorMenu-addNode-content-" + category).setAttribute("style", "display: none");
		return true;
	}
	
	static createNode(path, x, y){
		let splitPath = path.split("/");
		if(splitPath.length !== 2) return undefined;
		let category = splitPath[0], nodeTitle = splitPath[1];
		if(!Dataflow._registeredNodes.hasOwnProperty(category) || !Dataflow._registeredNodes[category].nodes.hasOwnProperty(nodeTitle)) return undefined;
		let nodeSpec = Dataflow._registeredNodes[category].nodes[nodeTitle];
		let node = new Node(nodeSpec.title,x || 0,y || 0, nodeSpec.inputLabels, nodeSpec.outputLabels,undefined,undefined, path);
		node.size = {height: Math.max(fontHeight(DataflowEditor.titleFont, node.title) + 2 * DataflowEditor.titleVerticalSpacing, 15 + Math.max(node.numberOfInputs, node.numberOfOutputs) * (2 * DataflowEditor.slotCircleRadius + 2 * DataflowEditor.slotVerticalSpacing))};
		return node;
	}
}
Dataflow._registeredNodes = {};

class DataflowEditor{
	constructor(dataflow, canvasObj){
		this.canvas = canvasObj;
		this.dataflow = dataflow;
		this.bindedRender = this._render.bind(this);
		this.run = true;
		
		this.canvasCtx = this.canvas.getContext("2d");
		let transform = this.dataflow.struct.transform;
		this.canvasCtx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
		this.canvasCtx.transformedPoint = (x, y) => {
			let point = new DOMPointReadOnly(x, y);
			return point.matrixTransform(this.canvasCtx.getTransform().invertSelf());
		};
		/*
			Credits to: https://stackoverflow.com/a/3368118
		 */
		this.canvasCtx.fillRoundRect = (x, y, width, height, radius) => {
			if (typeof radius === "number") {
				radius = {topRight: radius, bottomRight: radius, bottomLeft: radius, topLeft: radius};
			} else {
				const defaultRadius = {topRight: 0, bottomRight: 0, bottomLeft: 0, topLeft: 0};
				if(!radius)
					radius = defaultRadius;
				else
					for(const edge in defaultRadius)
						radius[edge] = radius[edge] || defaultRadius[edge];
			}
			this.canvasCtx.beginPath();
			this.canvasCtx.moveTo(x+radius.topLeft, y);
			this.canvasCtx.lineTo(x+width-radius.topRight, y);
			this.canvasCtx.quadraticCurveTo(x+width, y,x+width,y+radius.topRight);
			this.canvasCtx.lineTo(x+width,y+height - radius.bottomRight);
			this.canvasCtx.quadraticCurveTo(x + width,y + height, x+width-radius.bottomRight,y+height);
			this.canvasCtx.lineTo(x+radius.bottomLeft,y+height);
			this.canvasCtx.quadraticCurveTo(x,y+height, x,y+height-radius.bottomLeft);
			this.canvasCtx.lineTo(x,y+radius.topLeft);
			this.canvasCtx.quadraticCurveTo(x, y,x+radius.topLeft, y);
			this.canvasCtx.closePath();
			this.canvasCtx.fill();
		};
		this.canvasCtx.fillCircle = (x, y, radius) => {
			this.canvasCtx.beginPath();
			this.canvasCtx.arc(x, y, radius,0,2 * Math.PI);
			this.canvasCtx.closePath();
			this.canvasCtx.fill();
		};
		
		let mouseX, mouseY;
		let dragAnchor, zoomAnchor, dragTarget;
		let getHitSlot = (node, number, startX, point) => {
			let H = number*2*DataflowEditor.slotCircleRadius + (number-1)*DataflowEditor.slotVerticalSpacing;
			let startY = node.position.y + node.size.height/2 - H/2;
			for(let y = 0; y < number; y++) {
				let pos = {x: startX+DataflowEditor.slotHorizontalSpacing, y: startY + y * 2 * DataflowEditor.slotCircleRadius + y * DataflowEditor.slotVerticalSpacing + DataflowEditor.slotCircleRadius};
				if(pointInsideArea(point,{x: pos.x, y: pos.y-DataflowEditor.slotCircleRadius},{width: 2 * DataflowEditor.slotCircleRadius, height: 2 * DataflowEditor.slotCircleRadius}))
					return {index: y, pos: pos};
			}
			return undefined;
		};
		let updateMousePos = (e) => {
			mouseX = e.offsetX || (e.pageX-this.canvas.offsetLeft);
			mouseY = e.offsetY || (e.pageY-this.canvas.offsetTop);
		};
		
		this.activeSlotLine = undefined;
		
		this.onMouseDown = (e) => {
			updateMousePos(e);
			dragAnchor = {x: mouseX, y: mouseY, matrix: this.canvasCtx.getTransform(), nodeAnchor: undefined, slotAnchor: undefined};
			
			dragTarget = undefined;
			
			let transformedPoint = this.canvasCtx.transformedPoint(mouseX, mouseY);
			this.dataflow._iterateNodes(node => {
				if(pointInsideArea(transformedPoint, node.position, node.size)){
					let hitSlot = false;
					if(!pointInsideArea(transformedPoint,{x: node.position.x+DataflowEditor.slotCircleArea, y: node.position.y},{width: node.innerWidth, height: node.size.height})){
						let slot = getHitSlot(node, node.inputNumber, node.position.x, transformedPoint);
						if(slot === undefined){
							slot = getHitSlot(node, node.outputNumber,node.position.x+node.width-DataflowEditor.slotCircleArea, transformedPoint);
							if(slot){
								dragTarget = {index: slot.index, node: node};
								let begin = {x: slot.pos.x+DataflowEditor.slotCircleRadius, y: slot.pos.y};
								this.activeSlotLine = {start: begin, end: begin};
								hitSlot = true;
							}
						} else{
							if(node.inputConnections[slot.index]) node.inputConnections[slot.index].disconnect(node, slot.index);
							hitSlot = true;
						}
					}
					if(!hitSlot) {
						dragTarget = node;
						dragAnchor.nodeAnchor = dragTarget.position;
					}
					return true;
				}
			});
		};
		this.onMouseMove = (e) => {
			updateMousePos(e);
			if(dragAnchor){
				let point = this.canvasCtx.transformedPoint(mouseX, mouseY);
				let anchor = this.canvasCtx.transformedPoint(dragAnchor.x, dragAnchor.y);
				if(dragTarget === undefined) {
					let matrix = this.canvasCtx.getTransform();
					this.canvasCtx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, dragAnchor.matrix.e + (point.x - anchor.x) * matrix.a, dragAnchor.matrix.f + (point.y - anchor.y) * matrix.d);
				} else if(dragTarget instanceof Node){
					dragTarget.position = {x: dragAnchor.nodeAnchor.x+(point.x-anchor.x), y: dragAnchor.nodeAnchor.y+(point.y-anchor.y)};
				} else if(typeof dragTarget.index === "number" && dragTarget.node instanceof Node){
					if(this.activeSlotLine)
						this.activeSlotLine.end = point;
				}
			}
		};
		this.onMouseUp = (e) => {
			updateMousePos(e);
			if(dragTarget && typeof dragTarget.index === "number" && dragTarget.node instanceof Node) {
				let transformedPoint = this.canvasCtx.transformedPoint(mouseX, mouseY);
				this.dataflow._iterateNodes(node => {
					if(pointInsideArea(transformedPoint, node.position, node.size)) {
						if(dragTarget.node !== node)
							if(!pointInsideArea(transformedPoint,{x: node.position.x + DataflowEditor.slotCircleArea, y: node.position.y},{width: node.innerWidth, height: node.size.height})) {
								let slot = getHitSlot(node, node.inputNumber, node.position.x, transformedPoint);
								if(slot !== undefined) this.dataflow.connect(dragTarget.node, dragTarget.index, node, slot.index);
							}
						return true;
					}
				});
			}
			dragAnchor = undefined;
			this.activeSlotLine = undefined;
		};
		this.onMouseWheel = (e) => {
			let scale = 1;
			if (e.deltaY < 0)
				scale *= e.deltaY * -0.25;
			else
				scale /= e.deltaY * 0.25;
			zoomAnchor = this.canvasCtx.getTransform();
			this.zoom(Math.min(Math.max(0.5, scale), 1.5), mouseX, mouseY);
			e.preventDefault();
		};
		
		this.canvas.addEventListener("mousedown", this.onMouseDown);
		this.canvas.addEventListener("mousemove", this.onMouseMove);
		this.canvas.addEventListener("mouseup", this.onMouseUp);
		this.canvas.addEventListener('wheel', this.onMouseWheel);
		
		// this.addNode("Test Node",0,0,350,["a", "b"],["res"]);
		// this.addNode("A node with a very large name",500,0,350,["a very large input name"],["out"]);
		//
		// this.addNode("Another Node",0,350,350,["1", "2", "3"],["out"]);
		// this.addNode("Another test Node",500,350,350,["one", "two", "three", "four"],["out"]);
		
		window.requestAnimationFrame(this.bindedRender);
	}
	
	addNode(path, x, y){
		let center = this.canvasCtx.transformedPoint(this.canvas.width/2, this.canvas.height/2);
		let node = Dataflow.createNode(path, x,y || center.y);
		if(!node) return false;
		if(x === undefined) node.position = {x: center.x-node.size.width/2};
		node.position = {y: node.position.y-node.size.height/2};
		// if(!node.innerWidth)
		// 	node.innerWidth = node.size.width-2*DataflowEditor.slotCircleArea-2*DataflowEditor.slotLabelArea-2*DataflowEditor.titleSlotLabelAreaSpacing;
		this.dataflow._ensureTreeLevel(node.deepness);
		this.dataflow.structure.flowTree[node.deepness].push(node);
		return true;
	}
	
	zoom(amount, x, y){
		let center = this.canvasCtx.transformedPoint(x || this.canvas.width/2,y || this.canvas.height/2);
		this.canvasCtx.translate(center.x, center.y);
		this.canvasCtx.scale(amount, amount);
		this._ensureScale();
		this.canvasCtx.translate(-center.x, -center.y);
	}
	
	close(){
		this.run = false;
		this.canvas.removeEventListener("mousedown", this.onMouseDown);
		this.canvas.removeEventListener("mousemove", this.onMouseMove);
		this.canvas.removeEventListener("mouseup", this.onMouseUp);
		this.canvas.removeEventListener('wheel', this.onMouseWheel);
	}
	
	_ensureScale(){
		let scale = this.canvasCtx.getTransform().a;
		if(scale < 0.1) this.canvasCtx.scale(0.1/scale, 0.1/scale);
		else if(scale > 2) this.canvasCtx.scale(2/scale, 2/scale);
	}
	
	_render(){
		let p1 = this.canvasCtx.transformedPoint(0,0);
		let p2 = this.canvasCtx.transformedPoint(this.canvas.width, this.canvas.height);
		this.canvasCtx.clearRect(p1.x, p1.y,p2.x-p1.x,p2.y-p1.y);
		
		this.canvasCtx.save();
		this.canvasCtx.setTransform(1,0,0,1,0,0);
		this.canvasCtx.clearRect(0,0, this.canvas.width, this.canvas.height);
		this.canvasCtx.fillStyle = "#303030";
		this.canvasCtx.fillRect(0,0, this.canvas.width, this.canvas.height);
		this.canvasCtx.restore();
		
		// Render
		// TODO: Invert rendering order
		this.dataflow._iterateNodes(node => {
			this.canvasCtx.save();
			this.canvasCtx.strokeStyle = "#fafafa"; // TODO: Find better color
			this.canvasCtx.lineCap = "round";
			this.canvasCtx.lineWidth = DataflowEditor.slotCircleRadius;
			for (const toIndex in node.inputConnections)
				if (node.inputConnections.hasOwnProperty(toIndex)) {
					let prevOut = node.inputConnections[toIndex];
					if (prevOut) {
						let fromNode = prevOut.owner;
						let fromPos = {
							x: fromNode.position.x + fromNode.size.width - DataflowEditor.slotCircleArea + DataflowEditor.slotHorizontalSpacing + DataflowEditor.slotCircleRadius,
							y: this._getSlotY(prevOut.index, fromNode.position.y, fromNode.size.height, fromNode.numberOfOutputs)
						};
						let toPos = {
							x: node.position.x + DataflowEditor.slotHorizontalSpacing + DataflowEditor.slotCircleRadius,
							y: this._getSlotY(toIndex, node.position.y, node.size.height, node.numberOfInputs)
						};
						this.canvasCtx.save();
						this.canvasCtx.beginPath();
						this.canvasCtx.moveTo(fromPos.x, fromPos.y);
						let halfX = (fromPos.x + toPos.x) / 2;
						this.canvasCtx.bezierCurveTo(halfX, fromPos.y, halfX, toPos.y, toPos.x, toPos.y);
						this.canvasCtx.stroke();
						this.canvasCtx.restore();
					}
				}
			this.canvasCtx.restore();
		});
		this.dataflow._iterateNodes(node => {
			this.canvasCtx.fillStyle = "#404040";
			this.canvasCtx.font = "24px Roboto";
			let metrics = this.canvasCtx.measureText(node.title);
			this.canvasCtx.fillRoundRect(node.position.x, node.position.y, node.size.width, node.size.height,15);
			this.canvasCtx.fillStyle = node.numberOfInputs > 0 ? "#636363" : "#e09119";
			this.canvasCtx.fillRoundRect(node.position.x, node.position.y, DataflowEditor.slotCircleArea, node.size.height,{bottomLeft: 15, topLeft: 15});
			this.canvasCtx.fillStyle = node.numberOfOutputs > 0 ? "#636363" : "#9a19e0";
			this.canvasCtx.fillRoundRect(node.position.x+node.size.width-DataflowEditor.slotCircleArea, node.position.y, DataflowEditor.slotCircleArea, node.size.height,{topRight: 15, bottomRight: 15});
			this.canvasCtx.fillStyle = "#fafafa";
			this.canvasCtx.textBaseline = "middle";
			this.canvasCtx.fillText(node.title,node.position.x+node.size.width/2-Math.min(node.innerWidth, metrics.width)/2,node.position.y+node.size.height/2, node.innerWidth);
			
			this._displaySlots(node.numberOfInputs, node.inputLabels, node.position.x, node.position.y, node.size.height);
			this._displaySlots(node.numberOfOutputs, node.outputLabels, node.position.x+node.size.width-DataflowEditor.slotCircleArea, node.position.y, node.size.height,true);
		
			if(this.activeSlotLine){
				this.canvasCtx.save();
				this.canvasCtx.lineWidth = 2*DataflowEditor.slotCircleRadius;
				this.canvasCtx.strokeStyle = "rgba(48, 48, 48, 0.3)"; // TODO: Find better color
				this.canvasCtx.beginPath();
				this.canvasCtx.lineCap = "round";
				this.canvasCtx.moveTo(this.activeSlotLine.start.x, this.activeSlotLine.start.y);
				this.canvasCtx.lineTo(this.activeSlotLine.end.x, this.activeSlotLine.end.y);
				this.canvasCtx.stroke();
				this.canvasCtx.lineWidth = DataflowEditor.slotCircleRadius;
				this.canvasCtx.strokeStyle = "#fafafa"; // TODO: Find better color
				this.canvasCtx.stroke();
				this.canvasCtx.restore();
			}
		},true);
		
		if(this.run) window.requestAnimationFrame(this.bindedRender);
		else{
			this.canvasCtx = undefined;
			this.canvas = undefined;
		}
	}
	
	_displaySlots(numberOfSlots, labels, baseX, baseY, height, left){
		let H = numberOfSlots*2*DataflowEditor.slotCircleRadius + (numberOfSlots-1)*DataflowEditor.slotVerticalSpacing;
		let startY = baseY + height/2 - H/2;
		
		this.canvasCtx.font = "18px Roboto";
		for(let y = 0; y < labels.length; y++){
			let lbl = labels[y];
			this.canvasCtx.fillStyle = "#7d7d7d";
			let yPos = startY+y*2*DataflowEditor.slotCircleRadius+y*DataflowEditor.slotVerticalSpacing+DataflowEditor.slotCircleRadius;
			this.canvasCtx.fillCircle(baseX+DataflowEditor.slotHorizontalSpacing+DataflowEditor.slotCircleRadius, yPos, DataflowEditor.slotCircleRadius);
			this.canvasCtx.fillStyle = "#fafafa";
			this.canvasCtx.textBaseline = "middle";
			this.canvasCtx.fillText(lbl,baseX+((left ? -this.canvasCtx.measureText(lbl).width-DataflowEditor.slotLabelSpacing : 2*DataflowEditor.slotHorizontalSpacing+2*DataflowEditor.slotCircleRadius+DataflowEditor.slotLabelSpacing)), yPos, DataflowEditor.slotLabelArea);
			this.canvasCtx.fillStyle = "#fafafa";
		}
	}
	
	// TODO: Move to Node class
	_getSlotY(index, baseY, height, numberOfSlots){
		return (baseY + height/2 - (numberOfSlots*2*DataflowEditor.slotCircleRadius + (numberOfSlots-1)*DataflowEditor.slotVerticalSpacing)/2)+index*2*DataflowEditor.slotCircleRadius+index*DataflowEditor.slotVerticalSpacing+DataflowEditor.slotCircleRadius;
	}
}
DataflowEditor.slotCircleRadius = 7.5;
DataflowEditor.slotHorizontalSpacing = 5;
DataflowEditor.slotVerticalSpacing = 10;
DataflowEditor.slotLabelSpacing = 5;
DataflowEditor.titleVerticalSpacing = 20;
DataflowEditor.slotLabelArea = 60;
DataflowEditor.slotCircleArea = 25;
DataflowEditor.titleSlotLabelAreaSpacing = 6;
DataflowEditor.titleFont = "24px Roboto";

class Node {
	constructor(title, x, y, inputs, outputs, inputNumber, workerFunction, path){
		this.t = title;
		this.x = x;
		this.y = y;
		this.innerWidth = fontWidth(DataflowEditor.titleFont, this.t);
		this.width = this.innerWidth + 2*DataflowEditor.slotLabelArea + 2*DataflowEditor.slotLabelSpacing + 2*DataflowEditor.titleSlotLabelAreaSpacing + 2*DataflowEditor.slotCircleArea;
		this.height = undefined;
		this.inLbl = inputs || [];
		this.outLbl = outputs || [];
		this.inputNumber = inputNumber || this.inLbl.length;
		this.outputNumber = this.outLbl.length;
		this.path = path;
		this.in = [];
		this.out = [];
		this.inputSlots = {};
		this.outputSlots = [];
		this.worker = workerFunction;
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
	
	get title(){
		return this.t;
	}
	
	get position(){
		return {x: this.x, y: this.y};
	}
	
	set position(pos){
		this.x = pos.x || this.x;
		this.y = pos.y || this.y;
	}
	
	get size(){
		return {width: this.width, height: this.height, innerWidth: this.innerWidth};
	}
	
	set size(sz){
		this.height = sz.height || this.height;
		this.innerWidth = sz.innerWidth || this.innerWidth;
	}
	
	get numberOfInputs(){
		return this.inputNumber;
	}
	
	get numberOfOutputs(){
		return this.outputNumber;
	}
	
	get inputLabels(){
		return this.inLbl;
	}
	
	get outputLabels(){
		return this.outLbl;
	}
	
	get outputs(){
		return this.out;
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