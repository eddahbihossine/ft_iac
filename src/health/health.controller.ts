import { Controller, Get, HttpException, InternalServerErrorException, ServiceUnavailableException } from "@nestjs/common";
import Logger from "../libs/logger";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

    @Get("readiness")
    async getReadiness() {
        Logger.controller.verbose("Get readiness", { controller: HealthController });

        try {
            await this.healthService.getReadiness();
        } catch (error) {
            const errorDescription = "Readiness check failed";
            Logger.controller.error(error, { controller: HealthController, errorDescription });
            throw new ServiceUnavailableException(errorDescription);
        }

        return "OK";
    }

    @Get("liveness")
    async getLiveness() {
        Logger.controller.verbose("Get liveness", { controller: HealthController });

        try {
            await this.healthService.getLiveness();
        } catch (error) {
            const errorDescription = "Liveness check failed";
            Logger.controller.error(error, { controller: HealthController, errorDescription });
            throw new InternalServerErrorException(errorDescription);
        }

        return "OK";
    }
}

