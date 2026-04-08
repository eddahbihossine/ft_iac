import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import * as session from 'express-session';
import { createHash, randomBytes } from 'crypto';
import { AppSessionBaseType } from './libs/data-structures/app-session.type';
import { ConfigService } from '@nestjs/config';

declare module 'express-session' {
  export interface SessionData extends AppSessionBaseType {}
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  const mysqlHost = (configService.get<string>('MYSQL_HOST') || '').trim();
  const mysqlPort = +(configService.get<string>('MYSQL_PORT') || '3306');
  const mysqlUser = (configService.get<string>('MYSQL_USER') || '').trim();
  const mysqlPassword = (configService.get<string>('MYSQL_PASSWORD') || '').trim();
  const mysqlDatabase = (configService.get<string>('MYSQL_DATABASE') || '').trim();

  const sessionSecret = (configService.get<string>('SESSION_SECRET') || '').trim()
    || (mysqlPassword
      ? createHash('sha256').update(mysqlPassword).digest('hex')
      : randomBytes(42).toString('hex'));

  let sessionStore: session.Store | undefined;
  const hasDbConfig = Boolean(mysqlHost && mysqlUser && mysqlPassword && mysqlDatabase);
  if (hasDbConfig) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const MySQLStoreFactory = require('express-mysql-session');
    const MySQLStore = MySQLStoreFactory(session);
    sessionStore = new MySQLStore(
      {
        // Create a dedicated sessions table; keep the name stable.
        schema: {
          tableName: 'sessions',
        },
      },
      {
        host: mysqlHost,
        port: mysqlPort,
        user: mysqlUser,
        password: mysqlPassword,
        database: mysqlDatabase,
      },
    );
  }

  // Express session middleware setup
  app.use(session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 2, // 2 hours
    },
  }));

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, 'views'));
  app.setViewEngine('hbs');

  await app.listen(3000);
}
bootstrap();
