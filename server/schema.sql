-- Reference schema for the Quiz_boss database.
-- The actual creation is performed programmatically by setup.js (via the mysql2 driver),
-- since no mysql CLI is required. This file documents the structure.

CREATE DATABASE IF NOT EXISTS Quiz_boss
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE Quiz_boss;

CREATE TABLE topics (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(64)  NOT NULL UNIQUE,
  name        VARCHAR(128) NOT NULL,
  description TEXT,
  icon        VARCHAR(16),
  color       VARCHAR(16)
) ENGINE=InnoDB;

CREATE TABLE quiz_questions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  topic_id      INT NOT NULL,
  question      TEXT NOT NULL,
  options       JSON NOT NULL,             -- array of 4 strings
  correct_index TINYINT NOT NULL,          -- 0..3, index into options
  explanation   TEXT,
  difficulty    ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium',
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE flashcards (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  topic_id   INT NOT NULL,
  front      TEXT NOT NULL,
  back       TEXT NOT NULL,
  hint       TEXT,
  difficulty ENUM('easy','medium','hard') NOT NULL DEFAULT 'easy',
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(30)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  token_version INT NOT NULL DEFAULT 0,   -- bumped to revoke outstanding JWTs (SEC-03)
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE quiz_attempts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  topic_slug VARCHAR(64) NOT NULL,
  difficulty VARCHAR(16) NOT NULL,
  score      INT NOT NULL,
  total      INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB;
