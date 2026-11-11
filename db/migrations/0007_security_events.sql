CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`kind` text NOT NULL,
	`client` text,
	`device` text,
	`ip` text,
	`user_agent` text,
	`detail` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `security_events_at_idx` ON `security_events` (`at`);