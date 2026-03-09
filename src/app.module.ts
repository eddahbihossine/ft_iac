import { MiddlewareConsumer, Module, NestModule, OnApplicationBootstrap } from '@nestjs/common';
import { AppController } from './app.controller';
import { LoggerRequestMiddleware, LoggerInsertLogDataMiddleware } from './libs/logger/express-middleware';
import { TodosModule } from './todos/todos.module';
import * as httpContext from 'express-http-context';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Todo } from './todos/entities/todo.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { LoginModule } from './login/login.module';
import { HealthModule } from './health/health.module';
import { UsersService } from './users/users.service';
import { DataSource } from 'typeorm';
import { appModuleBootstrap } from './app.hooks';

@Module({
  imports: [TodosModule,
    ConfigModule.forRoot({
      envFilePath: ['.env', '.env.local'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('MYSQL_HOST'),
        port: +configService.get('MYSQL_PORT'),
        username: configService.get('MYSQL_USER'),
        password: configService.get('MYSQL_PASSWORD'),
        database: configService.get('MYSQL_DATABASE'),
        entities: [Todo, User],
        synchronize: (configService.get('NODE_ENV') !== 'production'),
      })
    }),
    UsersModule,
    LoginModule,
    HealthModule
  ],
  controllers: [AppController],
})

export class AppModule implements NestModule, OnApplicationBootstrap {
  constructor(
      private readonly configService: ConfigService,
      private readonly usersService: UsersService,
      private readonly db: DataSource
    ) {}

  async onApplicationBootstrap() {
    await appModuleBootstrap({
      configService: this.configService,
      usersService: this.usersService,
      db: this.db
    })
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        // Log request payload
        LoggerRequestMiddleware,
        // Store request data
        httpContext.middleware, LoggerInsertLogDataMiddleware
      )
      .forRoutes('/');
  }
}
