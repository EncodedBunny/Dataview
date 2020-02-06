class Dataflow {
	constructor(structure){
		this.struct = {nodes: [], transform: [1, 0, 0, 1, 0, 0]};
		this._registeredNodes = {};
		
		if(structure){
			let indexConversion = [];
			
			for(const index in structure.nodes){
				let metaNode = structure.nodes[index];
				let node = this.createNode(metaNode.path, metaNode.position.x, metaNode.position.y, metaNode.properties);
				if(!node) continue;
				this.struct.nodes.push(node);
				indexConversion[index] = this.struct.nodes.length-1;
			}
			
			for(const metaConnection of structure.connections){
				let originNodeLoc = indexConversion[metaConnection.fromNode],
					destNodeLoc = indexConversion[metaConnection.toNode];
				if(originNodeLoc === undefined || destNodeLoc === undefined) continue;
				let originNode = this.struct.nodes[originNodeLoc],
					destNode = this.struct.nodes[destNodeLoc];
				if(metaConnection.fromSlot >= originNode.numberOfOutputs || metaConnection.toSlot >= destNode.numberOfInputs) continue;
				this.connect(originNode, metaConnection.fromSlot, destNode, metaConnection.toSlot);
			}
			
			this.struct.transform = structure.transform;
			this._registeredNodes = structure.registeredNodes;
		}
	}
	
	connect(fromNode, fromIndex, toNode, toIndex){
		if(this.struct.nodes.includes(fromNode) && this.struct.nodes.includes(toNode))
			return fromNode.connectOutput(fromIndex, toNode, toIndex);
		return false;
	}
	
	getNodesByPath(path){
		let result = [];
		for(let node of this.struct.nodes)
			if(node.nodePath === path) result.push(node);
		return result;
	}
	
	createNode(path, x, y, props){
		let splitPath = path.split("/");
		if(splitPath.length !== 2) return undefined;
		let category = splitPath[0], nodeTitle = splitPath[1];
		if((!this._registeredNodes.hasOwnProperty(category)
			|| !this._registeredNodes[category].nodes.hasOwnProperty(nodeTitle))
			&& (!Dataflow._registeredNodes.hasOwnProperty(category)
				|| !Dataflow._registeredNodes[category].nodes.hasOwnProperty(nodeTitle))) return undefined;
		let nodeSpec = this._registeredNodes.hasOwnProperty(category) ? this._registeredNodes[category].nodes[nodeTitle]
			|| Dataflow._registeredNodes[category].nodes[nodeTitle] : Dataflow._registeredNodes[category].nodes[nodeTitle];
		let node = new Node(nodeSpec.title,x || 0,y || 0, nodeSpec.inputLabels, nodeSpec.outputLabels,undefined,undefined, path,props || nodeSpec.defaultProperties);
		node.size = {height: Math.max(fontHeight(DataflowEditor.titleFont, node.title) + 2 * DataflowEditor.titleVerticalSpacing, 15 + Math.max(node.numberOfInputs, node.numberOfOutputs) * (2 * DataflowEditor.slotCircleRadius + 2 * DataflowEditor.slotVerticalSpacing))};
		return node;
	}
	
	get registeredNodes(){
		return this._registeredNodes;
	}
	
	// TODO: Add support for undefined number of inputs
	static registerGlobalNode(title, category, inputLabels, outputLabels, props){
		let cat = cleanString(category);
		let t = cleanString(title);
		if(!Dataflow._registeredNodes.hasOwnProperty(cat))
			Dataflow._registeredNodes[cat] = {nodes: []};
		if(!Dataflow._registeredNodes[cat].nodes.hasOwnProperty(t))
			Dataflow._registeredNodes[cat].nodes[t] = {title: title, category: category, inputLabels: inputLabels, outputLabels: outputLabels, defaultProperties: props};
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
}
Dataflow._registeredNodes = {};

class DataflowEditor{
	constructor(dataflow, canvasObj, onSelect, onUnselect){
		this.canvas = canvasObj;
		this.dataflow = dataflow;
		this.bindedRender = this._render.bind(this);
		this.run = true;
		
		this.onUnselect = onUnselect;
		
		this.canvasCtx = this.canvas.getContext("2d");
		this.transform = new DOMMatrix(this.dataflow.struct.transform);
		this.canvasCtx.setTransform(this.transform.a, this.transform.b, this.transform.c, this.transform.d, this.transform.e, this.transform.f);
		this.canvasCtx.transformedPoint = (x, y) => {
			let point = new DOMPointReadOnly(x, y);
			return point.matrixTransform(this.canvasCtx.getTransform().invertSelf());
		};
		/*
			Credits to: https://stackoverflow.com/a/3368118
		 */
		this.canvasCtx.fillRoundRect = (x, y, width, height, radius, stroke) => {
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
			if(stroke === true)
				this.canvasCtx.stroke();
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
		this.selectedNode = undefined;
		
		this.onMouseDown = (e) => {
			updateMousePos(e);
			dragAnchor = {x: mouseX, y: mouseY, matrix: this.canvasCtx.getTransform(), nodeAnchor: undefined, slotAnchor: undefined};
			
			dragTarget = undefined;
			
			let transformedPoint = this.canvasCtx.transformedPoint(mouseX, mouseY);
			for(let node of this.dataflow.struct.nodes){
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
					break;
				}
			}
		};
		this.onMouseMove = (e) => {
			updateMousePos(e);
			if(dragAnchor){
				let point = this.canvasCtx.transformedPoint(mouseX, mouseY);
				let anchor = this.canvasCtx.transformedPoint(dragAnchor.x, dragAnchor.y);
				if(dragTarget === undefined) {
					let matrix = this.canvasCtx.getTransform();
					this.canvasCtx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d,dragAnchor.matrix.e + (point.x - anchor.x) * matrix.a,dragAnchor.matrix.f + (point.y - anchor.y) * matrix.d);
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
				for(let node of this.dataflow.struct.nodes){
					if(pointInsideArea(transformedPoint, node.position, node.size)) {
						if(dragTarget.node !== node)
							if(!pointInsideArea(transformedPoint,{x: node.position.x + DataflowEditor.slotCircleArea, y: node.position.y},{width: node.innerWidth, height: node.size.height})) {
								let slot = getHitSlot(node, node.inputNumber, node.position.x, transformedPoint);
								if(slot !== undefined) this.dataflow.connect(dragTarget.node, dragTarget.index, node, slot.index);
							}
						break;
					}
				}
			} else if(dragTarget && dragTarget instanceof Node){
				if(dragTarget.position.x === dragAnchor.nodeAnchor.x && dragTarget.position.y === dragAnchor.nodeAnchor.y) {
					if(this.selectedNode === dragTarget) {
						this.deselectNode();
					}else {
						this.selectedNode = dragTarget;
						if(typeof onSelect === "function")
							onSelect(dragTarget);
					}
				}
			} else{
				if(this.selectedNode !== undefined)
					this.deselectNode();
			}
			dragAnchor = undefined;
			this.activeSlotLine = undefined;
		};
		this.onMouseWheel = (e) => {
			let scale = 1;
			if(e.deltaY < 0)
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
		let center = this.canvasCtx.transformedPoint(this.canvas.width/2,this.canvas.height/2);
		let node = this.dataflow.createNode(path, x,y || center.y);
		if(!node) return false;
		if(x === undefined) node.position = {x: center.x-node.size.width/2};
		node.position = {y: node.position.y-node.size.height/2};
		// if(!node.innerWidth)
		// 	node.innerWidth = node.size.width-2*DataflowEditor.slotCircleArea-2*DataflowEditor.slotLabelArea-2*DataflowEditor.titleSlotLabelAreaSpacing;
		this.dataflow.struct.nodes.push(node);
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
	
	deselectNode(){
		if(typeof this.onUnselect === "function")
			this.onUnselect(this.selectedNode);
		this.selectedNode = undefined;
	}
	
	get fileStructure(){
		let curTransform = this.canvasCtx.getTransform();
		let struct = {nodes: [], connections: [], transform: [curTransform.a, curTransform.b, curTransform.c, curTransform.d, curTransform.e, curTransform.f]};
		for(let node of this.dataflow.struct.nodes)
			struct.nodes.push([node.nodePath, [node.position.x, node.position.y], node._properties]);
		let n = 0;
		for(let node of this.dataflow.struct.nodes) {
			for (let x = 0; x < node.connections.length; x++)
				for (let c = 0; c < node.connections[x].connections.length; c++) {
					let con = node.connections[x].connections[c];
					let t = 0;
					for (let toNode of this.dataflow.struct.nodes) {
						if (toNode === con.node) {
							struct.connections.push([n, x, t, con.index]);
							break;
						}
						t++;
					}
				}
			n++;
		}
		return struct;
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
		for(let node of this.dataflow.struct.nodes){
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
		}
		for(let i = this.dataflow.struct.nodes.length-1; i >= 0; i--){
			let node = this.dataflow.struct.nodes[i];
			this.canvasCtx.fillStyle = "#404040";
			this.canvasCtx.font = "24px Roboto";
			this.canvasCtx.lineWidth = DataflowEditor.highlightSize;
			this.canvasCtx.strokeStyle = "#fafafa";
			let metrics = this.canvasCtx.measureText(node._properties.name || node.title);
			this.canvasCtx.fillRoundRect(node.position.x, node.position.y, node.size.width, node.size.height,15,this.selectedNode === node);
			this.canvasCtx.fillStyle = node.numberOfInputs > 0 ? "#636363" : "#e09119";
			this.canvasCtx.fillRoundRect(node.position.x, node.position.y, DataflowEditor.slotCircleArea, node.size.height,{bottomLeft: 15, topLeft: 15});
			this.canvasCtx.fillStyle = node.numberOfOutputs > 0 ? "#636363" : "#9a19e0";
			this.canvasCtx.fillRoundRect(node.position.x+node.size.width-DataflowEditor.slotCircleArea, node.position.y, DataflowEditor.slotCircleArea, node.size.height,{topRight: 15, bottomRight: 15});
			this.canvasCtx.fillStyle = "#fafafa";
			this.canvasCtx.textBaseline = "middle";
			this.canvasCtx.fillText(node._properties.name || node.title,node.position.x+node.size.width/2-Math.min(node.innerWidth, metrics.width)/2,node.position.y+node.size.height/2, node.innerWidth);
			
			this._displaySlots(node.numberOfInputs, node.inputLabels, node.position.x, node.position.y, node.size.height);
			this._displaySlots(node.numberOfOutputs, node.outputLabels, node.position.x+node.size.width-DataflowEditor.slotCircleArea, node.position.y, node.size.height,true);
		}
		
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
DataflowEditor.highlightSize = 5;

class Node {
	constructor(title, x, y, inputs, outputs, inputNumber, workerFunction, path, properties){
		this.t = title;
		this.x = x;
		this.y = y;
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
		this._properties = properties !== undefined ? Object.assign({}, properties) : {};
		this._updateWidth();
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
	
	setProperty(prop, value){
		if(this._properties.hasOwnProperty(prop)){
			let prev = this._properties[prop];
			this._properties[prop] = value;
			if(prop === "name" && value !== prev)
				this._updateWidth();
		}
	}
	
	_updateWidth(){
		this.innerWidth = fontWidth(DataflowEditor.titleFont, this._properties.name || this.t);
		this.width = this.innerWidth + 2*DataflowEditor.slotLabelArea + 2*DataflowEditor.slotLabelSpacing + 2*DataflowEditor.titleSlotLabelAreaSpacing + 2*DataflowEditor.slotCircleArea;
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
		return Node._checkIndex(index, maxIndex) && slot !== undefined;
	}
}
