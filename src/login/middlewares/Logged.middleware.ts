import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Logger from '../../libs/logger';

/**
 * This middleware is used to check if the user is logged. If not, redirect to the login page.
 */
@Injectable()
export class LoggedMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        Logger.middleware.verbose(`Request received`, { middleware: LoggedMiddleware });

        if (!req.session?.user) {
            Logger.middleware.verbose(`User not logged`, { middleware: LoggedMiddleware });
            return res.redirect('/login');
        }

        Logger.middleware.verbose(`User logged as "${req.session.user.username}"`, { middleware: LoggedMiddleware });

        next();
    }
}
