-- Workshop App: MySQL schema
-- Matches app/models/*.py and alembic/versions (up to 0009). Keep in sync if models change.

CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT,
	email VARCHAR(255) NOT NULL,
	name VARCHAR(255) NOT NULL,
	hashed_password VARCHAR(255) NOT NULL,
	role ENUM('admin','facilitator','participant') NOT NULL DEFAULT 'participant',
	bio TEXT NOT NULL DEFAULT '',
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
	status ENUM('draft','published','canceled') NOT NULL DEFAULT 'draft',
	facilitator_id INTEGER NOT NULL,
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
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_reservation_workshop_user UNIQUE (workshop_id, user_id),
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
	type ENUM('cancellation','reminder') NOT NULL,
	message TEXT NOT NULL,
	is_read BOOLEAN NOT NULL DEFAULT FALSE,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_notification_user_workshop_type UNIQUE (user_id, workshop_id, type),
	FOREIGN KEY(user_id) REFERENCES users (id),
	FOREIGN KEY(workshop_id) REFERENCES workshops (id)
);
