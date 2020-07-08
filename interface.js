const url = require("url");
const users = require("./users");
const { app, BrowserWindow, ipcMain } = require("electron");

function createWindow () {
	const win = new BrowserWindow({
		width: 400,
		height: 500,
		webPreferences: {
			nodeIntegration: true
		},
		frame: true,
		resizable: true
	});
	
	win.loadFile("interface/index.html");
	win.removeMenu();
	
	win.webContents.on("did-finish-load", () => {
		win.webContents.send("portValue", 3000);
	});
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
	if(process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if(BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

ipcMain.on("registerUser", (event, user, password) => {
	users.registerUser(user, password).then(() => {
		event.reply("registerUser", true);
	}).catch(err => {
	
	});
});