CREATE TABLE `endpoint_metadata_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` varchar(64) NOT NULL,
	`endpointId` varchar(64) NOT NULL,
	`actorOpenId` varchar(255) NOT NULL,
	`action` varchar(64) NOT NULL,
	`changedFields` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `endpoint_metadata_audit_id` PRIMARY KEY(`id`)
);
