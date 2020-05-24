let screenDiv = document.getElementById("screenDiv");
let windowContainer = document.getElementById("windowContainer");
let screenDivVisible = false;
let menu = {"root": {children: [], anchor: document.getElementById("sideMenu")}};
let currentEditor;

const colSizesSpec = {
	"small": {pix: 150, per: 10},
	"medium": {pix: 200, per: 15},
	"uuid": {pix: 360, per: 25}
};

let colSizes = {};

addMenuItem("Overview", "/");
addMenuItem("Devices", "/devices");
addMenuItem("Experiments", "/experiments");
addMenuItem("Settings", "/settings");
addMenuItem("Drivers", "/drivers");

window.onresize = () => {_processTableColumnSizes()};

let _domReady = false; // Fix menu being generated before DOM
window.onload = () => {_domReady = true};
socket.emit("getDevicesAndExperiments", (data) => {
	for(const deviceData of data.devices)
		addMenuItem(deviceData.device.name, deviceData.id, "/devices", deviceData.device.type);
	for(const experiment of data.experiments)
		addMenuItem(experiment.name, experiment.id, "/experiments");
	if(_domReady)
		generateMenu(window.location.pathname);
	else
		window.onload = () => {generateMenu(window.location.pathname);};
});

screenDiv.addEventListener("transitionend", () => {
	if (!screenDivVisible)
		screenDiv.setAttribute("style", "opacity: 0; z-index: -2");
});

function displayWindow(title, width, content, options){
	options = options || {};
	let window = document.createElement("div");
	window.setAttribute("style", "width: " + width + "px; height: auto");
	window.classList.add("window");

	let titleBar = document.createElement("div");
	titleBar.classList.add("windowTitleBar");
	let titleSpan = document.createElement("span");
	titleSpan.classList.add("windowTitleSpan");
	titleSpan.appendChild(document.createTextNode(title));
	titleBar.appendChild(titleSpan);

	let closeButton = document.createElement("button");
	if(options.noClose !== true) {
		closeButton.classList.add("closeButton", "waves-effect", "waves-light", "waves-button");
		closeButton.addEventListener("click", () => {
			closeWindow(window);
			if (options.onClose && typeof options.onClose === "function") options.onClose();
		});
		closeButton.appendChild(document.createTextNode("X"));
		titleBar.appendChild(closeButton);
	}

	window.appendChild(titleBar);
	let windowContentHolder = document.createElement("div");
	windowContentHolder.classList.add("windowContentHolder");
	if(options.marginBottom === false) windowContentHolder.style.marginBottom = "0";
	if(options.maxHeight !== undefined) windowContentHolder.style.maxHeight = (screenDiv.offsetHeight*options.maxHeight/100)+"px";
	content.classList.add("windowContent");
	windowContentHolder.appendChild(content);
	window.appendChild(windowContentHolder);

	toggleScreenDiv(true);
	windowContainer.appendChild(window);
	
	return window;
}

function displayEditor(dataflow, onClose){
	if(!currentEditor) {
		document.getElementById("editorContainer").setAttribute("style","display: block");
		
		let canvas = document.getElementById("editorCanvas");
		canvas.width = Math.floor(screenDiv.offsetWidth * 0.9);
		canvas.height = Math.floor(screenDiv.offsetHeight * 0.9);
		
		let topMenu = document.getElementById("editorMenu");
		topMenu.setAttribute("style", "width: " + canvas.width + "px");
		
		let propMenu = document.getElementById("propMenu");
		propMenu.setAttribute("style","max-width: " + canvas.width*0.2 + "px; height: " + canvas.height + "px");
		
		let propMenuBody = document.getElementById("propMenuBody");
		
		let close = document.getElementById("editorMenu-close");
		close.onclick = () => {
			if(typeof onClose === "function") onClose();
			else closeEditor();
		};
		
		toggleScreenDiv(true);
		currentEditor = new DataflowEditor(dataflow, canvas,(node) => {
			propMenu.classList.add("visible");
			while(propMenuBody.lastChild)
				propMenuBody.removeChild(propMenuBody.lastChild);
			for(const prop of Object.keys(node._properties)){
				let elementPanel = document.createElement("div");
				elementPanel.classList.add("hbox", "formLine");
				let label = document.createElement("span");
				label.appendChild(document.createTextNode(prop.split("-").join(" ") + ":"));
				label.setAttribute("style","text-transform: capitalize; margin-right: 5px");
				elementPanel.appendChild(label);
				let obj;
				if(typeof node._properties[prop] === "object" && !Array.isArray(node._properties[prop]) && node._properties[prop].hasOwnProperty("possibleValues")) {
					obj = document.createElement("select");
					for(const value of node._properties[prop].possibleValues) {
						let item = document.createElement("option");
						item.appendChild(document.createTextNode(value));
						item.setAttribute("value", value);
						obj.appendChild(item);
					}
				} else
					switch (typeof node._properties[prop]) {
						case "string":
							obj = document.createElement("input");
							obj.type = "text";
							break;
						case "number":
							obj = document.createElement("input");
							obj.type = "number";
							break;
					}
				obj.setAttribute("id", prop);
				obj.setAttribute("name", prop);
				obj.classList.add("formItem");
				obj.value = typeof node._properties[prop] === "object" && node._properties[prop].hasOwnProperty("value") ? node._properties[prop].value : node._properties[prop];
				document.getElementById("editorPropMenuClose").onclick = () => {
					currentEditor.deselectNode();
				};
				elementPanel.appendChild(obj);
				propMenuBody.appendChild(elementPanel);
			}
		},(node) => {
			propMenu.classList.remove("visible");
			for(const child of propMenuBody.getElementsByClassName("formItem")) {
				let obj = child;
				if(child.tagName.toLowerCase() === "select")
					obj = child.options[child.selectedIndex >= 0 ? child.selectedIndex : 0];
				if(obj.value !== undefined && (typeof obj.value === "string" ? obj.value.length > 0 : true))
					node.setProperty(child.id, obj.value);
			}
		});
	} else
		toggleScreenDiv(true);

	return currentEditor;
}

function closeEditor(){
	if(currentEditor) {
		let topMenu = document.getElementById("editorMenu");
		topMenu.setAttribute("style", "");

		document.getElementById("editorContainer").setAttribute("style","display: none");
		
		currentEditor.close();
		currentEditor = undefined;

		toggleScreenDiv(false);
	}
}

function closeWindow(obj){
	if(obj.parentNode !== null && obj.parentNode === windowContainer){
		windowContainer.removeChild(obj);
		toggleScreenDiv(false);
	}
}

function toggleScreenDiv(enable){
	screenDivVisible = enable;
	screenDiv.setAttribute("style", "opacity: " + (enable ? "100%" : 0) + "; ");
}

/**
*	TODO: Temp solution, verify if DataflowEditor container is available
*/
function loadDataflowMenuNodes(registeredNodes){
	for(const cat of Object.keys(registeredNodes)) {
		for(const t of Object.keys(registeredNodes[cat].nodes)) {
			let node = registeredNodes[cat].nodes[t];
			if (!document.getElementById("editorMenu-addNode-content-" + cat)) {
				let li = document.createElement("li");
				li.id = "editorMenu-addNode-content-" + cat;
				let catLink = document.createElement("a");
				catLink.appendChild(document.createTextNode(node.category));
				li.appendChild(catLink);
				let ul = document.createElement("ul");
				ul.id = li.id + "-content";
				li.appendChild(ul);
				document.getElementById("editorMenu-addNode-content").appendChild(li);
			}
			let li = document.createElement("li");
			li.id = "nodeItem-" + cat + "-" + t;
			let nodeLink = document.createElement("a");
			let openPar = node.title.indexOf("("), closePar = node.title.indexOf(")");
			if(openPar >= 0 && closePar > 1 && openPar < closePar + 1 && !(closePar + 1 < node.title.length && openPar === 0)) {
				let extraInfoSpan = document.createElement("span");
				extraInfoSpan.classList.add("subtitle", "inline");
				nodeLink.appendChild(document.createTextNode(node.title.substring(0, openPar)));
				extraInfoSpan.appendChild(document.createTextNode(" " + node.title.substring(openPar, closePar + 1)));
				nodeLink.appendChild(extraInfoSpan);
			} else
				nodeLink.appendChild(document.createTextNode(node.title));
			nodeLink.onclick = () => {
				if(currentEditor) currentEditor.addNode(cat + "/" + t);
			};
			li.appendChild(nodeLink);
			document.getElementById("editorMenu-addNode-content-" + cat + "-content").appendChild(li)
			Dataflow.registerGlobalNode(node.title, node.category, node.inputLabels, node.outputLabels, node.defaultProperties);
		}
	}
}

function processCustomAttributes(){
	_processTableColumnSizes();
}

function _processTableColumnSizes(){
	Object.entries(colSizesSpec).forEach(([sz, spec]) => {
		let perSz = spec.per/100*window.innerWidth;
		colSizes[sz] = perSz < spec.pix ? perSz : spec.pix;
	});
	
	for(let th of document.getElementsByTagName("th")) _setColumnSize(th);
	for(let td of document.getElementsByTagName("td")) _setColumnSize(td);
}

function _setColumnSize(element){
	let width = colSizes[element.getAttribute("col-size")];
	if(width !== undefined) element.style.width = width + "px";
}

function createForm(template, submitText, onSubmit){
	let root = document.createElement("form");
	root.autocomplete = "off";
	root.classList.add("form");
	for(const name of Object.keys(template)){
		let data = template[name];
		let elementPanel = document.createElement("div");
		elementPanel.classList.add("hbox", "formLine");
		if(data.isTitled) {
			let span = document.createElement("span");
			span.appendChild(document.createTextNode((data.title || name) + ":"));
			span.setAttribute("style",(data.title === undefined ? "text-transform: capitalize;" : "") + "margin-right: 5px");
			elementPanel.appendChild(span);
		}
		let obj, inputable = true;
		switch (data.type.toLowerCase()) {
			case "textbox":
				obj = document.createElement("input");
				obj.type = "text";
				break;
			case "list":
				let its = Object.values(data.items);
				console.log(its, data, its.length <= 0, data.hasOwnProperty("emptyMessage"));
				if(its.length <= 0 && data.hasOwnProperty("emptyMessage")){
					obj = document.createElement("span");
					obj.appendChild(document.createTextNode(data.emptyMessage));
					inputable = false;
				} else{
					obj = document.createElement("select");
					for(const value of its) {
						let item = document.createElement("option");
						item.appendChild(document.createTextNode(value));
						if(data.hasOwnProperty("value") && data.value === value)
							item.setAttribute("selected","");
						obj.appendChild(item);
					}
				}
				break;
		}
		obj.setAttribute("id", name);
		obj.setAttribute("name", name);
		if(data.listeners && data.listeners.length > 0)
			for(let listener of data.listeners)
				obj.addEventListener(listener.event, listener.callback);
		obj.classList.add("formItem");
		elementPanel.appendChild(obj);
		if(data.hasOwnProperty("value"))
			if(obj.tagName.toLowerCase() !== "select")
				obj.setAttribute("value", data.value);
		obj.setAttribute("required","");
		root.appendChild(elementPanel);
	}
	let submit = document.createElement("button");
	submit.appendChild(document.createTextNode(submitText || "submit"));
	root.onsubmit = function() {
		let values = {};
		for(const n of Object.keys(root.elements))
			values[root.elements[n].name] = root.elements[n].value;
		onSubmit(values);
		return false;
	};
	submit.classList.add("lowerRight");
	Waves.attach(submit, ['waves-light', 'waves-button', 'waves-float']);
	root.appendChild(submit);
	return root;
}

function createStatusWindow(executingMsg){
	let root = document.createElement("div");
	let left = document.createElement("div");
	left.setAttribute("style","width: 20%; left: 0");
	left.classList.add("statusWindowSide");
	let progCircle = document.createElement("img");
	progCircle.setAttribute("src", "images/progress.svg");
	progCircle.setAttribute("draggable", "false");
	progCircle.classList.add("centerElement", "progressCircle");
	left.appendChild(progCircle);
	let right = document.createElement("div");
	right.setAttribute("style","width: 80%; right: 0");
	right.classList.add("statusWindowSide");
	let text = document.createElement("span");
	text.innerText = executingMsg;
	right.appendChild(text);
	root.appendChild(left);
	root.appendChild(right);
	let update = (msg, svg, onClose) => {
		text.innerText = msg;
		
		let close = document.createElement("button");
		close.appendChild(document.createTextNode("Close"));
		close.classList.add("lowerRight");
		Waves.attach(close, ['waves-light', 'waves-button', 'waves-float']);
		close.onclick = onClose;
		root.appendChild(close);
		
		while(left.lastChild)
			left.removeChild(left.lastChild);
		
		root.setAttribute("style","margin-bottom: 50px");
		
		let circle = document.createElement("img");
		circle.setAttribute("src", "images/" + svg + ".svg");
		circle.setAttribute("draggable", "false");
		circle.classList.add("centerElement");
		left.appendChild(circle);
	};
	return {
		finish: (msg, onClose) => {
			update(msg,"success", onClose);
		},
		error: (msg, onClose) => {
			update(msg,"error", onClose);
		},
		content: root
	};
}

function createButton(text, extra){
	let button = document.createElement("button");
	button.appendChild(document.createTextNode(text));
	let classes = ['waves-light', 'waves-button', 'waves-float'];
	if(extra)
		classes.unshift(extra);
	Waves.attach(button, classes);
	return button;
}

function generateMenu(selected){
	let root = document.getElementById("sideMenu");
	let addItem = (item, level) => {
		let l = level || 0;
		if(item.name) {
			let menuItem = document.createElement("li");
			menuItem.classList.add("menuItem");
			let linkHolder = document.createElement("div");
			linkHolder.classList.add("menuItemHeader");
			let link = document.createElement("a");
			link.appendChild(document.createTextNode(item.name));
			if(item.details){
				let details = document.createElement("span");
				details.classList.add("subtitle", "inline");
				details.appendChild(document.createTextNode(" (" + item.details + ")"));
				link.appendChild(details);
			}
			linkHolder.appendChild(link);
			menuItem.appendChild(linkHolder);
			if(item.children.length > 0) {
				let ecArrow = document.createElement("div");
				ecArrow.classList.add("menuArrow");
				linkHolder.insertBefore(ecArrow, link);
				let inner = document.createElement("ul");
				inner.classList.add("inner");
				menuItem.appendChild(inner);
				ecArrow.addEventListener("click", () => {
					ecArrow.classList.toggle("active");
					inner.classList.toggle("active");
				});
				item.anchor = inner;
			} else
				linkHolder.classList.add("noChildren");
			if(selected === item.link) {
				menuItem.classList.add("activeMenuItem");
				let current = item;
				while(current.parent.anchor && current.parent.anchor.id !== "sideMenu"){
					current.parent.anchor.classList.toggle("active");
					current.parent.anchor.parentElement.getElementsByClassName("menuItemHeader")[0].getElementsByClassName("menuArrow")[0].classList.toggle("active");
					current = current.parent;
				}
			} else
				link.href = item.link;
			if(item.parent.anchor)
				item.parent.anchor.appendChild(menuItem);
			else
				root.appendChild(menuItem); // Fallback
		}

		for(let child of item.children)
			addItem(child, l + 1);
	};
	addItem(menu.root);
}

function getMenuItem(link, parent){
	let root = parent || menu.root;
	for(let obj of root.children){
		if(obj.link === link)
			return obj;
		if(obj.children.length > 0){
			let pos = getMenuItem(link, obj);
			if(pos)
				return pos;
		}
	}
	return undefined;
}

function addMenuItem(name, link, parent, details){
	let parentObj = (parent !== undefined ? getMenuItem(parent) : undefined);
	let obj = {name: name, details: details, link: (parentObj ? parent + "/" : "") + link, children: [], parent: parentObj || menu.root};
	if(!parentObj)
		menu.root.children.push(obj);
	else
		parentObj.children.push(obj);
}

function createContainer(width, height, extraClasses){
	let parent = document.createElement("div");
	parent.classList.add("container");
	if(extraClasses)
		for(const cl of extraClasses)
			parent.classList.add(cl);

	parent.header = document.createElement("header");
	parent.appendChild(parent.header);

	parent.setAttribute("style", "width: " + width + "px; height: " + height + "px");
	parent.mainView = document.createElement("div");
	parent.mainView.classList.add("mainView");
	parent.appendChild(parent.mainView);

	parent.footer = document.createElement("footer");
	parent.footer.classList.add("footer");
	parent.appendChild(parent.footer);
	return parent;
}

function createPlaceholderContainer(width, height, buttonId){
	let container = createContainer(width, height, ["placeholder"]);
	let plContainer = document.createElement("div");
	plContainer.classList.add("plusCircleButton");
	plContainer.id = buttonId;
	let plText = document.createElement("span");
	plText.classList.add("plusCircleText");
	plText.appendChild(document.createTextNode("+"));
	plContainer.appendChild(plText);
	container.appendChild(plContainer);
	return container;
}

/*
	Credit to: http://jsfiddle.net/joquery/cQXgd/
 */
function fontHeight(font, text) {
	let canvas = document.getElementById("fontMetricCanvas");
	let context = canvas.getContext("2d");

	let width = canvas.width;
	let height = canvas.height;

	context.save();
	context.resetTransform();
	context.font = font;
	context.textAlign = "left";
	context.textBaseline = "top";
	context.fillText(text,25,5, width);

	let data = context.getImageData(0,0, width, height).data;

	let findFirst = (reverse) => {
		for(let y = reverse ? height : 0; (reverse ? y > 0 : y < height); (reverse ? y-- : y++))
			for(let x = 0; x < width; x++)
				if(data[((width * y) + x) * 4 + 3] > 0)
					return y;
	};

	let h = findFirst(true)-findFirst(false);

	context.clearRect(0,0, width, height);
	context.restore();

	return h;
}

function fontWidth(font, text){
	let canvas = document.getElementById("fontMetricCanvas");
	let context = canvas.getContext("2d");

	context.save();
	context.resetTransform();
	context.font = font;
	let width = context.measureText(text).width;
	context.restore();

	return width;
}

function pointInsideArea(point, areaPosition, areaSize){
	return point.x >= areaPosition.x && point.x <= areaPosition.x+areaSize.width && point.y >= areaPosition.y && point.y <= areaPosition.y+areaSize.height;
}
