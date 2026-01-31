CREATE TABLE `topic_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topicText` text NOT NULL,
	`topicSource` enum('pain_matrix','ip_data','viral_db','user_input','brainstorm') DEFAULT 'pain_matrix',
	`audience` varchar(128),
	`subTopic` varchar(128),
	`painPoint` varchar(256),
	`topicStatus` enum('generated','selected','used','skipped') DEFAULT 'generated',
	`draftId` int,
	`selectedAt` timestamp,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topic_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `writing_session_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`draftId` int,
	`questionType` varchar(64),
	`questions` json,
	`userIdea` text,
	`topicHistoryId` int,
	`selectedContentType` varchar(64),
	`sessionStatus` enum('in_progress','completed','abandoned') DEFAULT 'in_progress',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `writing_session_questions_id` PRIMARY KEY(`id`)
);
