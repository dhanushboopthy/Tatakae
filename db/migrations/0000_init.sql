CREATE TABLE `anchors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`weekdays` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'applied' NOT NULL,
	`applied_on` text,
	`url` text,
	`source` text,
	`next_step` text,
	`next_step_on` text,
	`notes` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `areas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`standard` text,
	`why` text,
	`alignment_score` integer,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `changes` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tbl` text NOT NULL,
	`pk` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `days` (
	`date` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'normal' NOT NULL,
	`screen_min` integer,
	`small_win` text,
	`q_p1` text,
	`q_drift` text,
	`q_practised` text,
	`intention` text,
	`energy` integer,
	`forged_at` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`hypothesis` text NOT NULL,
	`change` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`result` text,
	`decision` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`note_id` text,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`area_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`intent` text,
	`outcome` text,
	`nice_goal` text,
	`next_action` text,
	`why` text,
	`hell_yeah` integer DEFAULT false NOT NULL,
	`start` text,
	`end` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `habit_logs` (
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`done` integer NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	PRIMARY KEY(`habit_id`, `date`)
);
--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`anchor` text,
	`behaviour` text NOT NULL,
	`minimum` text,
	`frequency` text DEFAULT 'daily' NOT NULL,
	`area_id` text,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `inbox` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`processed` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `japanese_log` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`minutes` integer NOT NULL,
	`kind` text NOT NULL,
	`note` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job` text NOT NULL,
	`started_at` text NOT NULL,
	`ok` integer NOT NULL,
	`detail` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `missions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`day_date` text,
	`slot` text NOT NULL,
	`points` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`minimum` text,
	`if_then` text,
	`resume_note` text,
	`goal_id` text,
	`est_min` integer,
	`actual_min` integer,
	`reschedule_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `mura_events` (
	`id` text PRIMARY KEY NOT NULL,
	`mission_id` text NOT NULL,
	`reason` text NOT NULL,
	`at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text,
	`status` text,
	`tags` text,
	`area_id` text,
	`goal_id` text,
	`source_url` text,
	`body_json` text,
	`can_explain` integer,
	`can_implement` integer,
	`misunderstood` text,
	`published_url` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`device` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `recharge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`wins` text,
	`failed` text,
	`why` text,
	`muri` text,
	`mura` text,
	`muda` text,
	`diagnosis` text,
	`bottleneck` text,
	`capacity` integer,
	`burnout` integer,
	`capability` integer,
	`theme` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`client` text NOT NULL,
	`device_name` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`editable_from` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`situation` text,
	`task` text,
	`action` text,
	`result` text,
	`tags` text,
	`goal_id` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `story_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`medium` text NOT NULL,
	`character` text,
	`lesson` text NOT NULL,
	`moment` text NOT NULL,
	`your_line` text,
	`muted` integer DEFAULT false NOT NULL,
	`last_shown_at` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `stuck_events` (
	`id` text PRIMARY KEY NOT NULL,
	`mission_id` text NOT NULL,
	`blocker` text NOT NULL,
	`unblocker` text,
	`at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `sync_items` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watch_queue` (
	`title` text PRIMARY KEY NOT NULL,
	`total_episodes` integer,
	`watched` integer DEFAULT 0 NOT NULL,
	`unlocked` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `changes_tbl_pk_idx` ON `changes` (`tbl`,`pk`);--> statement-breakpoint
CREATE INDEX `japanese_log_date_idx` ON `japanese_log` (`date`);--> statement-breakpoint
CREATE INDEX `missions_day_date_idx` ON `missions` (`day_date`);