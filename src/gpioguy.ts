import { Cachearoo } from "cachearoo";
import { logger } from "./log";

let cachearoo: Cachearoo | undefined = undefined;

module.exports = {
  MODE_BCM: 'bcm',
  promise: {
    init: async () => {
      cachearoo = new Cachearoo();
    },
    // @ts-ignore
    setup: async (mapping: any, dir: any) => {
    },
    write: async (port: any, value: boolean) => {
      const str = `gpo-${port}-${value ? 'on' : 'off'}`;
      logger.debug(str);
      cachearoo?.connection.signalEvent('sesame.events.external', str, {});
    }
  },
  // @ts-ignore
  setMode: (mode: any) => {
  }
}