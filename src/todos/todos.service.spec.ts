import { Repository } from 'typeorm';
import { Todo } from './entities/todo.entity';
import { TodosService } from './todos.service';

describe('TodosService', () => {
  let service: TodosService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    service = new TodosService(repo as unknown as Repository<Todo>);
  });

  it('creates todo via create + save and returns created id', async () => {
    const dto = {
      title: 'Buy milk',
      description: 'from market',
      user: { id: 7 },
    };
    const entity = { ...dto, completed: false };

    repo.create.mockReturnValue(entity);
    repo.save.mockResolvedValue({ ...entity, id: 42 });

    const id = await service.create(dto);

    expect(repo.create).toHaveBeenCalledWith({ ...dto, completed: false });
    expect(repo.save).toHaveBeenCalledWith(entity);
    expect(id).toBe(42);
  });
});
