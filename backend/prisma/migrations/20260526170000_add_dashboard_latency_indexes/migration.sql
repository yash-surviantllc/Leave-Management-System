CREATE INDEX "notifications_userId_category_createdAt_idx"
ON "notifications"("userId", "category", "createdAt");

CREATE INDEX "announcements_isPublished_publishedAt_idx"
ON "announcements"("isPublished", "publishedAt");
