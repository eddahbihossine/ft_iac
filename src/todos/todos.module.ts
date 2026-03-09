import { MiddlewareConsumer, Module } from '@nestjs/common';
import { TodosService } from './todos.service';
import { TodosController } from './todos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Todo } from './entities/todo.entity';
import { LoggedMiddleware } from 'src/login/middlewares/Logged.middleware';

@Module({
  imports: [TypeOrmModule.forFeature([Todo])],
  controllers: [TodosController],
  providers: [TodosService]
})
export class TodosModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggedMiddleware)
      .forRoutes('todos');
  }
}
