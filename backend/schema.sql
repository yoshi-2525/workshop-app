-- Workshop App: MySQL schema
-- Matches app/models/*.py and alembic/versions (up to 0016). Keep in sync if models change.

CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT,
	email VARCHAR(255) NOT NULL,
	name VARCHAR(255) NOT NULL,
	hashed_password VARCHAR(255) NOT NULL,
	role ENUM('admin','facilitator','participant') NOT NULL DEFAULT 'participant',
	bio TEXT NOT NULL DEFAULT '',
	avatar_url VARCHAR(2000) NOT NULL DEFAULT '',
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY ix_users_email (email)
);

CREATE TABLE workshops (
	id INTEGER NOT NULL AUTO_INCREMENT,
	title VARCHAR(255) NOT NULL,
	description TEXT NOT NULL,
	image_url VARCHAR(2000) NOT NULL DEFAULT '',
	location_type ENUM('online','offline') NOT NULL DEFAULT 'offline',
	location VARCHAR(255) NOT NULL,
	start_at DATETIME NOT NULL,
	end_at DATETIME NOT NULL,
	capacity INTEGER NOT NULL DEFAULT 10,
	price INTEGER NOT NULL DEFAULT 0,
	cancellation_policy TEXT NOT NULL DEFAULT '',
	participant_guide TEXT NOT NULL DEFAULT '',
	emergency_contact VARCHAR(255) NOT NULL DEFAULT '',
	status ENUM('draft','published','canceled') NOT NULL DEFAULT 'draft',
	facilitator_id INTEGER NOT NULL,
	published_at DATETIME NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	FOREIGN KEY(facilitator_id) REFERENCES users (id)
);

CREATE TABLE reservations (
	id INTEGER NOT NULL AUTO_INCREMENT,
	workshop_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	attendee_name VARCHAR(255) NOT NULL DEFAULT '',
	contact VARCHAR(255) NOT NULL DEFAULT '',
	ticket_count INTEGER NOT NULL DEFAULT 1,
	status ENUM('confirmed','canceled') NOT NULL DEFAULT 'confirmed',
	attendance ENUM('unconfirmed','present','absent') NOT NULL DEFAULT 'unconfirmed',
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_reservation_workshop_user UNIQUE (workshop_id, user_id),
	CONSTRAINT ck_reservation_ticket_count CHECK (ticket_count BETWEEN 1 AND 4),
	FOREIGN KEY(workshop_id) REFERENCES workshops (id),
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE favorites (
	id INTEGER NOT NULL AUTO_INCREMENT,
	user_id INTEGER NOT NULL,
	workshop_id INTEGER NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_favorite_user_workshop UNIQUE (user_id, workshop_id),
	FOREIGN KEY(user_id) REFERENCES users (id),
	FOREIGN KEY(workshop_id) REFERENCES workshops (id)
);

CREATE TABLE notifications (
	id INTEGER NOT NULL AUTO_INCREMENT,
	user_id INTEGER NOT NULL,
	workshop_id INTEGER NOT NULL,
	type ENUM('cancellation','reminder','reservation_canceled') NOT NULL,
	message TEXT NOT NULL,
	is_read BOOLEAN NOT NULL DEFAULT FALSE,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_notification_user_workshop_type UNIQUE (user_id, workshop_id, type),
	FOREIGN KEY(user_id) REFERENCES users (id),
	FOREIGN KEY(workshop_id) REFERENCES workshops (id)
);

CREATE TABLE inquiries (
	id INTEGER NOT NULL AUTO_INCREMENT,
	workshop_id INTEGER NOT NULL,
	participant_id INTEGER NOT NULL,
	last_message_at DATETIME NOT NULL,
	participant_last_read_id INTEGER NOT NULL DEFAULT 0,
	facilitator_last_read_id INTEGER NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_inquiry_workshop_participant UNIQUE (workshop_id, participant_id),
	FOREIGN KEY(workshop_id) REFERENCES workshops (id),
	FOREIGN KEY(participant_id) REFERENCES users (id)
);

CREATE TABLE inquiry_messages (
	id INTEGER NOT NULL AUTO_INCREMENT,
	inquiry_id INTEGER NOT NULL,
	sender_id INTEGER NOT NULL,
	body TEXT NOT NULL,
	is_broadcast BOOL NOT NULL DEFAULT false,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY ix_inquiry_messages_inquiry_id (inquiry_id),
	FOREIGN KEY(inquiry_id) REFERENCES inquiries (id),
	FOREIGN KEY(sender_id) REFERENCES users (id)
);
