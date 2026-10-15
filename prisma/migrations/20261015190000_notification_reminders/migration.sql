ALTER TABLE "Notification" ADD COLUMN "deliverAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Notification_userId_deliverAt_idx" ON "Notification"("userId", "deliverAt");
