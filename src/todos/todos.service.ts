import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Logger from '../libs/logger';
import { Repository } from 'typeorm';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { Todo } from './entities/todo.entity';

@Injectable()
export class TodosService {
  constructor(@InjectRepository(Todo) private todosRepository: Repository<Todo>) { }

  /**
   * @returns Todo created id
   */
  async create(createTodoDto: Omit<CreateTodoDto, 'id' | 'completed'>): Promise<number> {
    const insertResult = await this.todosRepository.insert(createTodoDto);

    const newTodoId = insertResult.identifiers[0].id;

    Logger.service.debug(`Todo "${newTodoId}" created`, { service: TodosService, rawData: { insertResult } });

    return newTodoId;
  }

  async findAll(): Promise<Todo[]> {
    const todos = await this.todosRepository.find();

    Logger.service.debug(`All todos found`, { service: TodosService, rawData: todos });

    return todos;
  }

  async findAllByUserId(userId: number): Promise<Todo[]> {
    const todos = await this.todosRepository.findBy({user: {id: userId}});

    Logger.service.debug(`All todos found`, { service: TodosService, rawData: todos });

    return todos;
  }

  async findOne(id: number): Promise<Todo> {
    let todo: Todo;

    try {
      todo = await this.todosRepository.findOneByOrFail({ id });
    } catch (error) {
      const errorDescription = `Todo "${id}" not found`;
      Logger.service.error(error, { service: TodosService, errorDescription });
      throw new NotFoundException(errorDescription);
    }

    Logger.service.debug(`Todo "${todo.id}" found`, { service: TodosService, rawData: todo });

    return todo;
  }

  async update(id: number, updateTodoDto: UpdateTodoDto): Promise<void> {
    const updateResult = await this.todosRepository.update(id, updateTodoDto);

    if (updateResult.affected === 0) {
      const errorDescription = `Todo "${id}" not found`;
      Logger.service.error(errorDescription, { service: TodosService });
      throw new NotFoundException(errorDescription);
    }
    Logger.service.debug(`Todo "${id}" updated`, { service: TodosService, rawData: { updateResult } });
  }

  async remove(id: number): Promise<void> {
    const deleteResult = await this.todosRepository.delete(id);
    if (deleteResult.affected === 0) {
      const errorDescription = `Todo "${id}" not found`;
      Logger.service.error(errorDescription, { service: TodosService });
      throw new NotFoundException(errorDescription);
    }
    Logger.service.debug(`Todo "${id}" removed`, { service: TodosService });
  }
}
