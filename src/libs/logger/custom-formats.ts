import * as winston from 'winston';
import {AllMetadataTemplateType} from './data-structures';
import * as chalk from 'chalk';
import {toPrettyJson} from './json';
import {EOL} from 'os';
import * as httpContext from 'express-http-context';

function coloriseHttpStatus(status: string) {
    const statusCode: number = parseInt(status, 10);

    if (statusCode >= 200 && statusCode < 300)
        return chalk.green(status);
    else if (statusCode >= 400 && statusCode < 500)
        return chalk.yellow(status);
    else if (statusCode >= 500)
        return chalk.red(status);
    else
        return status;
}

export const customPrintFormat = winston.format.printf(
    ({level, rawLevel, message, element, module, rawData, stack, controller, service, suspectedFunction, errorDescription, requestId, method, url, responseStatus, responseLength, responseTime, ...info}
         : winston.Logform.TransformableInfo & AllMetadataTemplateType) => {
        // Common data
        const requestIdFormat = (requestId !== undefined) ? ` [${requestId}]` : '';
        const elementFormat = (element !== undefined) ? ` [${chalk.magenta(element)}]` : '';
        const controllerFormat = (controller !== undefined) ? ` [controller: ${controller.name}]` : '';
        const serviceFormat = (service !== undefined) ? ` [service: ${service.name}]` : '';
        const moduleFormat = (module !== undefined) ? ` [module: ${module.name}]` : '';
        const rawDataFormat = (rawData !== undefined) ? ` [raw data JSON : ${toPrettyJson(rawData)}]` : '';

        const startFormat = `[${level}]${requestIdFormat}${elementFormat}${controllerFormat}${serviceFormat}${moduleFormat}`;
        const endFormat = `${rawDataFormat}`;

        if (rawLevel === 'http') {
            // Http data
            const methodFormat = (method !== undefined) ? ` ${chalk.blue(method)}` : '';
            const urlFormat = (url !== undefined) ? ` ${chalk.blue(url)}` : '';
            const responseStatusFormat = (responseStatus !== undefined) ? ` [${coloriseHttpStatus(responseStatus)}]` : '';
            const responseLengthFormat = (responseLength !== undefined) ? ` [${responseLength} Bytes]` : '';
            const responseTimeFormat = (responseTime !== undefined) ? ` [${responseTime} ms]` : '';

            const requestDataFormatted = `${methodFormat}${urlFormat}${responseStatusFormat}${responseLengthFormat}${responseTimeFormat}`;

            return `${startFormat}${requestDataFormatted}${endFormat}`;
        } else if (rawLevel === 'error') {
            // Error data
            const suspectedFunctionFormat = (suspectedFunction !== undefined) ? ` [suspected function : ${suspectedFunction.name}]` : '';
            const errorDescriptionFormat = (errorDescription !== undefined) ? ` ${errorDescription} :${EOL}` : '';

            return `${startFormat} ${errorDescriptionFormat} ${stack || message}${suspectedFunctionFormat}${endFormat}`;
        }

        return `${startFormat} ${message}${endFormat}`;
    });

/**
 * Use to add request data to log
 *
 * Nest HTTP platform : Express.js (reason : use httpContext package)
 */
export const addRequestDataFormat = winston.format((info: winston.Logform.TransformableInfo & AllMetadataTemplateType, opts) => {
    info.requestId = httpContext.get('requestId');
    // info.clientIp = httpContext.get('clientIp');

    return info;
});

/**
 * Use to save "level" string before colorize log info
 */
export const saveRawLevelStringFormat = winston.format((info: winston.Logform.TransformableInfo & AllMetadataTemplateType, opts) => {
    info.rawLevel = info.level;

    return info;
});

/**
 * Use to add timestamp in metadata
 */
export const addDateFormat = winston.format((info: winston.Logform.TransformableInfo & AllMetadataTemplateType, opts) => {
    info.timestamp = Date.now();

    return info;
});
