ALTER TABLE `user_growth_metrics` ADD `avgEngagementRate` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_growth_metrics` ADD `postFrequency` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_growth_metrics` ADD `totalPosts` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_growth_metrics` ADD `hasProduct` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_growth_metrics` ADD `manualStage` enum('startup','growth','monetize','scale');