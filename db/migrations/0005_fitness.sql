CREATE TABLE `body_logs` (
	`date` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`weight_kg` real,
	`steps` integer,
	`water_ml` integer,
	`sleep_min` integer,
	`note` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `fitness_phases` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`rate_pct_per_week` real NOT NULL,
	`protein_g_per_kg` real NOT NULL,
	`fat_g_per_kg` real NOT NULL,
	`start_weight_kg` real NOT NULL,
	`note` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `food_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`meal` text NOT NULL,
	`food_id` text,
	`name` text NOT NULL,
	`servings` real NOT NULL,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fibre_g` real,
	`micros` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`serving_label` text NOT NULL,
	`serving_g` real,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fibre_g` real,
	`micros` text DEFAULT '{}' NOT NULL,
	`favourite` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `maintenance_weeks` (
	`iso_week` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`kcal` integer NOT NULL,
	`note` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`exercise` text NOT NULL,
	`muscle` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`reps` integer NOT NULL,
	`kg` real NOT NULL,
	`rpe` real,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`duration_min` integer,
	`note` text,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `fitness_phases_start_date_idx` ON `fitness_phases` (`start_date`);--> statement-breakpoint
CREATE INDEX `food_logs_date_idx` ON `food_logs` (`date`);--> statement-breakpoint
CREATE INDEX `workout_sets_workout_id_idx` ON `workout_sets` (`workout_id`);--> statement-breakpoint
CREATE INDEX `workouts_date_idx` ON `workouts` (`date`);