const debug = process.argv.pop() === 'debug';
if (debug) {
  log('Debug mode');
}

const gpioMock = {
  promise: {
    setup: async (mapping, dir) => {
    },
    write: async (port, value) => {
      log('gpio write', port, value);
    }
  },
  setMode: (mode) => {
  }
}

const gpiolib = require('rpi-gpio');

const gpio = debug ? gpioMock : gpiolib;
const gpiop = gpio.promise;

const os = require('os');
const { RequestOptions } = require('cachearoo');

const Cachearoo = require('cachearoo').Cachearoo;

const HOST = 'tally.tools.regoproduction.io';
const PORT = 4300;

const HOSTNAME = os.hostname();

let nextTallyObject = null;

let deviceMapping = {};
let lastTallies = null;
let initialized = false;

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

function log(msg) {
  console.log(`${new Date().toISOString()}: ${msg}`);
}

function error(msg) {
  console.error(`${new Date().toISOString()}: ${msg}`);
}

const cro = new Cachearoo({ bucket: 'gpo-boxes', host: HOST, port: PORT, clientId: HOSTNAME, enablePing: true, pingInterval: 10000 });
cro.connection.onConnect = async () => {
  log('Cachearoo connect');
  await readMappings();
  await readTallies();
};

cro.connection.addListener('tally', 'tallies', true, (ev) => {
  nextTallyObject = ev.value;
});

cro.connection.addListener('gpo-boxes', HOSTNAME, true, (ev) => {
  log(`update mappings obj: ${ev.value}`);
  if (ev.value) {
    deviceMapping = ev.value;
  }
});

async function readMappings() {
  try {
    const obj = await cro.read(HOSTNAME);
    log(`update mappings: ${JSON.stringify(obj)}`);
    deviceMapping = obj;
  } catch (err) {
    deviceMapping = {};
    error(`No mappings for ${HOSTNAME}`);
  }
}

async function readTallies() {
  try {
    const obj = await cro.read('tallies', new RequestOptions({ bucket: 'tally'} ));
    await updateTallies(obj);
  } catch (err) {
    error('Failed to read tallies', err);
  }
}

async function updateTallies(arr) {
  if (!Array.isArray(arr)) {
    error('updateTallies, object is not an array');
    return;
  }
  if (JSON.stringify(arr) === JSON.stringify(lastTallies)) return;

  lastTallies = arr;
  if (!initialized) return;

  for (let i = 0; i < arr.length; i++) {
    const mappingIdx = deviceMapping[arr[i].name];
    if (mappingIdx != null) {
      if (arr[i].tally) {
        try {
          await setGPO(mappingIdx, !!(arr[i].tally.tally1 || arr[i].tally.tally2));
        } catch (err) {
          error('Failed to update tally', mappingIdx);
        }
      }
    }
  }
}

async function init() {
  gpio.setMode(gpio.MODE_BCM);
  for (let i = 0; i < mapping.length; i++) {
    log(`setup mapping: ${mapping[i]}`);
    const res = await gpiop.setup(mapping[i], gpio.DIR_HIGH);
    if (lastTallies) {
      updateTallies(lastTallies);
    };
    log('done');
  }
}

const lastSet = {};

async function setGPO(idx, value) {
  if (lastSet[idx] === value) return;
  lastSet[idx] = value;
  log(`Setting gpo pin ${mapping[idx]} to ${value}`);
  return gpiop.write(mapping[idx], !value);
}

log(`Init.. hostname: ${HOSTNAME}`);
init()
  .then(() => {
    log('init ok');
    initialized = true;
  })
  .catch((err) => {
    error(err);
  });

  setInterval(async () => {
    if (nextTallyObject) {
      const tally = nextTallyObject;
      nextTallyObject = null;
      try {
        await updateTallies(tally);
      } catch (err) {
        error('Failed to update tallies');
      }
    }
  }, 10);
