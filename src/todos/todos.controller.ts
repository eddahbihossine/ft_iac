import { Controller, Get, Post, Body, Patch, Param, Render, Delete, HttpException, InternalServerErrorException, Res, Session, UnauthorizedException } from '@nestjs/common';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import Logger from '../libs/logger';
import { Response } from 'express';
import { AppSessionBaseType, AppSessionLoggedType } from 'src/libs/data-structures/app-session.type';

@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) { }

  /**
   * Page : display todos and a form to create a new todo for a specific user
   */
  @Get('/:userId')
  @Render('todos/index')
  async displayTodosByUserId(@Param('userId') userId: string, @Session() session: AppSessionBaseType, @Res() res: Response) {
    Logger.controller.verbose('Display todos page', { controller: TodosController });

    if (session.user === undefined)
      res.redirect('/login');

    if (session.user.id !== +userId)
      throw new UnauthorizedException();

    return {
      username: session.user.username,
      todos: await this.todosService.findAllByUserId(+userId),
    };
  }

  /**
   * Form processing : create a new todo for a specific user.
   * Info : todo id value is ignored
   */
  @Post('/:userId')
  async createTodo(@Body() createTodoDto: Omit<CreateTodoDto, 'id' | 'completed'>, @Res() res: Response, @Param('userId') userId: string, @Session() session: AppSessionLoggedType) {
    Logger.controller.verbose('Create a new todo', { controller: TodosController });

    if (session.user.id !== +userId)
      throw new UnauthorizedException();

    // @ts-ignore because only user id is necessary
    await this.todosService.create({ ...createTodoDto, user: { id: +userId } });
    return res.redirect(`/todos/${session.user.id}`);
  }

  /**
   * API : update a todo
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateTodoDto: UpdateTodoDto) {
    Logger.controller.verbose('Update a todo', { controller: TodosController });

    try {
      return await this.todosService.update(+id, updateTodoDto);
    } catch (error) {
      Logger.controller.error(error, { controller: TodosController, errorDescription: `Can't update todo "${id}"` });
      if (error instanceof HttpException)
        throw error;
      throw new InternalServerErrorException(`Can't update todo "${id}"`);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.todosService.remove(+id);
    } catch (error) {
      Logger.controller.error(error, { controller: TodosController, errorDescription: `Can't remove todo "${id}"` });
      if (error instanceof HttpException)
        throw error;
      throw new InternalServerErrorException(`Can't remove todo "${id}"`);
    }
  }
}
