ALTER TABLE `post_metrics` ADD `postingTime` varchar(10);--> statement-breakpoint
ALTER TABLE `post_metrics` ADD `topComment` text;--> statement-breakpoint
ALTER TABLE `post_metrics` ADD `selfReflection` text;--> statement-breakpoint
ALTER TABLE `post_metrics` ADD `aiInsight` text;--> statement-breakpoint
ALTER TABLE `post_metrics` ADD `performanceLevel` enum('hit','normal','low');