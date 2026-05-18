export type FelizNatalEnv = {
	DB: D1Database;
	WEBSOCKET_WORKER_URL?: string;
	[key: string]: unknown;
};

export type GrupoRow = {
	id: string;
	slug: string;
	titulo: string;
	descricao?: string | null;
	data_sorteio?: string | null;
	data_revelacao?: string | null;
	status?: string | null;
	criado_em?: string | null;
	criado_por?: string | null;
	tipo_presente?: string | null;
	orcamento_minimo?: number | null;
	orcamento_maximo?: number | null;
	orcamento_sem_limites?: number | boolean | null;
	localizacao?: string | null;
	localizacao_nome?: string | null;
	localizacao_lat?: number | null;
	localizacao_lng?: number | null;
};
