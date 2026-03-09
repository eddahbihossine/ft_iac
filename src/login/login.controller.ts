import { Body, Controller, Get, InternalServerErrorException, Post, Render, Res, Session } from '@nestjs/common';
import { Response } from 'express';
import { AppSessionBaseType } from 'src/libs/data-structures/app-session.type';
import Logger from '../libs/logger';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from '../users/users.service';

@Controller('login')
export class LoginController {
    constructor(private readonly usersService: UsersService) { }

    /**
     * Page : display the login form
     */
    @Get()
    @Render('login-form')
    async loginFormPage() {
        Logger.controller.verbose(`Login page`, { controller: LoginController });

        return;
    }

    /**
     * Form processing : login user by storing the user in the session.
     * If the user is not found, create a new user. Then, redirect to the todos page.
     */
    @Post()
    async loginFormProcessing(@Body('username') username: string, @Session() session: AppSessionBaseType, @Res() res: Response) {
        Logger.controller.verbose(`Login form processing`, { controller: LoginController });

        let user: User | null;

        try {
            user = await this.usersService.findOneByUsername(username);
        }
        catch (error) {
            const errorDescription = `Can't find user "${username}"`;
            Logger.controller.error(error, { controller: LoginController, errorDescription });
            throw new InternalServerErrorException(errorDescription);
        }

        if (!user) {
            try {
                const newUserId: number = await this.usersService.create({ username });
                user = await this.usersService.findOne(newUserId);
            } catch (error) {
                const errorDescription = `Can't create new user "${username}"`;
                Logger.controller.error(error, { controller: LoginController, errorDescription });
                throw new InternalServerErrorException(errorDescription);
            }
        }

        Logger.controller.debug(`User "${user.id}" found`, { controller: LoginController, rawData: user });

        session.user = user;

        return res.redirect(`/todos/${user.id}`);
    }
}
