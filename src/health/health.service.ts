import { Injectable } from "@nestjs/common";
import {
    DiskHealthIndicator,
    HealthCheckService,
    TypeOrmHealthIndicator
} from "@nestjs/terminus";
import Logger from "../libs/logger";

@Injectable()
export class HealthService {
    constructor(
        private readonly health: HealthCheckService,
        private readonly db: TypeOrmHealthIndicator,
        private readonly disk: DiskHealthIndicator
    ) {}

    async getReadiness() {
        Logger.service.verbose("Check readiness", { service: HealthService });

        return this.health.check([
            // Check if the database is up
            () => this.db.pingCheck("database", { timeout: 3000 }),
            // Check if disk volume used is more than 80%
            () => this.disk.checkStorage("disk", { thresholdPercent: 0.8, path: "/" })
        ]);
    }

    async getLiveness() {
        Logger.service.verbose("Check liveness", { service: HealthService });

        return this.health.check([]);
    }
}
