const path = require("path");
const net = require("net");
const fs = require("fs");
const readline = require("readline");
const { EventEmitter } = require("events");
const methods = require("./methods");

class LightningClient extends EventEmitter {
  constructor({ host, rune }) {
    super();
    this.host = host;
    this.rune = rune;
  }

  call(method, args = {}) {
    return fetch(`${this.host}/v1/${method}`, {
      body: JSON.stringify(args),
      method: "POST",
      headers: {
        "content-type": "application/json",
        Rune: this.rune,
      },
    }).then((r) => r.json());
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
