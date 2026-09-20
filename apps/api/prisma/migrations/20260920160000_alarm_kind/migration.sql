-- CreateEnum
CREATE TYPE "AlarmKind" AS ENUM ('RISK', 'MODULE_OFFLINE');

-- AlterTable
ALTER TABLE "alarms" ADD COLUMN     "kind" "AlarmKind" NOT NULL DEFAULT 'RISK';
