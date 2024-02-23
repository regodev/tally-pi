import { IEvent } from "cachearoo/dist/libs/cro.connection";
import { logger } from "./log";

const debug = process.argv.pop() === 'debug';
if (debug) {
  log('Debug mode');
}

const gpioMock = {
  MODE_BCM: '',
  DIR_HIGH: '',
  promise: {
    // @ts-ignore
    setup: async (mapping: any, dir: any) => {
    },
    write: async (port: any, value: any) => {
      log('gpio mock write', port, value);
    }
  },
    // @ts-ignore
    setMode: (mode: any) => {
  }
}

let gpiolib: any = null;

let mapping = [
  5,
  6,
  13,
  16,
  19,
  20,
  21,
  26
];

if (process.platform === 'win32') {
  gpiolib = require('./numato');
  mapping = [0, 1, 2, 3, 4, 5, 6, 7];
} else {
  gpiolib = require('rpi-gpio');
}

const gpio = debug ? gpioMock! : gpiolib!;
const gpiop = gpio.promise;

const os = require('os');
const { RequestOptions } = require('cachearoo');

const Cachearoo = require('cachearoo').Cachearoo;

const HOST = 'tally.tools.regoproduction.io';
const PORT = 4300;

const HOSTNAME = os.hostname();

let nextTallyObject: any = null;

let deviceMapping: any = {};
let lastTallies: any[] = [];
let initialized = false;

function log(msg: string, ...args: any[]) {
  logger.info(`${msg} ${args.join(' ')}`);
}

function error(msg: string, ...args: any[]) {
  logger.error(`${msg} ${args.join(' ')}`);
}

const cro = new Cachearoo({ bucket: 'gpo-boxes', host: HOST, port: PORT, clientId: HOSTNAME, enablePing: true, pingInterval: 10000 });
cro.connection.onConnect = async () => {
  log('Cachearoo connect');
  await readMappings();
  await readTallies();
};

cro.connection.addListener('tally', 'tallies', true, (ev: IEvent) => {
  nextTallyObject = ev.value;
});

cro.connection.addListener('gpo-boxes', HOSTNAME, true, (ev: IEvent) => {
  log(`Update mappings obj: ${ev.value}`);
  if (ev.value) {
    deviceMapping = ev.value;
  }
});

async function readMappings() {
  try {
    const obj = await cro.read(HOSTNAME);
    log(`Update mappings: ${JSON.stringify(obj)}`);
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

async function updateTallies(arr: any[]) {
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
          error('Failed to update tally', mappingIdx, err);
        }
      }
    }
  }
}

async function init() {
  if (gpiop.init !== undefined) {
    log('Init gpio');
    await gpiop.init();
  }

  gpio.setMode(gpio.MODE_BCM);
  for (let i = 0; i < mapping.length; i++) {
    if (debug) {
      log(`setup mapping: ${mapping[i]}`);
    }
    await gpiop.setup(mapping[i], gpio.DIR_HIGH);
    if (lastTallies) {
      updateTallies(lastTallies);
    };
  }
}

const lastSet: any = {};

async function setGPO(idx: number, value: boolean) {
  if (lastSet[idx] === value) return;
  lastSet[idx] = value;
  if (debug) {
    log(`Setting gpo pin ${mapping[idx]} to ${value}`);
  }
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
        error('Failed to update tallies', err);
      }
    }
  }, 10);
