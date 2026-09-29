CREATE TABLE `room_chat` (
	`code` text PRIMARY KEY NOT NULL,
	`history` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
