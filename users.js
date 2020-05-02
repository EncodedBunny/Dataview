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
	users = fileContent;
}

module.exports = {
	authenticate: (user, password) => {
		return new Promise((resolve, reject) => {
			if(!users.hasOwnProperty(user)) reject();
			let u = users[user];
			_hash(password, u.salt,(err, hash) => {
				if(err) reject(err);
				if(u.hash === hash)
					resolve({
						username: user
					});
				else
					reject();
			});
		});
	},
	registerUser: (user, password) => {
		return new Promise((resolve, reject) => {
			if(users.hasOwnProperty(user)) reject();
			crypto.randomBytes(64, (err, buffer) => {
				if(err) reject(err);
				let salt = buffer.toString("hex");
				_hash(password, salt, (errH, hash) => {
					if(errH) reject(errH);
					users[user] = {
						salt: salt,
						hash: hash
					};
					resolve({
						username: user
					});
					fs.writeFileSync(usersFile, JSON.stringify(users),err => console.log(err));
				});
				return true;
			});
		});
	}
};

// module.exports.registerUser("test", "c0cb468ff9d6577f30a9a5eeb2099401a87cb552ab7e1d4931934edc07699df3");
// module.exports.registerUser("test2", "password");
// module.exports.registerUser("username123", "pAsWoRd");
// module.exports.registerUser("test32", "123se123");

function _hash(password, salt, callback){
	crypto.pbkdf2(password, salt, 10000, 64, "sha512", (err, dKey) => {
		callback(err, dKey.toString("hex"));
	});
}