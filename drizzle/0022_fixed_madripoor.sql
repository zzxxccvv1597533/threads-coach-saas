CREATE TABLE `content_clusters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clusterId` int NOT NULL,
	`themeKeywords` varchar(256),
	`postsCount` int DEFAULT 0,
	`top10Rate` decimal(5,4),
	`medianLikes` int DEFAULT 0,
	`medianLpd` decimal(10,2),
	`topTerms` text,
	`tofuShare` decimal(5,4),
	`mofuShare` decimal(5,4),
	`bofuShare` decimal(5,4),
	`source` varchar(64) DEFAULT 'excel_import',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_clusters_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_clusters_clusterId_unique` UNIQUE(`clusterId`)
);
--> statement-breakpoint
CREATE TABLE `topic_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cluster` int,
	`theme` varchar(128),
	`template` text NOT NULL,
	`usageCount` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`source` varchar(64) DEFAULT 'excel_import',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topic_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `viral_examples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(64) NOT NULL,
	`postText` text NOT NULL,
	`likes` int DEFAULT 0,
	`likesPerDay` decimal(10,2),
	`postDate` timestamp,
	`account` varchar(64),
	`threadUrl` varchar(256),
	`funnelStage` varchar(16),
	`cluster` int,
	`opener50` varchar(200),
	`charLen` int,
	`hasNumber` boolean DEFAULT false,
	`questionMark` boolean DEFAULT false,
	`exclaimMark` boolean DEFAULT false,
	`youFlag` boolean DEFAULT false,
	`iFlag` boolean DEFAULT false,
	`ctaFlag` boolean DEFAULT false,
	`timePressureFlag` boolean DEFAULT false,
	`resultFlag` boolean DEFAULT false,
	`turnFlag` boolean DEFAULT false,
	`isTop200` boolean DEFAULT false,
	`isTop20` boolean DEFAULT false,
	`source` varchar(64) DEFAULT 'excel_import',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `viral_examples_id` PRIMARY KEY(`id`)
);
