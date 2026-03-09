import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Logger from '../libs/logger';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private usersRepository: Repository<User>) { }

  async create(createUserDto: Omit<CreateUserDto, 'id' | 'todos'>) {
    const insertResult = await this.usersRepository.insert(createUserDto);

    const newUserId : number = insertResult.identifiers[0].id as number;

    Logger.service.debug(`User "${newUserId}" created`, { service: UsersService, rawData: { insertResult } });

    return newUserId;
  }

  async findAll() {
    const users = await this.usersRepository.find();

    Logger.service.debug(`All users found`, { service: UsersService, rawData: users });

    return users;
  }

  async findOne(id: number) {
    let user: User;

    try {
      user = await this.usersRepository.findOneByOrFail({ id });
    } catch (error) {
      const errorDescription = `User "${id}" not found`;
      Logger.service.error(error, { service: UsersService, errorDescription });
      throw new NotFoundException(errorDescription);
    }

    Logger.service.debug(`User "${user.id}" found`, { service: UsersService, rawData: user });

    return user;
  }

  async findOneByUsernameOrFail(username: string) {
    let user: User;

    try {
      user = await this.usersRepository.findOneByOrFail({ username });
    } catch (error) {
      const errorDescription = `User "${username}" not found`;
      Logger.service.error(error, { service: UsersService, errorDescription });
      throw new NotFoundException(errorDescription);
    }

    Logger.service.debug(`User "${user.id}" found`, { service: UsersService, rawData: user });

    return user;
  }

  async findOneByUsername(username: string) {
    let user: User | null;

    try {
      user = await this.usersRepository.findOneBy({ username });
    } catch (error) {
      const errorDescription = `Can't find user "${username}"`;
      Logger.service.error(error, { service: UsersService, errorDescription });
      throw error;
    }

    if (!user)
      Logger.server.debug(`User "${username}" not found`, { service: UsersService });
    else
      Logger.service.debug(`User "${user.id}" found`, { service: UsersService, rawData: user });

    return user;

  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const updateResult = await this.usersRepository.update(id, updateUserDto);

    if (updateResult.affected === 0) {
      const errorDescription = `User "${id}" not found`;
      Logger.service.error(errorDescription, { service: UsersService });
      throw new NotFoundException(errorDescription);
    }
    Logger.service.debug(`User "${id}" updated`, { service: UsersService, rawData: { updateResult } });
  }

  async remove(id: number) {
    const deleteResult = await this.usersRepository.delete(id);
    if (deleteResult.affected === 0) {
      const errorDescription = `User "${id}" not found`;
      Logger.service.error(errorDescription, { service: UsersService });
      throw new NotFoundException(errorDescription);
    }
    Logger.service.debug(`User "${id}" removed`, { service: UsersService });
  }
}
