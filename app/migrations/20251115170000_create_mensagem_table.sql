-- Ensure mensagem table exists for realtime chat persistence
CREATE TABLE IF NOT EXISTS mensagem (
    id TEXT NOT NULL PRIMARY KEY,
    grupo_id TEXT NOT NULL,
    recipiente_id TEXT,
    remetente_id TEXT NOT NULL,
    body TEXT NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deletado_em DATETIME,
    is_secret BOOLEAN NOT NULL DEFAULT 0,
    CONSTRAINT mensagem_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES grupo (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT mensagem_recipiente_id_fkey FOREIGN KEY (recipiente_id) REFERENCES usuario (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT mensagem_remetente_id_fkey FOREIGN KEY (remetente_id) REFERENCES usuario (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mensagem_grupo_criado
ON mensagem (grupo_id, datetime(criado_em));

CREATE INDEX IF NOT EXISTS idx_mensagem_secret_chat
ON mensagem (grupo_id, remetente_id, recipiente_id, is_secret);
