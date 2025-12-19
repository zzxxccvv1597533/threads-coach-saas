CREATE TABLE `payment_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subscriptionId` int,
	`merchantOrderNo` varchar(64) NOT NULL,
	`tradeNo` varchar(64),
	`paymentType` varchar(32),
	`payTime` timestamp,
	`amount` int NOT NULL,
	`currency` varchar(3) DEFAULT 'TWD',
	`paymentStatus` enum('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
	`rawResponse` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `productId` int;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `subscriptionStatus` enum('active','cancelled','expired','pending') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `plan` enum('free','monthly','yearly') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `newebpayMerchantOrderNo` varchar(64);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `newebpayTradeNo` varchar(64);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `newebpayPaymentType` varchar(32);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `amount` int;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `currency` varchar(3) DEFAULT 'TWD';--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `nextBillingDate` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `cancelledAt` timestamp;