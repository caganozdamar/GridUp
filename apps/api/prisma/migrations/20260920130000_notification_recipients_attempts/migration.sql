-- DropIndex
DROP INDEX "notifications_alarmId_channel_key";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_alarmId_channel_recipient_key" ON "notifications"("alarmId", "channel", "recipient");
