import * as winston from 'winston';
import * as os from 'os';
import 'winston-daily-rotate-file';

const transport = new winston.transports.DailyRotateFile({
  filename: os.platform() == 'win32' ? 'c:\\log\\sesame\\gpio-guy\\gpio-guy-%DATE%.log' : 'log/gpio-guy-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  maxSize: '2m',
  maxFiles: '14d'
});

const consoleTransport = new winston.transports.Console({
});

export const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ), transports: [
    transport,
    consoleTransport
  ]
});
