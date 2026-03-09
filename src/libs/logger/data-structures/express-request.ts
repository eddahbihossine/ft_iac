import * as core from 'express-serve-static-core';
import * as express from 'express';

/**
 * Custom Body/Params/Query Express types
 */

export type Body = any;

export interface Query extends core.Query {}

export interface Params extends core.ParamsDictionary {}

export interface Request<ReqBody = any,
    ReqQuery = Query,
    URLParams extends Params = core.ParamsDictionary>
    extends express.Request<URLParams, any, ReqBody, ReqQuery> {}

export interface Response<ResBody = any,
    StatusCode extends number = number>
    extends core.Response<ResBody, Record<string, any>, StatusCode> {}

/**
 * Empty Body/Params/Query types
 * (for code verbosity)
 */

export type NoBody = null;
export type NoParams = {};
export type NoQuery = null;
