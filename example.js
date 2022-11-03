'use strict';

const LightningClient = require('./index');

let cln_path = '/tmp/ltests-3yvn7pgj/test_linegraph_1/lightning-1/regtest/'
const client = new LightningClient(cln_path);

client.getinfo()
    .then(info => console.log(info));

// async with positional "params" arguments
id = (await client.getinfo()).id
res = (await client.listchannels(short_channel_id=null, source=id))
