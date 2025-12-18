CREATE TABLE `api_usage_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` varchar(80),
	`model` varchar(80),
	`tokensIn` int DEFAULT 0,
	`tokensOut` int DEFAULT 0,
	`costEstimate` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_usage_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audience_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`segmentName` varchar(80),
	`painPoint` text,
	`desiredOutcome` text,
	`priority` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audience_segments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(80),
	`targetType` varchar(50),
	`targetId` int,
	`meta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_pillars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(120),
	`description` text,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_pillars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant','system') DEFAULT 'user',
	`content` text,
	`meta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mode` enum('onboarding','writing','optimize','report') DEFAULT 'writing',
	`state` varchar(50),
	`title` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `draft_hooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draftPostId` int NOT NULL,
	`hookStyle` enum('mirror','contrast','scene','question','data') DEFAULT 'mirror',
	`hookText` text,
	`isSelected` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `draft_hooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `draft_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contentType` enum('knowledge','summary','story','viewpoint','contrast','casual','dialogue','question','poll','quote') DEFAULT 'story',
	`title` varchar(120),
	`body` text,
	`cta` text,
	`status` enum('draft','published','archived') DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `draft_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `draft_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draftPostId` int NOT NULL,
	`version` int NOT NULL,
	`body` text,
	`cta` text,
	`changeNote` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `draft_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interaction_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskType` enum('reply_comments','comment_others','sea_patrol') DEFAULT 'reply_comments',
	`taskDetail` text,
	`dueDate` timestamp,
	`taskStatus` enum('todo','done','skipped') DEFAULT 'todo',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interaction_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ip_profile_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipProfileId` int NOT NULL,
	`version` int NOT NULL,
	`snapshotJson` json,
	`note` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ip_profile_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ip_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`occupation` varchar(120),
	`voiceTone` varchar(120),
	`viewpointStatement` text,
	`goalPrimary` enum('monetize','influence','expression') DEFAULT 'monetize',
	`personaExpertise` text,
	`personaEmotion` text,
	`personaViewpoint` text,
	`ipAnalysisComplete` boolean DEFAULT false,
	`currentVersion` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ip_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kb_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200),
	`version` varchar(50),
	`sourceUri` text,
	`content` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kb_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `optimization_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`draftPostId` int,
	`inputText` text,
	`outputA` text,
	`outputB` text,
	`feedbackJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `optimization_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`priceAmount` int DEFAULT 0,
	`quantity` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`orderStatus` enum('pending','paid','failed','refunded') DEFAULT 'pending',
	`currency` varchar(10) DEFAULT 'TWD',
	`subtotalAmount` int DEFAULT 0,
	`discountAmount` int DEFAULT 0,
	`totalAmount` int DEFAULT 0,
	`paymentProvider` varchar(30),
	`providerRef` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`capturedAt` timestamp,
	`reach` int DEFAULT 0,
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`reposts` int DEFAULT 0,
	`saves` int DEFAULT 0,
	`profileVisits` int DEFAULT 0,
	`linkClicks` int DEFAULT 0,
	`inquiries` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`draftPostId` int,
	`threadUrl` text,
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(50),
	`name` varchar(120),
	`description` text,
	`productType` enum('lead','core','vip','passive') DEFAULT 'core',
	`deliveryType` enum('digital','service','community') DEFAULT 'digital',
	`price` int DEFAULT 0,
	`currency` varchar(10) DEFAULT 'TWD',
	`billingType` enum('one_time','subscription') DEFAULT 'one_time',
	`billingInterval` enum('month','year'),
	`productStatus` enum('active','inactive') DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80),
	`version` int DEFAULT 1,
	`template` text,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prompt_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `raw_materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`conversationId` int,
	`sourceType` enum('event','dialogue','insight') DEFAULT 'event',
	`content` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `raw_materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`subscriptionStatus` enum('active','canceled','past_due') DEFAULT 'active',
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`providerRef` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`timezone` varchar(50) DEFAULT 'Asia/Taipei',
	`locale` varchar(10) DEFAULT 'zh-TW',
	`marketingOptIn` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','suspended') DEFAULT 'active' NOT NULL;