const gpio = require('rpi-gpio');
const gpiop = gpio.promise;
const os = require('os');
const { RequestOptions } = require('cachearoo');

const Cachearoo = require('cachearoo').Cachearoo;

const HOST = 'tally.tools.regoproduction.io';
const PORT = 4300;

const HOSTNAME = os.hostname();

let loopIdx = 0;

let deviceMapping = {};

const mapping = [
  5,
  6,
  13,
  16,
  19,
  20,
  21,
  26
];

const cro = new Cachearoo({ bucket: 'gpo-boxes', host: HOST, port: PORT, clientId: HOSTNAME, enablePing: true, pingInterval: 10000 });
cro.connection.onConnect = async () => {
  console.log('Cachearoo connect');
  await readMappings();
  await readTallies();
};

cro.connection.addListener('tally', 'tallies', true, (ev) => {
  updateTallies(ev.value).catch(err => console.error('update tally failed'));
});

cro.connection.addListener('gpo-boxes', HOSTNAME, true, (ev) => {
  console.log('update mappings', HOSTNAME, ev);
  if (ev.value) {
    deviceMapping = ev.value;
  }
});

async function readMappings() {
  try {
    const obj = await cro.read(HOSTNAME);
    console.log('device mapping', obj);
    deviceMapping = obj;
  } catch (err) {
    deviceMapping = {};
    console.error('No mappings for', HOSTNAME);
  }
}

async function readTallies() {
  try {
    const obj = await cro.read('tallies', new RequestOptions({ bucket: 'tally'} ));
    await updateTallies(obj);
    console.log(obj);
  } catch (err) {
    console.error('Failed to read tallies', err);
  }
}

async function updateTallies(arr) {
  if (!Array.isArray(arr)) {
    console.error('updateTallies, object is not an array');
    return;
  }

  for (let i = 0; i < arr.length; i++) {
    const mappingIdx = deviceMapping[arr[i].name];
    if (mappingIdx != null) {
      if (arr[i].tally) {
        await setGPO(mappingIdx, !!arr[i].tally.tally1);
      }
    }
  }
}

async function init() {
  gpio.setMode(gpio.MODE_BCM);
  for (let i = 0; i < mapping.length; i++) {
    console.log('setup', mapping[i]);
    const res = await gpiop.setup(mapping[i], gpio.DIR_HIGH);
    console.log('done');
  }
}

async function loop() {
  for (let i = 0; i < mapping.length; i++) {
    await setGPO(i, i === loopIdx);
  }

  loopIdx++;
  if (loopIdx >= mapping.length) {
    loopIdx = 0;
  }
}

async function setGPO(idx, value) {
  console.log('setting gpo pin', mapping[idx], 'to', value);
  return gpiop.write(mapping[idx], !value);
}

console.log('init..', HOSTNAME);
init()
  .then(() => console.log('ok'))
  .catch(err => console.error(err));