-- CreateEnum
CREATE TYPE "PanelStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('TEMPERATURE_RISE', 'HIGH_TEMPERATURE', 'HIGH_HUMIDITY', 'OVERCURRENT', 'MULTI_SENSOR_RISK');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlarmStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- DropForeignKey
ALTER TABLE "sensor_readings" DROP CONSTRAINT "sensor_readings_panelId_fkey";

-- DropIndex
DROP INDEX "risk_scores_panelId_createdAt_idx";

-- DropIndex
DROP INDEX "sensor_readings_panelId_sensorType_recordedAt_idx";

-- AlterTable
ALTER TABLE "sensor_readings" DROP COLUMN "panelId",
DROP COLUMN "recordedAt",
DROP COLUMN "sensorType",
DROP COLUMN "unit",
ADD COLUMN     "sensorId" TEXT NOT NULL,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "panels" DROP COLUMN "location",
DROP COLUMN "type",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "siteId" TEXT NOT NULL,
ADD COLUMN     "status" "PanelStatus" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropEnum
DROP TYPE "PanelType";

-- DropEnum
DROP TYPE "SensorType";

-- CreateEnum
CREATE TYPE "SensorType" AS ENUM ('AMBIENT_TEMPERATURE', 'CABLE_TEMPERATURE', 'HUMIDITY', 'CURRENT');

-- AlterTable
ALTER TABLE "alarms" DROP COLUMN "riskLevel",
DROP COLUMN "riskScore",
ADD COLUMN     "anomalyId" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "severity" "Severity" NOT NULL,
ADD COLUMN     "status" "AlarmStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "risk_scores" DROP COLUMN "createdAt",
ADD COLUMN     "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SensorType" NOT NULL,
    "unit" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomalies" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "sensorId" TEXT,
    "type" "AnomalyType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "message" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sensors_code_key" ON "sensors"("code");

-- CreateIndex
CREATE INDEX "sensors_panelId_idx" ON "sensors"("panelId");

-- CreateIndex
CREATE INDEX "anomalies_panelId_detectedAt_idx" ON "anomalies"("panelId", "detectedAt");

-- CreateIndex
CREATE INDEX "anomalies_sensorId_idx" ON "anomalies"("sensorId");

-- CreateIndex
CREATE INDEX "alarms_anomalyId_idx" ON "alarms"("anomalyId");

-- CreateIndex
CREATE UNIQUE INDEX "panels_code_key" ON "panels"("code");

-- CreateIndex
CREATE INDEX "panels_siteId_idx" ON "panels"("siteId");

-- CreateIndex
CREATE INDEX "risk_scores_panelId_calculatedAt_idx" ON "risk_scores"("panelId", "calculatedAt");

-- CreateIndex
CREATE INDEX "sensor_readings_timestamp_idx" ON "sensor_readings"("timestamp");

-- CreateIndex
CREATE INDEX "sensor_readings_sensorId_timestamp_idx" ON "sensor_readings"("sensorId", "timestamp");

-- AddForeignKey
ALTER TABLE "panels" ADD CONSTRAINT "panels_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "panels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_anomalyId_fkey" FOREIGN KEY ("anomalyId") REFERENCES "anomalies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
