-- mensagem_id já é adicionada em 20251106191733.sql; só garante o índice.
CREATE INDEX IF NOT EXISTS idx_notificacao_mensagem_id
ON notificacao (mensagem_id);
