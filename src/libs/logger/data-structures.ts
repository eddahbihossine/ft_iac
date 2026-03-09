export enum WinstonLevel {
    error = 0,
    warn = 1,
    info = 2,
    http = 3,
    verbose = 4,
    debug = 5,
    silly = 6,
}

export type AllMetadataTemplateType = MetadataTemplate & ErrorMetadataTemplate & HttpMetadataTemplate

export interface MetadataTemplate {
    level?: string,
    rawLevel?: string, // Use to have string without color chars
    message?: string,
    module?: { name: string },
    element?: string,
    rawData?: any,
    requestId?: string
    timestamp?: number // timestamp

    // Nest data
    controller?: { name: string },
    service?: { name: string },
    middleware?: { name: string }
}

export interface ErrorMetadataTemplate extends MetadataTemplate {
    stack?: any,
    suspectedFunction?: ((...x: any) => any),
    errorDescription?: string
}

export interface HttpMetadataTemplate extends MetadataTemplate {
    // Request data
    method?: string,
    url?: string,

    // Response data
    responseStatus?: string,
    responseLength?: string,
    responseTime?: string
}