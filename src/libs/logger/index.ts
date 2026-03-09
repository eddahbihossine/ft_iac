import * as winston from 'winston';
import {ErrorMetadataTemplate, HttpMetadataTemplate, MetadataTemplate} from './data-structures';
import * as path from 'path';
import {addDateFormat, addRequestDataFormat, customPrintFormat, saveRawLevelStringFormat} from './custom-formats';

const defaultMinLevel: string = process?.env?.LOG_LEVEL?.toString() as string || 'verbose';
const pathToLogDirectory: string = path.resolve(process?.env?.LOG_DIRECTORY?.toString() as string || './logs');

const defaultFormat = winston.format.json();

const defaultConsoleFormat = customPrintFormat;

const defaultTransports = [
    new winston.transports.File({filename: `${pathToLogDirectory}/error.log`, level: 'error'}),
    new winston.transports.File({filename: `${pathToLogDirectory}/combined.log`}),
    new winston.transports.Console({
        format: winston.format.combine(
            saveRawLevelStringFormat(),
            winston.format.colorize(),
            winston.format.errors({stack: true}),
            defaultConsoleFormat
        )
    })
];

type WinstonLogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

interface WinstonLoggerCustom extends Omit<winston.Logger, WinstonLogLevel> {
    error: { (error: string | Error, meta?: ErrorMetadataTemplate): Logger }
    http: { (requestData: HttpMetadataTemplate): Logger }
    warn: { (message: string, meta?: MetadataTemplate): Logger }
    info: { (message: string, meta?: MetadataTemplate): Logger }
    verbose: { (message: string, meta?: MetadataTemplate): Logger }
    debug: { (message: string, meta?: MetadataTemplate): Logger }
    silly: { (message: string, meta?: MetadataTemplate): Logger }
    originalError: winston.LeveledLogMethod
    originalHttp: winston.LeveledLogMethod
}

function generateDefaultLogger(winstonLoggerBase: WinstonLoggerCustom, appElement: string, metadata?: any) {
    const meta = {
        element: appElement,
        ...metadata
    };

    const logger: WinstonLoggerCustom = Object.create(winstonLoggerBase);

    logger.defaultMeta = meta;

    return logger;
}

function generateCustomLogger(): WinstonLoggerCustom {
    // @ts-ignore (because ".originalError" is not yet defined but it will be)
    let winstonLogger: WinstonLoggerCustom = winston.createLogger({
        level: defaultMinLevel,
        format: winston.format.combine(
            addDateFormat(),
            addRequestDataFormat(),
            defaultFormat
        ),
        transports: defaultTransports
    });

    // Overwrite .error() to handle Error instance to show and store stacktrace
    winstonLogger.originalError = winstonLogger.error as winston.LeveledLogMethod;
    winstonLogger.error = function (error, meta) {
        meta = (typeof meta === 'undefined') ? {} : meta;
        if (error instanceof Error) {
            meta.stack = error.stack;
            return this.originalError(error.message, meta);
        } else
            return this.originalError(error, meta);
    };

    // Overwrite .http() to handle client request
    winstonLogger.originalHttp = winstonLogger.http as winston.LeveledLogMethod;
    winstonLogger.http = function (requestData: HttpMetadataTemplate) {
        return this.originalHttp('', requestData);
    };

    return winstonLogger;
}

export default class Logger {
    static winston: WinstonLoggerCustom = generateCustomLogger();

    static server = generateDefaultLogger(Logger.winston, 'server');
    static controller = generateDefaultLogger(Logger.winston, 'controller');
    static service = generateDefaultLogger(Logger.winston, 'service');
    static middleware = generateDefaultLogger(Logger.winston, 'middleware');

    static dbClient = generateDefaultLogger(Logger.winston, 'database client');

    static other = generateDefaultLogger(Logger.winston, 'other');
}
