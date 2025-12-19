ALTER TABLE `users` MODIFY COLUMN `activationStatus` enum('pending','activated','expired','rejected') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `users` ADD `rejectedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `rejectedBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `rejectionReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `invitationCodeId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `invitationBonusDays` int;