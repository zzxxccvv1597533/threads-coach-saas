CREATE TABLE `opener_embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`opener` text NOT NULL,
	`embedding` text NOT NULL,
	`draftId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `opener_embeddings_id` PRIMARY KEY(`id`)
);
