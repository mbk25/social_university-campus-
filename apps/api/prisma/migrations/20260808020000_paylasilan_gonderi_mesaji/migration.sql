ALTER TABLE "Message" ADD COLUMN "sharedPostId" TEXT;
CREATE INDEX "Message_sharedPostId_idx" ON "Message"("sharedPostId");
ALTER TABLE "Message" ADD CONSTRAINT "Message_sharedPostId_fkey"
  FOREIGN KEY ("sharedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
