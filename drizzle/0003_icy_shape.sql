CREATE TABLE `conversation_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`summaryType` enum('writing_preference','content_success','modification_pattern','topic_interest','style_feedback') NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`relevanceScore` int DEFAULT 100,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversation_summaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `success_stories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(120),
	`clientBackground` text,
	`challenge` text,
	`transformation` text,
	`outcome` text,
	`testimonialQuote` text,
	`isPublic` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `success_stories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_growth_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`followerCount` int DEFAULT 0,
	`avgReach` int DEFAULT 0,
	`avgEngagement` int DEFAULT 0,
	`hasProfileSetup` boolean DEFAULT false,
	`hasLineLink` boolean DEFAULT false,
	`firstSaleAt` timestamp,
	`totalSales` int DEFAULT 0,
	`currentStage` enum('startup','growth','monetize','scale') DEFAULT 'startup',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_growth_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userProductType` enum('lead','core','vip','passive') NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`priceRange` varchar(50),
	`deliveryTime` varchar(50),
	`uniqueValue` text,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_products_id` PRIMARY KEY(`id`)
);
