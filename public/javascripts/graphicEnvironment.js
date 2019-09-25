let screenDiv = document.getElementById("screenDiv");
let windowContainer = document.getElementById("windowContainer");
let screenDivVisible = false;
let menu = {"root": {children: [], anchor: document.getElementById("sideMenu")}};
let currentEditor;

addMenuItem("Overview", "/");
addMenuItem("Devices", "/devices");
addMenuItem("Experiments", "/experiments");
addMenuItem("Settings", "/settings");
socket.emit("getDevices");
let _domReady = false; // Fix menu being generated before DOM
window.onload = () => {_domReady = true};
socket.on("getDevices", (data) => {
	for(const device of data)
		addMenuItem(device.name, device.link, "/devices", device.formattedDevice);
	if(_domReady)
		generateMenu(window.location.pathname);
	else
		window.onload = () => {generateMenu(window.location.pathname);};
});

screenDiv.addEventListener("transitionend", () => {
	if (!screenDivVisible)
		screenDiv.setAttribute("style", "opacity: 0; z-index: -2");
});

function displayWindow(title, width, content){
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
	closeButton.classList.add("closeButton", "waves-effect", "waves-light", "waves-button");
	closeButton.addEventListener("click", () => {
		closeWindow(window);
	});
	closeButton.appendChild(document.createTextNode("X"));
	titleBar.appendChild(closeButton);

	window.appendChild(titleBar);
	let windowContentHolder = document.createElement("div");
	windowContentHolder.classList.add("windowContentHolder");
	content.classList.add("windowContent");
	windowContentHolder.appendChild(content);
	window.appendChild(windowContentHolder);

	toggleScreenDiv(true);
	windowContainer.appendChild(window);

	return window;
}

function displayEditor(){
	if(!currentEditor) {
		document.getElementById("editorContainer").setAttribute("style","display: block");

		let canvas = document.getElementById("editorCanvas");
		canvas.width = Math.ceil(screenDiv.offsetWidth * 0.9);
		canvas.height = Math.ceil(screenDiv.offsetHeight * 0.9);

		let topMenu = document.getElementById("editorMenu");
		topMenu.setAttribute("style", "width: " + canvas.width + "px");

		let close = document.getElementById("editorMenu-close");
		close.onclick = () => {
			closeEditor();
		};

		toggleScreenDiv(true);
		currentEditor = new DataflowEditor(dataflow, canvas);
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
	screenDiv.setAttribute("style", "opacity: " + (enable ? "100%" : 0) + "; " + (enable ? "z-index: 2" : ""));
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
			span.setAttribute("style", "text-transform: capitalize; margin-right: 5px");
			elementPanel.appendChild(span);
		}
		let obj;
		switch (data.type.toLowerCase()) {
			case "textbox":
				obj = document.createElement("input");
				obj.type = "text";
				break;
			case "list":
				obj = document.createElement("select");
				for(const value of Object.values(data.items)) {
					let item = document.createElement("option");
					item.appendChild(document.createTextNode(value));
					obj.appendChild(item);
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
