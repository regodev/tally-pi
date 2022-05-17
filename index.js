const gpio = require('rpi-gpio');
const gpiop = gpio.promise;

let loopIdx = 0;

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

async function init() {
  gpio2.setMode(gpio.MODE_BCM);
  for (let i = 0; i < mapping.length; i++) {
    console.log('setup', mapping[i]);
    const res = await gpiop.setup(mapping[i], gpio.DIR_OUT);
    console.log('done');
  }

  setInterval(() => loop(), 1000);
}

async function loop() {
  for (let i = 0; i < mapping.length; i++) {
    console.log('setting gpo pin', mapping[i]);
    await gpiop.write(mapping[i], i === loopIdx);
  }

  loopIdx++;
  if (loopIdx >= mapping.length) {
    loopIdx = 0;
  }
}

console.log('init..');
init()
  .then(() => console.log('ok'))
  .catch(err => console.error(err));