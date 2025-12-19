CREATE TABLE `invitation_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`createdBy` int NOT NULL,
	`usedBy` int,
	`usedAt` timestamp,
	`validDays` int NOT NULL DEFAULT 90,
	`note` text,
	`status` enum('active','used','expired','revoked') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invitation_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitation_codes_code_unique` UNIQUE(`code`)
);
