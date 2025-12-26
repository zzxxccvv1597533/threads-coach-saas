ALTER TABLE `ip_profiles` ADD `aiStrategySummary` text;--> statement-breakpoint
ALTER TABLE `ip_profiles` ADD `aiStrategyUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `ip_profiles` ADD `bestPerformingType` varchar(50);--> statement-breakpoint
ALTER TABLE `ip_profiles` ADD `bestPostingTime` varchar(20);--> statement-breakpoint
ALTER TABLE `ip_profiles` ADD `viralPatterns` text;