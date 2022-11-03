# clightning-client-js

JavaScript [c-lightning](https://github.com/ElementsProject/lightning) client.

Forked from [BHBNETWORK/lightning-client-js](https://github.com/BHBNETWORK/lightning-client-js).

This repository is published as the [`clightning-client`](https://www.npmjs.com/package/clightning-client) NPM module.
The original library is published as `lightning-client` (no `c`).

## Installing the client

You can easily install this client using `npm` by running:

```
npm install clightning-client
```

## Using the client

Once the client is installed you can use it by loading the main class and instantiating it in this way:

```
const LightningClient = require('clightning-client');

// This should point to your lightning-rpc unix socket, by default in ~/.lightning/lightning-rpc
const client = LightningClient('/home/bitcoind/.lightning/lightning-rpc');

// Every call returns a Promise
client.getinfo()
    .then(info => console.log(info));

// or with await
id = (await client.getinfo()).id
res = (await client.listchannels(short_channel_id=null, source=id))
```

**NOTE**: RPC calls require **positional arguments**. Only value of key=value args
are passes and should be in the correct order. Some RPC methods have compulsory args,
which can be set null, according c-lightning's API.
