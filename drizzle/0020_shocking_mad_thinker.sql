CREATE TABLE `content_hooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hookPattern` text NOT NULL,
	`hookType` varchar(32),
	`applicableKeywords` json,
	`applicableContentTypes` json,
	`avgLikes` int DEFAULT 0,
	`viralRate` int DEFAULT 0,
	`sampleCount` int DEFAULT 0,
	`examples` json,
	`isActive` boolean DEFAULT true,
	`source` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_hooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `keyword_benchmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(64) NOT NULL,
	`category` varchar(64),
	`totalPosts` int DEFAULT 0,
	`avgLikes` int DEFAULT 0,
	`medianLikes` int DEFAULT 0,
	`maxLikes` int DEFAULT 0,
	`viralCount` int DEFAULT 0,
	`viralRate` int DEFAULT 0,
	`bestContentType` varchar(32),
	`bestContentTypeViralRate` int DEFAULT 0,
	`avgLength` int DEFAULT 0,
	`optimalLengthMin` int DEFAULT 0,
	`optimalLengthMax` int DEFAULT 0,
	`hasImageRate` int DEFAULT 0,
	`viralFactors` json,
	`topHooks` json,
	`dataSource` varchar(64),
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keyword_benchmarks_id` PRIMARY KEY(`id`),
	CONSTRAINT `keyword_benchmarks_keyword_unique` UNIQUE(`keyword`)
);
--> statement-breakpoint
CREATE TABLE `viral_learnings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`postId` int NOT NULL,
	`extractedHook` text,
	`extractedStructure` varchar(64),
	`contentType` varchar(32),
	`likes` int DEFAULT 0,
	`reach` int DEFAULT 0,
	`engagement` int DEFAULT 0,
	`successFactors` json,
	`learningNotes` text,
	`isIntegrated` boolean DEFAULT false,
	`integratedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `viral_learnings_id` PRIMARY KEY(`id`)
);
