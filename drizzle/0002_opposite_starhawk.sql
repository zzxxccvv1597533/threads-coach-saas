ALTER TABLE `users` ADD `activationStatus` enum('pending','activated','expired') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `activatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `activatedBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `activationNote` text;