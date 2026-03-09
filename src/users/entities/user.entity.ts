import { Todo } from "../../todos/entities/todo.entity";
import { PrimaryGeneratedColumn, Column, Entity, OneToMany } from "typeorm";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    username: string;

    @OneToMany(() => Todo, todo => todo.user)
    todos: Todo[];
}
