
import { NumatoDevice } from './gpio/numato-device';

const dev = new NumatoDevice(8, 0);

let initialized = false;

module.exports = {
  MODE_BCM: 'bcm',
  promise: {
    init: async () => {
      if (!initialized) {
        dev.invertOutputs = true;
        dev.updateGPICount(0);
        await dev.init();
        initialized = true;
      }
    },
    // @ts-ignore
    setup: async (mapping: any, dir: any) => {
    },
    write: async (port: any, value: boolean) => {
      dev.sendGPO(port, value);
    }
  },
  // @ts-ignore
  setMode: (mode: any) => {
  }
}