CREATE TABLE `global_viral_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleCategory` enum('topic','angle','content_type','presentation','hook','length','emotion') NOT NULL,
	`ruleName` varchar(128) NOT NULL,
	`ruleDescription` text,
	`ruleCondition` text,
	`ruleAction` text,
	`supportingIpCount` int DEFAULT 0,
	`totalViralCount` int DEFAULT 0,
	`avgViralRate` decimal(5,4),
	`weight` decimal(5,4) DEFAULT '1.0000',
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `global_viral_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ip_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountName` varchar(128) NOT NULL,
	`accountHandle` varchar(64),
	`primaryCategory` varchar(64),
	`subCategory` varchar(64),
	`totalPosts` int DEFAULT 0,
	`viralPosts` int DEFAULT 0,
	`viralRate` decimal(5,4),
	`avgLikes` int DEFAULT 0,
	`avgCharLen` int DEFAULT 0,
	`styleType` varchar(64),
	`contentMix` json,
	`growthRate` decimal(10,2),
	`earlyAvgLikes` int DEFAULT 0,
	`recentAvgLikes` int DEFAULT 0,
	`sourceFile` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ip_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ip_post_embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`accountId` int NOT NULL,
	`embedding` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ip_post_embeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ip_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`postText` text NOT NULL,
	`opener50` varchar(200),
	`charLen` int,
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`shares` int DEFAULT 0,
	`reach` int DEFAULT 0,
	`postDate` timestamp,
	`postUrl` varchar(256),
	`contentType` varchar(32),
	`hookType` varchar(32),
	`isViral` boolean DEFAULT false,
	`isSuperViral` boolean DEFAULT false,
	`hasNumber` boolean DEFAULT false,
	`hasQuestion` boolean DEFAULT false,
	`hasExclaim` boolean DEFAULT false,
	`startsWithI` boolean DEFAULT false,
	`startsWithYou` boolean DEFAULT false,
	`sourceFile` varchar(128),
	`rowIndex` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ip_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ip_success_factors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`analysisType` enum('topic','angle','content_type','presentation') NOT NULL,
	`factorName` varchar(128) NOT NULL,
	`factorDescription` text,
	`viralCount` int DEFAULT 0,
	`totalCount` int DEFAULT 0,
	`viralRate` decimal(5,4),
	`avgLikes` int DEFAULT 0,
	`examples` json,
	`weight` decimal(5,4) DEFAULT '1.0000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ip_success_factors_id` PRIMARY KEY(`id`)
);
