-- Arc flash (optical) and acoustic / partial-discharge sensing.
-- ADD VALUE is additive: existing rows and the four original sensor types are untouched.

-- AlterEnum
ALTER TYPE "SensorType" ADD VALUE 'ARC_FLASH';
ALTER TYPE "SensorType" ADD VALUE 'ACOUSTIC';

-- AlterEnum
ALTER TYPE "AnomalyType" ADD VALUE 'ARC_FLASH';
ALTER TYPE "AnomalyType" ADD VALUE 'PARTIAL_DISCHARGE';
