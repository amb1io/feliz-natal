ALTER TABLE notificacao
ADD COLUMN mensagem_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notificacao_mensagem_id
ON notificacao (mensagem_id);
