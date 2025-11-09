CREATE TABLE IF NOT EXISTS notificacao (
    id TEXT NOT NULL PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    grupo_id TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    lido BOOLEAN NOT NULL DEFAULT 0,
    lido_em DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notificacao_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT notificacao_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES grupo(id) ON DELETE CASCADE ON UPDATE CASCADE
);
