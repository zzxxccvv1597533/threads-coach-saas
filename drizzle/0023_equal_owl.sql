CREATE TABLE `ai_detector_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`candidateId` int,
	`draftId` int,
	`contentSnippet` text,
	`contentLength` int,
	`overallScore` decimal(5,4) NOT NULL,
	`avoidListScore` decimal(5,4),
	`repetitionScore` decimal(5,4),
	`aiPhraseScore` decimal(5,4),
	`densityScore` decimal(5,4),
	`matchedPatterns` json,
	`suggestions` json,
	`action` enum('pass','warn','regenerate','manual_edit') DEFAULT 'pass',
	`wasModified` boolean DEFAULT false,
	`modifiedContent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_detector_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opener_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`category` enum('mirror','contrast','scene','question','data','story','emotion') DEFAULT 'mirror',
	`template` text NOT NULL,
	`description` text,
	`example` text,
	`weight` decimal(5,4) DEFAULT '1.0000',
	`usageCount` int DEFAULT 0,
	`successCount` int DEFAULT 0,
	`successRate` decimal(5,4) DEFAULT '0.0000',
	`isActive` boolean DEFAULT true,
	`isDefault` boolean DEFAULT false,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opener_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `openers_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`draftId` int,
	`templateId` int,
	`openerText` text NOT NULL,
	`fullContent` text,
	`topic` varchar(256),
	`contentType` varchar(64),
	`hookStyle` varchar(64),
	`isSelected` boolean DEFAULT false,
	`selectedAt` timestamp,
	`wasPublished` boolean DEFAULT false,
	`publishedAt` timestamp,
	`reach` int,
	`likes` int,
	`comments` int,
	`isViral` boolean DEFAULT false,
	`aiScore` decimal(5,4),
	`aiFlags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `openers_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prompt_avoid_list` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pattern` varchar(256) NOT NULL,
	`patternType` enum('opener','transition','ending','ai_phrase','filler') DEFAULT 'opener',
	`description` text,
	`replacement` text,
	`severity` enum('block','warn','suggest') DEFAULT 'warn',
	`matchCount` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`isUserDefined` boolean DEFAULT false,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prompt_avoid_list_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_event_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`eventType` varchar(64) NOT NULL,
	`eventName` varchar(128) NOT NULL,
	`metadata` json,
	`draftId` int,
	`candidateId` int,
	`templateId` int,
	`durationMs` int,
	`status` enum('success','error','warning') DEFAULT 'success',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_event_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `template_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`statDate` timestamp NOT NULL,
	`statPeriod` enum('daily','weekly','monthly') DEFAULT 'daily',
	`usageCount` int DEFAULT 0,
	`selectionCount` int DEFAULT 0,
	`selectionRate` decimal(5,4) DEFAULT '0.0000',
	`publishCount` int DEFAULT 0,
	`viralCount` int DEFAULT 0,
	`viralRate` decimal(5,4) DEFAULT '0.0000',
	`avgReach` int DEFAULT 0,
	`avgLikes` int DEFAULT 0,
	`avgComments` int DEFAULT 0,
	`calculatedWeight` decimal(5,4) DEFAULT '1.0000',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `template_stats_id` PRIMARY KEY(`id`)
);
