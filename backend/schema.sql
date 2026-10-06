-- Workshop App: MySQL schema
-- Matches app/models/*.py and alembic/versions (up to 0021). Keep in sync if models change.

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
	payment_method ENUM('onsite','online') NOT NULL DEFAULT 'onsite',
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
	status ENUM('confirmed','canceled','pending_payment','expired') NOT NULL DEFAULT 'confirmed',
	attendance ENUM('unconfirmed','present','absent') NOT NULL DEFAULT 'unconfirmed',
	payment_expires_at DATETIME NULL,
	cancel_reason ENUM('participant','facilitator') NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_reservation_workshop_user UNIQUE (workshop_id, user_id),
	CONSTRAINT ck_reservation_ticket_count CHECK (ticket_count BETWEEN 1 AND 4),
	FOREIGN KEY(workshop_id) REFERENCES workshops (id),
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE payments (
	id INTEGER NOT NULL AUTO_INCREMENT,
	reservation_id INTEGER NOT NULL,
	stripe_checkout_session_id VARCHAR(255) NULL,
	stripe_payment_intent_id VARCHAR(255) NULL,
	stripe_refund_id VARCHAR(255) NULL,
	amount INTEGER NOT NULL,
	platform_fee_amount INTEGER NOT NULL,
	facilitator_amount INTEGER NOT NULL,
	stripe_fee_amount INTEGER NULL,
	refund_amount INTEGER NULL,
	currency VARCHAR(3) NOT NULL,
	status ENUM('pending','paid','expired','refund_pending','refunded','refund_failed') NOT NULL,
	refund_attempts INTEGER NOT NULL DEFAULT 0,
	paid_at DATETIME NULL,
	refunded_at DATETIME NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_payments_stripe_checkout_session_id UNIQUE (stripe_checkout_session_id),
	CONSTRAINT uq_payments_stripe_payment_intent_id UNIQUE (stripe_payment_intent_id),
	CONSTRAINT ck_payments_amount CHECK (amount > 0),
	CONSTRAINT ck_payments_platform_fee CHECK (platform_fee_amount >= 0 AND platform_fee_amount <= amount),
	CONSTRAINT ck_payments_facilitator_amount CHECK (facilitator_amount >= 0 AND facilitator_amount + platform_fee_amount = amount),
	CONSTRAINT ck_payments_refund CHECK (refund_amount IS NULL OR (refund_amount >= 0 AND refund_amount <= amount)),
	CONSTRAINT ck_payments_refund_attempts CHECK (refund_attempts >= 0),
	KEY ix_payments_reservation_id (reservation_id),
	FOREIGN KEY(reservation_id) REFERENCES reservations (id)
);

CREATE TABLE payout_bank_accounts (
	id INTEGER NOT NULL AUTO_INCREMENT,
	user_id INTEGER NOT NULL,
	bank_name VARCHAR(100) NOT NULL,
	bank_code VARCHAR(4) NOT NULL,
	branch_name VARCHAR(100) NOT NULL,
	branch_code VARCHAR(3) NOT NULL,
	account_type ENUM('ordinary','checking') NOT NULL,
	account_number VARCHAR(7) NOT NULL,
	account_holder VARCHAR(100) NOT NULL,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_payout_bank_accounts_user_id UNIQUE (user_id),
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE payout_requests (
	id INTEGER NOT NULL AUTO_INCREMENT,
	facilitator_id INTEGER NOT NULL,
	amount INTEGER NOT NULL,
	transfer_fee INTEGER NOT NULL,
	transfer_amount INTEGER NOT NULL,
	status ENUM('requested','paid','rejected') NOT NULL,
	bank_name VARCHAR(100) NOT NULL,
	bank_code VARCHAR(4) NOT NULL,
	branch_name VARCHAR(100) NOT NULL,
	branch_code VARCHAR(3) NOT NULL,
	account_type ENUM('ordinary','checking') NOT NULL,
	account_number VARCHAR(7) NOT NULL,
	account_holder VARCHAR(100) NOT NULL,
	note TEXT NOT NULL,
	requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	processed_at DATETIME NULL,
	PRIMARY KEY (id),
	CONSTRAINT ck_payout_requests_amount CHECK (amount > 0),
	CONSTRAINT ck_payout_requests_transfer CHECK (transfer_fee >= 0 AND transfer_amount > 0 AND transfer_amount + transfer_fee = amount),
	KEY ix_payout_requests_facilitator_id (facilitator_id),
	FOREIGN KEY(facilitator_id) REFERENCES users (id)
);

CREATE TABLE stripe_events (
	event_id VARCHAR(255) NOT NULL,
	type VARCHAR(255) NOT NULL,
	received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (event_id)
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

CREATE TABLE facilitator_follows (
	id INTEGER NOT NULL AUTO_INCREMENT,
	follower_id INTEGER NOT NULL,
	facilitator_id INTEGER NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	CONSTRAINT uq_follow_follower_facilitator UNIQUE (follower_id, facilitator_id),
	KEY ix_facilitator_follows_facilitator_id (facilitator_id),
	FOREIGN KEY(follower_id) REFERENCES users (id),
	FOREIGN KEY(facilitator_id) REFERENCES users (id)
);

CREATE TABLE notifications (
	id INTEGER NOT NULL AUTO_INCREMENT,
	user_id INTEGER NOT NULL,
	workshop_id INTEGER NOT NULL,
	type ENUM('cancellation','reminder','reservation_canceled','new_workshop','payment_refunded','payment_refund_failed') NOT NULL,
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
