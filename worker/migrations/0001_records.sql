-- Sealed sync records. The relay can't read blob; it only stores and forwards it.
CREATE TABLE IF NOT EXISTS records (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL,
  sender TEXT NOT NULL,
  at INTEGER NOT NULL,
  created INTEGER NOT NULL,
  blob TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS records_mailbox_seq ON records (mailbox, seq);
CREATE UNIQUE INDEX IF NOT EXISTS records_mailbox_id ON records (mailbox, id);
