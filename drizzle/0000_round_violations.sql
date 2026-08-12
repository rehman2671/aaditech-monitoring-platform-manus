CREATE TABLE `alert_rules` (
	`id` varchar(64) NOT NULL,
	`organizationId` varchar(64) NOT NULL,
	`name` text NOT NULL,
	`metric` varchar(64) NOT NULL,
	`condition` varchar(16) NOT NULL,
	`thresholdValue` decimal(10,2) NOT NULL,
	`severity` enum('warning','critical') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`durationMinutes` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `endpoints` (
	`id` varchar(64) NOT NULL,
	`organizationId` varchar(64) NOT NULL,
	`hostname` varchar(255) NOT NULL,
	`serialNumber` varchar(128) NOT NULL,
	`osVersion` varchar(128),
	`osBuild` varchar(64),
	`domainOrWorkgroup` varchar(128),
	`agentVersion` varchar(64),
	`status` enum('pending','online','offline','disabled') NOT NULL DEFAULT 'online',
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `endpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrollment_tokens` (
	`id` varchar(64) NOT NULL,
	`organizationId` varchar(64) NOT NULL,
	`tokenHash` text NOT NULL,
	`plainToken` text,
	`expiresAt` timestamp NOT NULL,
	`usedByEndpointId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrollment_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` varchar(64) NOT NULL,
	`name` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_alerts` (
	`id` varchar(64) NOT NULL,
	`organizationId` varchar(64) NOT NULL,
	`endpointId` varchar(64) NOT NULL,
	`hostname` varchar(255) NOT NULL,
	`ruleName` text NOT NULL,
	`severity` enum('warning','critical') NOT NULL,
	`message` text NOT NULL,
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	`acknowledged` boolean NOT NULL DEFAULT false,
	CONSTRAINT `system_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
