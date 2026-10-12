CREATE TABLE `focus_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`mission_id` text,
	`area_id` text,
	`started_at` text NOT NULL,
	`ended_at` text,
	`planned_min` integer NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
ALTER TABLE `areas` ADD `color` text;--> statement-breakpoint
ALTER TABLE `areas` ADD `icon` text;--> statement-breakpoint
ALTER TABLE `goals` ADD `target_points` integer;--> statement-breakpoint
ALTER TABLE `missions` ADD `planned_start` text;