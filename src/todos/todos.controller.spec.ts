import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { AppSessionLoggedType } from 'src/libs/data-structures/app-session.type';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

describe('TodosController', () => {
  const mockTodosService = {
    create: jest.fn(),
    findAllByUserId: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } as unknown as TodosService;

  const controller = new TodosController(mockTodosService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates todo with trimmed payload and redirects', async () => {
    const redirect = jest.fn();
    const res = { redirect } as unknown as Response;
    const session = { user: { id: 7, username: 'alice' } } as AppSessionLoggedType;

    await controller.createTodo(
      { title: '  Buy milk ', description: ' from market  ' } as any,
      res,
      '7',
      session,
    );

    expect((mockTodosService.create as jest.Mock)).toHaveBeenCalledWith({
      title: 'Buy milk',
      description: 'from market',
      user: { id: 7 },
    });
    expect(redirect).toHaveBeenCalledWith('/todos/7');
  });

  it('throws bad request when title or description is blank', async () => {
    const redirect = jest.fn();
    const res = { redirect } as unknown as Response;
    const session = { user: { id: 7, username: 'alice' } } as AppSessionLoggedType;

    await expect(
      controller.createTodo({ title: '   ', description: 'ok' } as any, res, '7', session),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect((mockTodosService.create as jest.Mock)).not.toHaveBeenCalled();
  });

  it('throws unauthorized when path user does not match session user', async () => {
    const redirect = jest.fn();
    const res = { redirect } as unknown as Response;
    const session = { user: { id: 7, username: 'alice' } } as AppSessionLoggedType;

    await expect(
      controller.createTodo({ title: 'x', description: 'y' } as any, res, '8', session),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
