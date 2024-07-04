'use strict';

const path = require('path');
const net = require('net');
const fs = require('fs');
const readline = require('readline');
const debug = require('debug')('clightning-client');
const {EventEmitter} = require('events');
const LightningError = require('error/typed')({ type: 'lightning', message: 'lightning-client error' })
const methods = require('./methods');

const defaultRpcPath = path.join(require('os').homedir(), '.lightning')
    , fStat = (...p) => fs.statSync(path.join(...p))
    , fExists = (...p) => fs.existsSync(path.join(...p))

class LightningClient extends EventEmitter {
    constructor(rpcPath=defaultRpcPath) {
        if (!path.isAbsolute(rpcPath)) {
            throw new Error('The rpcPath must be an absolute path');
        }

        if (!fExists(rpcPath) || !fStat(rpcPath).isSocket()) {
          // network directory provided, use the lightning-rpc within in
          if (fExists(rpcPath, 'lightning-rpc')) {
            rpcPath = path.join(rpcPath, 'lightning-rpc');
          }

          // main data directory provided, default to using the bitcoin mainnet subdirectory
          // to be removed in v0.2.0
          else if (fExists(rpcPath, 'bitcoin', 'lightning-rpc')) {
            console.error(`WARN: ${rpcPath}/lightning-rpc is missing, using the bitcoin mainnet subdirectory at ${rpcPath}/bitcoin instead.`)
            console.error(`WARN: specifying the main lightning data directory is deprecated, please specify the network directory explicitly.\n`)
            rpcPath = path.join(rpcPath, 'bitcoin', 'lightning-rpc')
          }
        }

        debug(`Connecting to ${rpcPath}`);

        super();
        this.rpcPath = rpcPath;
        this.reconnectWait = 0.5;
        this.reconnectTimeout = null;
        this.reqcount = 0;

        const _self = this;

        this.client = net.createConnection(rpcPath);
        this.rl = readline.createInterface({ input: this.client })

        this.clientConnectionPromise = new Promise(resolve => {
            _self.client.on('connect', () => {
                debug(`Lightning client connected`);
                _self.reconnectWait = 1;
                resolve();
            });

            _self.client.on('end', () => {
                console.error('Lightning client connection closed, reconnecting');
                _self.increaseWaitTime();
                _self.reconnect();
            });

            _self.client.on('error', error => {
                console.error(`Lightning client connection error`, error);
                _self.emit('error', error);
                _self.increaseWaitTime();
                _self.reconnect();
            });
        });

        this.rl.on('line', line => {
          line = line.trim()
          if (!line) return
          const data = JSON.parse(line)
          debug('#%d <-- %O', data.id, data.error || data.result)
          _self.emit('res:' + data.id, data)
        })
    }

    increaseWaitTime() {
        if (this.reconnectWait >= 16) {
            this.reconnectWait = 16;
        } else {
            this.reconnectWait *= 2;
        }
    }

    reconnect() {
        const _self = this;

        if (this.reconnectTimeout) {
            return;
        }

        this.reconnectTimeout = setTimeout(() => {
            debug('Trying to reconnect...');

            _self.client.connect(_self.rpcPath);
            _self.reconnectTimeout = null;
        }, this.reconnectWait * 1000);
    }

    call(method, args = {}) {
        const _self = this;

        const callInt = ++this.reqcount;
        const sendObj = {
            jsonrpc: '2.0',
            method,
            params: args,
            id: ''+callInt
        };

        debug('#%d --> %s %o sendObj: %o', callInt, method, args, sendObj)

        // Wait for the client to connect
        return this.clientConnectionPromise
            .then(() => new Promise((resolve, reject) => {
                // Wait for a response
                this.once('res:' + callInt, res => res.error == null
                  ? resolve(res.result)
                  : reject(LightningError(res.error))
                );

                // Send the command
                _self.client.write(JSON.stringify(sendObj));
            }));
    }
}

const protify = s => s.replace(/-([a-z])/g, m => m[1].toUpperCase());

methods.forEach(k => {
    LightningClient.prototype[protify(k)] = function (...args) {
        return this.call(
            k,
            args.length == 1 && args[0].constructor == Object ? args[0] : args
        );
    };
});

module.exports = rpcPath => new LightningClient(rpcPath);
module.exports.LightningClient = LightningClient;
module.exports.LightningError = LightningError;
