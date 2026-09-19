import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PanelsService } from '../panels/panels.service.js';
import { RiskEngineService } from '../risk-engine/risk-engine.service.js';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const MAX_BATCH_SIZE = 500;

interface ValidatedReading {
  sensorId: string;
  value: number;
  timestamp?: Date;
}

@Injectable()
export class ReadingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly panelsService: PanelsService,
    private readonly riskEngineService: RiskEngineService,
  ) {}

  async findByPanel(panelId: string, sensorId?: string, limit?: number) {
    await this.panelsService.ensureExists(panelId);

    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    return this.prisma.sensorReading.findMany({
      where: {
        sensor: { panelId },
        ...(sensorId ? { sensorId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take,
    });
  }

  async create(body: unknown) {
    const reading = this.validateReading(body);

    const sensor = await this.prisma.sensor.findUnique({
      where: { id: reading.sensorId },
      select: { id: true, panelId: true },
    });
    if (!sensor) {
      throw new NotFoundException(`Sensor not found: ${reading.sensorId}`);
    }

    const created = await this.prisma.sensorReading.create({
      data: {
        sensorId: reading.sensorId,
        value: reading.value,
        timestamp: reading.timestamp ?? new Date(),
      },
    });

    // Sadece bu okumadan etkilenen panoyu analiz et (Asama 4 madde 6).
    await this.riskEngineService.analyzePanels([sensor.panelId]);

    return created;
  }

  async createBatch(body: unknown) {
    if (typeof body !== 'object' || body === null || !Array.isArray((body as { readings?: unknown }).readings)) {
      throw new BadRequestException('readings must be an array');
    }

    const readings = (body as { readings: unknown[] }).readings;

    if (readings.length === 0) {
      throw new BadRequestException('readings must not be empty');
    }
    if (readings.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(`readings exceeds maximum batch size of ${MAX_BATCH_SIZE}`);
    }

    const validated = readings.map((reading, index) => this.validateReading(reading, index));

    const sensorIds = [...new Set(validated.map((reading) => reading.sensorId))];
    const existingSensors = await this.prisma.sensor.findMany({
      where: { id: { in: sensorIds } },
      select: { id: true, panelId: true },
    });
    const existingIds = new Set(existingSensors.map((sensor) => sensor.id));
    const missingIds = sensorIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      throw new NotFoundException(`Sensor(s) not found: ${missingIds.join(', ')}`);
    }

    const result = await this.prisma.sensorReading.createMany({
      data: validated.map((reading) => ({
        sensorId: reading.sensorId,
        value: reading.value,
        timestamp: reading.timestamp ?? new Date(),
      })),
    });

    // Tum DB'yi degil, yalnizca bu batch'ten etkilenen panolari analiz et
    // (Asama 4 madde 6).
    const affectedPanelIds = [...new Set(existingSensors.map((sensor) => sensor.panelId))];
    await this.riskEngineService.analyzePanels(affectedPanelIds);

    return { inserted: result.count };
  }

  private validateReading(input: unknown, index?: number): ValidatedReading {
    const prefix = index !== undefined ? `readings[${index}]: ` : '';

    if (typeof input !== 'object' || input === null) {
      throw new BadRequestException(`${prefix}reading must be an object`);
    }

    const { sensorId, value, timestamp } = input as Record<string, unknown>;

    if (typeof sensorId !== 'string' || sensorId.trim().length === 0) {
      throw new BadRequestException(`${prefix}sensorId is required and must be a non-empty string`);
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`${prefix}value must be a finite number`);
    }

    let parsedTimestamp: Date | undefined;
    if (timestamp !== undefined) {
      if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
        throw new BadRequestException(`${prefix}timestamp must be a valid ISO 8601 date string`);
      }
      parsedTimestamp = new Date(timestamp);
    }

    return { sensorId, value, timestamp: parsedTimestamp };
  }
}
