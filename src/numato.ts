
import { NumatoDevice } from 'numato-gpio';
import { logger } from './log';

const dev = new NumatoDevice(8, 0);
let initialized = false;

module.exports = {
  MODE_BCM: 'bcm',
  promise: {
    init: async () => {
      if (!initialized) {
        dev.onLog = (level: string, msg: string) => {
          logger.log(level, msg);
        }
        
        dev.onError = (err: Error) => {
          logger.log('error', err.message);
        }
        
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
      dev.setGPO(port, value);
    }
  },
  // @ts-ignore
  setMode: (mode: any) => {
  }
}