import { ReadlineParser, SerialPort } from 'serialport';
import { logger } from '../log';
import { BinaryState } from '../binary-state';
import { GPIODeviceState, IGPIODevice } from './gpio-device';

const NUMATO_VENDOR_ID = '2A19';
const NUMATOR_PRODUCT_ID = '0800';
const POLL_INTERVAL = 10;
const GPI_DEBOUNCE = 300;

interface ICommand {
  data: string;
  isReadAll?: boolean;
}

namespace Command {
  export const readAll = () => ({ data: 'gpio readall', isReadAll: true });
  export const writeAll = (state: BinaryState) => ({ data: `gpio writeall ${state.getHex()}` });
  export const setIODir = (state: BinaryState) => ({ data: `gpio iodir ${state.getHex()}` });
  export const setMask = (state: BinaryState) => ({ data: `gpio iomask ${state.getHex()}` });
  export const setGPO = (gpo: number, invert: boolean) => ({ data: `gpio ${invert ? 'set' : 'clear'} ${gpo}` });
  export const clearGPO = (gpo: number, invert: boolean) => ({ data: `gpio ${invert ? 'clear' : 'set'} ${gpo}` });
  export const readGPI = (gpi: number) => ({ data: `gpio read ${gpi}` });
  export const readVersion = () => ({ data: 'ver' });
  export const getPowerOnInfo = () => ({ data: 'info' });
  export const getId = () => ({ data: 'id get' });
  export const setId = (id: string) => ({ data: `id set ${id}` });
}

export class NumatoDevice implements IGPIODevice {
  private port?: SerialPort;
  private parser?: ReadlineParser;
  private commandProcHandle?: NodeJS.Timeout;
  private commandQueue: ICommand[] = [];
  private gpioState;
  private portCount: number;
  private gpiIndex: number;
  private _state: GPIODeviceState = 'uninitialized';
  private lastTrigs: number[] = [];
  public connected = false;

  public invertInputs: boolean = false;
  public invertOutputs: boolean = false;

  public onGPI: (gpi: number) => void = () => { };
  public get state(): GPIODeviceState {
    return this._state;
  }
  
  private gpioDir;

  private waitingForReadAll = false;
  private lastReceived = Date.now();

  constructor(ports: number, gpis: number) {
    this.portCount = ports;
    this.gpioState = new BinaryState(0, ports);
    this.gpioDir = NumatoDevice.getBinaryStateFromGpiCount(gpis, ports);
    this.gpiIndex = ports - gpis;
    this.lastTrigs = new Array(ports).fill(0);
  }

  public static getBinaryStateFromGpiCount(gpis: number, ports: number): BinaryState {
    /* 
    Documentation states that 1 should be input
    https://numato.com/kb/understanding-readallwriteall-commands-gpio-modules/
    But in practice, 0 is input and 1 is output
    */
    const state = new BinaryState(0xff, ports);
    for (let i = ports - gpis; i < ports; i++) {
      state.updateAt(i, false);
    }
    return state;
  }

  private async openPort(path: string): Promise<SerialPort> {
    return new Promise((resolve, reject) => {
      const port = new SerialPort({ path, baudRate: 19200, autoOpen: false });
      port.on('error', (err) => {
        logger.error('Error on serial port', err);
        if (port.isOpen) {
          this.connected = false;
          port.close();
        }
        this._state = 'uninitialized';
      });
      port.open((err) => {
        if (err) {
          this.connected = false;
          return reject(err);
        } else {
          this.connected = true;
          return resolve(port);
        }
      });
    });
  }

  public async init(): Promise<void> {
    this.commandQueue = [];
    this._state = 'uninitialized';

    logger.info(`Initializing..`)

    const path = await NumatoDevice.findDevice();
    this.port = await this.openPort(path);

    this.lastReceived = Date.now();
   
    this.parser = this.port!.pipe(new ReadlineParser({ delimiter: '\r' }));
    this.parser.on('data', (chunk) => this.receiveData(chunk));
    this.commandProcHandle = setInterval(() => this.process(), POLL_INTERVAL);
    this.queueCommand(Command.setMask(new BinaryState(0, this.portCount).setAllOn()));
    this.queueCommand(Command.writeAll(new BinaryState(0xff, this.portCount)));
    this.queueCommand(Command.setIODir(this.gpioDir));

    for (let i = 0; i < this.gpiIndex; i++) {
      this.queueCommand(Command.clearGPO(i, this.invertOutputs));
    }

    this._state = 'initialized';
  }

  public async updateGPICount(gpiCount: number): Promise<void> {
    this.gpiIndex = this.portCount - gpiCount;
    this.gpioDir = NumatoDevice.getBinaryStateFromGpiCount(gpiCount, this.portCount);

    const gpoString = this.gpiIndex > 0 ? `0-${this.gpiIndex - 1}` : 'none';
    const gpiString = this.gpiIndex < this.portCount ? `${this.gpiIndex}-${this.portCount - 1}` : 'none';
    logger.info(`Numato ${this.portCount} ports. GPOs: ${gpoString} & GPIs: ${gpiString}`)

    if (this._state === 'initialized') {
      this.queueCommand(Command.setMask(new BinaryState(0, this.portCount).setAllOn()));
      this.queueCommand(Command.writeAll(new BinaryState(0xff, this.portCount)));
      this.queueCommand(Command.setIODir(this.gpioDir));

      for (let i = 0; i < this.gpiIndex; i++) {
        this.queueCommand(Command.clearGPO(i, this.invertOutputs));
      }
    }
  }

  private process() {
    try {
      if (this.lastReceived < Date.now() - 3000) {
        logger.error('No data received for 3 seconds, closing port');
        this.cleanup();
        this._state = 'uninitialized';
        return;
      }

      const cmd = this.commandQueue.splice(0, 1);
      if (cmd.length > 0) {
        this.writeCommand(cmd[0]);
      } else {
        this.writeCommand(Command.readAll());
      }
    } catch (err) {
    }
  }

  private queueCommand(command: ICommand) {
    this.commandQueue.push(command);
  }

  private writeCommand(command: ICommand) {
    this.validatePort();
    this.port!.write(command.data + '\r', 'ascii', (err) => {
      if (err) {
        logger.error(err);
        this.port?.close();
        this._state = 'uninitialized';
      }
    });
  }

  private receiveData(data: string) {
    this.lastReceived = Date.now();
  
    if (data.trim() === '>gpio readall') {
      this.waitingForReadAll = true;
      return;
    }

    if (this.waitingForReadAll) {
      this.waitingForReadAll = false;
      let newState = new BinaryState(parseInt(data, 16), this.portCount);

      if (this.invertInputs) {
        newState = newState.getInverted();
      }

      for (let i = this.gpiIndex; i < this.portCount; i++) {
        let prev = this.gpioState.getAt(i);
        if (newState.getAt(i) && !prev) {
          const now = Date.now();
          if (now - this.lastTrigs[i] > GPI_DEBOUNCE) {
            this.onGPI(i);
            this.lastTrigs[i] = now;
          }
        }
      }
      this.gpioState = newState;
    }
  }

  private validatePort() {
    if (!this.port) throw new Error('Device not initialized');
    if (!this.port.isOpen) throw new Error('Device not open');
  }

  public sendGPO(gpo: number, value: boolean) {
    try {
      if ((gpo < 0) || (gpo >= this.gpiIndex)) throw new Error(`Invalid GPO number: ${gpo}, should be between 0 and ${this.gpiIndex - 1}`);
      this.validatePort();
      this.gpioState.updateAt(gpo, value);
      if (value) {
        this.queueCommand(Command.setGPO(gpo, this.invertOutputs));
      } else {
        this.queueCommand(Command.clearGPO(gpo, this.invertOutputs));
      }
    } catch (err: any) {
      logger.error(err.message);
    }
  }

  public cleanup() {
    clearInterval(this.commandProcHandle!);
    if (this.port?.isOpen) {
      this.port?.close();
    }
  }

  public static async findDevice(): Promise<string> {
    const ports = await SerialPort.list();
    ports.forEach(p => logger.debug(`Found serial port ${p.path}`));
    const port = ports.find(p => p.vendorId === NUMATO_VENDOR_ID && p.productId === NUMATOR_PRODUCT_ID);
    if (port) {
      logger.info(`Found Numato device at ${port.path}`);
      return port.path;
    }
    throw new Error('Numato device not found');
  }
}