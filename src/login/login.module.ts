import { Module } from '@nestjs/common';
import { LoginController } from './login.controller';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [LoginController]
})
export class LoginModule {}
