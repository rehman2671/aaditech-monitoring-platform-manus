CREATE TABLE `department_catalog` (
	`id` varchar(64) NOT NULL,
	`organizationId` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `department_catalog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `location_catalog` (
	`id` varchar(64) NOT NULL,
	`organizationId` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `location_catalog_id` PRIMARY KEY(`id`)
);
