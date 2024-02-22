export type GPIODeviceState = 'uninitialized' | 'initialized';

export interface IGPIODevice {
  init(): Promise<void>;
  updateGPICount(gpiCount: number): Promise<void>;
  cleanup(): void;
  sendGPO(gpo: number, value: boolean): void;
  invertInputs: boolean;
  invertOutputs: boolean;
  onGPI(gpi: number): void;
  state: GPIODeviceState;
}