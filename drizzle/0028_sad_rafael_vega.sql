CREATE TABLE `viral_clusters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clusterId` int NOT NULL,
	`centroid` text NOT NULL,
	`size` int NOT NULL,
	`topKeywords` text,
	`avgLikes` int,
	`avgCharLen` int,
	`dominantContentType` varchar(32),
	`formulaName` varchar(128),
	`formulaDescription` text,
	`formulaExample` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `viral_clusters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `viral_example_cluster_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`viralExampleId` int NOT NULL,
	`clusterId` int NOT NULL,
	`distance` decimal(10,6),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `viral_example_cluster_mappings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `viral_example_embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`viralExampleId` int NOT NULL,
	`embedding` text NOT NULL,
	`contentType` varchar(32),
	`keyword` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `viral_example_embeddings_id` PRIMARY KEY(`id`)
);
