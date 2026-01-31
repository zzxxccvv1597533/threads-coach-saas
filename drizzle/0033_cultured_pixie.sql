CREATE TABLE `strategy_weights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dimension` enum('hook_style','content_type','prompt_mode','opener_pattern') NOT NULL,
	`value` varchar(64) NOT NULL,
	`weight` decimal(5,4) DEFAULT '1.0000',
	`sampleCount` int DEFAULT 0,
	`avgReach` decimal(10,2),
	`avgEngagement` decimal(10,2),
	`lastCalculatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategy_weights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_growth_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stage` enum('new','growing','mature') NOT NULL DEFAULT 'new',
	`totalPosts` int DEFAULT 0,
	`totalDrafts` int DEFAULT 0,
	`adoptionRate` decimal(5,4),
	`selfEditRate` decimal(5,4),
	`avgAiScore` decimal(5,4),
	`preferredHookStyles` json,
	`preferredContentTypes` json,
	`deletedPhrasePatterns` json,
	`keptPhrasePatterns` json,
	`humanizerStrictness` enum('strict','moderate','relaxed') DEFAULT 'strict',
	`lastCalculatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_growth_stages_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_growth_stages_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_interaction_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` enum('hook_selected','hook_rejected','draft_accepted','draft_modified','draft_rejected','suggestion_adopted','suggestion_ignored','content_published','content_deleted','style_preference','phrase_deleted','phrase_kept') NOT NULL,
	`draftId` int,
	`hookId` int,
	`suggestionId` int,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_interaction_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_post_embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`draftId` int,
	`content` text NOT NULL,
	`hook` text,
	`embedding` json,
	`contentType` varchar(64),
	`postMetrics` json,
	`generationConfig` json,
	`isPublished` boolean DEFAULT false,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_post_embeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `viral_embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`content` text NOT NULL,
	`hook` text,
	`contentType` varchar(64),
	`embedding` json,
	`source` varchar(255),
	`metrics` json,
	`tags` json,
	`cluster` varchar(64),
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `viral_embeddings_id` PRIMARY KEY(`id`)
);
