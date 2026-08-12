CREATE TABLE `app_usage_telemetry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`endpointId` varchar(64) NOT NULL,
	`appName` varchar(255) NOT NULL,
	`activeSeconds` int NOT NULL,
	`cpuTimeSeconds` int NOT NULL,
	`networkBytes` decimal(15,0),
	`launchCount` int NOT NULL,
	`lastUsedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_usage_telemetry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `battery_telemetry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`endpointId` varchar(64) NOT NULL,
	`chargePercent` int NOT NULL,
	`healthPercent` int NOT NULL,
	`chargingStatus` varchar(32) NOT NULL,
	`designCapacityMah` int,
	`fullChargeCapacityMah` int,
	`cycleCount` int,
	`temperatureCelsius` decimal(5,2),
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `battery_telemetry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `endpoint_metadata` (
	`endpointId` varchar(64) NOT NULL,
	`department` varchar(128),
	`location` varchar(128),
	`assignedUser` varchar(255),
	`assetId` varchar(128),
	`ownership` enum('company_owned','employee_owned','leased') NOT NULL DEFAULT 'company_owned',
	`tags` text,
	`maintenanceMode` boolean NOT NULL DEFAULT false,
	CONSTRAINT `endpoint_metadata_endpointId` PRIMARY KEY(`endpointId`)
);
--> statement-breakpoint
CREATE TABLE `network_telemetry` (
	`id` int AUTO_INCREMENT NOT NULL,
	`endpointId` varchar(64) NOT NULL,
	`ipAddress` varchar(64),
	`macAddress` varchar(64),
	`gateway` varchar(64),
	`ssid` varchar(128),
	`signalStrengthPercent` int,
	`downloadBps` decimal(15,2),
	`uploadBps` decimal(15,2),
	`latencyMs` decimal(8,2),
	`vpnActive` boolean NOT NULL DEFAULT false,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `network_telemetry_id` PRIMARY KEY(`id`)
);
