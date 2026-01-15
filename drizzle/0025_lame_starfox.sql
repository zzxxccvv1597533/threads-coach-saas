CREATE TABLE `user_template_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`templateCategory` varchar(64) NOT NULL,
	`preferenceScore` decimal(5,4) DEFAULT '0.5',
	`totalShown` int DEFAULT 0,
	`totalSelected` int DEFAULT 0,
	`totalPublished` int DEFAULT 0,
	`totalViral` int DEFAULT 0,
	`avgReach` int DEFAULT 0,
	`avgEngagement` int DEFAULT 0,
	`lastSelectedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_template_preferences_id` PRIMARY KEY(`id`)
);
