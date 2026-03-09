import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  DiskHealthIndicator,
} from "@nestjs/terminus";

describe("HealthController", () => {
  let healthController: HealthController;
  let healthService: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        // Fournissez des simulacres pour les dépendances manquantes
        { provide: HealthCheckService, useValue: {} },
        { provide: TypeOrmHealthIndicator, useValue: {} },
        { provide: DiskHealthIndicator, useValue: {} },
      ],
    }).compile();

    healthService = module.get<HealthService>(HealthService);
    healthController = module.get<HealthController>(HealthController);
  });

  it("should be defined", () => {
    expect(healthController).toBeDefined();
  });

  describe("getReadiness", () => {
    it('should return "OK" when the service does not throw an error', async () => {
      jest
        .spyOn(healthService, "getReadiness")
        // @ts-ignore
        .mockImplementation(() => Promise.resolve());

      expect(await healthController.getReadiness()).toBe("OK");
    });

    it("should throw a ServiceUnavailableException when the service throws an error", async () => {
      jest
        .spyOn(healthService, "getReadiness")
        .mockImplementation(() => Promise.reject(new Error("Service error")));

      await expect(healthController.getReadiness()).rejects.toThrowError(
        "Readiness check failed"
      );
    });
  });

  describe("getLiveness", () => {
    it('should return "OK" when the service does not throw an error', async () => {
      jest
        .spyOn(healthService, "getLiveness")
        // @ts-ignore
        .mockImplementation(() => Promise.resolve());

      expect(await healthController.getLiveness()).toBe("OK");
    });

    it("should throw a InternalServerErrorException when the service throws an error", async () => {
      jest
        .spyOn(healthService, "getLiveness")
        .mockImplementation(() => Promise.reject(new Error("Service error")));

      await expect(healthController.getLiveness()).rejects.toThrowError(
        "Liveness check failed"
      );
    });
  });
});
