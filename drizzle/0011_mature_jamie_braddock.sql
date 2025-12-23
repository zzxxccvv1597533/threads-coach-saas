CREATE TABLE `user_writing_styles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`toneStyle` varchar(50),
	`commonPhrases` json,
	`catchphrases` json,
	`hookStylePreference` varchar(50),
	`metaphorStyle` varchar(50),
	`emotionRhythm` varchar(50),
	`viralElements` json,
	`samplePosts` json,
	`analysisStatus` enum('pending','analyzing','completed','failed') DEFAULT 'pending',
	`lastAnalyzedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_writing_styles_id` PRIMARY KEY(`id`)
);
