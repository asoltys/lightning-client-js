const path = require("path");
const net = require("net");
const fs = require("fs");
const readline = require("readline");
const { EventEmitter } = require("events");
const methods = require("./methods");

const defaultRpcPath = path.join(require("os").homedir(), ".lightning");
const fStat = (...p) => fs.statSync(path.join(...p));
const fExists = (...p) => fs.existsSync(path.join(...p));

class LightningClient extends EventEmitter {
	constructor(providedPath = defaultRpcPath) {
		let rpcPath = providedPath;

		if (!path.isAbsolute(rpcPath)) {
			throw new Error("The rpcPath must be an absolute path");
		}

		if (!fExists(rpcPath) || !fStat(rpcPath).isSocket()) {
			// network directory provided, use the lightning-rpc within in
			if (fExists(rpcPath, "lightning-rpc")) {
				rpcPath = path.join(rpcPath, "lightning-rpc");
			}

			// main data directory provided, default to using the bitcoin mainnet subdirectory
			// to be removed in v0.2.0
			else if (fExists(rpcPath, "bitcoin", "lightning-rpc")) {
				console.error(
					`WARN: ${rpcPath}/lightning-rpc is missing, using the bitcoin mainnet subdirectory at ${rpcPath}/bitcoin instead.`,
				);
				console.error(
					"WARN: specifying the main lightning data directory is deprecated, please specify the network directory explicitly.\n",
				);
				rpcPath = path.join(rpcPath, "bitcoin", "lightning-rpc");
			}
		}

		super();
		this.rpcPath = rpcPath;
		this.reconnectWait = 0.5;
		this.reconnectTimeout = null;
		this.reqcount = 0;

		this.client = net.createConnection(rpcPath);
		this.rl = readline.createInterface({ input: this.client });

		this.clientConnectionPromise = new Promise((resolve) => {
			this.client.on("connect", () => {
				this.reconnectWait = 1;
				resolve();
			});

			this.client.on("end", () => {
				console.error("Lightning client connection closed, reconnecting");
				this.increaseWaitTime();
				this.reconnect();
			});

			this.client.on("error", (error) => {
				console.error("Lightning client connection error", error);
				this.emit("error", error);
				this.increaseWaitTime();
				this.reconnect();
			});
		});

		this.rl.on("line", (line) => {
			const trimmed = line.trim();
			if (!trimmed) return;
			const data = JSON.parse(trimmed);
			this.emit(`res:${data.id}`, data);
		});
	}

	increaseWaitTime() {
		if (this.reconnectWait >= 16) {
			this.reconnectWait = 16;
		} else {
			this.reconnectWait *= 2;
		}
	}

	reconnect() {
		if (this.reconnectTimeout) {
			return;
		}

		this.reconnectTimeout = setTimeout(() => {
			this.client.connect(this.rpcPath);
			this.reconnectTimeout = null;
		}, this.reconnectWait * 1000);
	}

	call(method, args = {}) {
		const callInt = ++this.reqcount;
		const sendObj = {
			jsonrpc: "2.0",
			method,
			params: args,
			id: `${callInt}`,
		};

		// Wait for the client to connect
		return this.clientConnectionPromise.then(
			() =>
				new Promise((resolve, reject) => {
					// Wait for a response
					this.once(`res:${callInt}`, (res) =>
						res.error == null
							? resolve(res.result)
							: reject(LightningError(res.error)),
					);

					// Send the command
					this.client.write(JSON.stringify(sendObj));
				}),
		);
	}
}

const protify = (s) => s.replace(/-([a-z])/g, (m) => m[1].toUpperCase());

for (const k of methods) {
	LightningClient.prototype[protify(k)] = function (...args) {
		return this.call(
			k,
			args.length === 1 && args[0].constructor === Object ? args[0] : args,
		);
	};
}

module.exports = (rpcPath) => new LightningClient(rpcPath);
module.exports.LightningClient = LightningClient;
