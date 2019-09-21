const fs = require("fs");
const path = require("path");
let crypto;
try{
	crypto = require("crypto");
} catch(e){
	throw "The current Node.js does not support the crypto module";
}

const usersFile = path.join(__dirname, "users.json");
let users = {};

if(!fs.existsSync(usersFile))
	fs.writeFileSync(usersFile, JSON.stringify(users));
else{
	let fileContent;
	try{
		fileContent = JSON.parse(fs.readFileSync(usersFile));
	} catch(e){
		throw "Error while reading users file: " + e;
	}
	if(!fileContent.hasOwnProperty("users") || fileContent.users.constructor !== Array) throw "Invalid users file format";
	users = fileContent;
}

module.exports = {
	authenticate: (user, password) => {
		if(!users.hasOwnProperty(user)) return false;
		let u = users[user];
		if(u.salt === undefined || u.hash === undefined){
			delete users[user];
			return false;
		}
		return u.hash === _hash(password, u.salt);
	},
	registerUser: (user, password) => {
		if(users.hasOwnProperty(user)) return false;
		users[user] = {
			salt: crypto.randomBytes(64).toString("hex")
		};
		try{
			users[user].hash = _hash(password, users[user].salt);
			return true;
		} catch(e){
			delete users[user];
		}
		return false;
	}
};

module.exports.registerUser("test", "password");
module.exports.registerUser("test2", "password");
module.exports.registerUser("username123", "pAsWoRd");
module.exports.registerUser("test32", "123se123");
fs.writeFileSync(usersFile, JSON.stringify(users), err => console.log(err));

function _hash(password, salt){
	return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}