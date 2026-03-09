import * as httpContext from 'express-http-context';
import {v4 as uuidv4} from 'uuid';
import {Response, NextFunction, RequestHandler} from 'express';
import {Request, NoBody, NoQuery, NoParams} from './data-structures/express-request';
import * as morgan from 'morgan';
import {HttpMetadataTemplate, WinstonLevel} from './data-structures';
import Logger from './index';

/**
 * Middleware : insert data into httpContext for log
 *
 * Nest HTTP platform : Express.js (reason : use httpContext package)
 *
 * @param req
 * @param res
 * @param next
 */
export function LoggerInsertLogDataMiddleware(req: Request<NoBody, NoQuery, NoParams>, res: Response, next: NextFunction) {
    httpContext.set('requestId', uuidv4());
    httpContext.set('clientIp', req.headers['x-forwarded-for'] || req.socket.remoteAddress);

    next();
}

/**
 * Middleware : log HTTP request
 *
 * Nest HTTP platform : Express.js (reason : use Request and Response from Express.js)
 *
 * Dev note : use morgan but only for get response data
 */
export const LoggerRequestMiddleware: RequestHandler = morgan((tokens: morgan.TokenIndexer<Request, Response>, req: Request, res: Response): any => {
    let requestData: HttpMetadataTemplate = {
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        responseStatus: tokens.status(req, res),
        responseLength: tokens.res(req, res, 'content-length'),
        responseTime: tokens['response-time'](req, res)
    };

    // NOTE : Ignore logging health check route if log level < verbose (for avoid log spam)
    if (WinstonLevel[Logger.server.level as keyof typeof WinstonLevel] < WinstonLevel.verbose && requestData.url.startsWith('/health'))
        return;

    if (Logger.server.level === 'debug') {
        let queryContent: { query?: object, params?: object, body?: object } = {};

        if (Object.keys(req?.query || {}).length > 0)
            queryContent.query = req.query;
        if (Object.keys(req?.params || {}).length > 0)
            queryContent.params = req.params;
        if (Object.keys(req?.body || {}).length > 0)
            queryContent.body = req.body;

        if (Object.keys(queryContent).length > 0)
            requestData.rawData = queryContent;

        Logger.server.http(requestData);
    } else
        Logger.server.http(requestData);
});
