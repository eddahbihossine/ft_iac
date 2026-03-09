import { Cookie } from "express-session";
import { User } from "src/users/entities/user.entity";

export type AppSessionBaseType =  {
    user?: Omit<User, 'todos'>;
} & Cookie;

export type AppSessionLoggedType = {
    user: User;
} & AppSessionBaseType;