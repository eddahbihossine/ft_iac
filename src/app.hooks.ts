import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import Logger from "./libs/logger";
import { UsersService } from "./users/users.service";

// NOTE : this file contains App module hooks

type BoostrapDependencies = {
    configService: ConfigService;
    usersService: UsersService;
    db: DataSource;
};

/**
 * This function is called when app module is bootstrapped,
 * it is used to execute some code after the app module is bootstrapped
 */
export async function appModuleBootstrap(dependencies: BoostrapDependencies) {
    Logger.server.verbose("Bootstraping application");
    if (dependencies.configService.get<boolean>("DB_INIT_SYNC", false)) {
        await initDatabase(dependencies);
    }
}

/**
 * Check if can read to database, if not, create the database with TypeORM sync
 */
async function initDatabase(dependencies: BoostrapDependencies) {
  Logger.server.verbose("Check if database tables are already created");

  try {
        await dependencies.usersService.findAll();
        Logger.server.debug("Database tables are already created");
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
        Logger.server.warn("Database tables are not created, database synchronization");
        await dependencies.db.synchronize();
    } else {
      const errorDescription = "Check if database tables failed";
        Logger.server.error(error, { errorDescription });
        throw new Error(errorDescription);
    }
  }
}
