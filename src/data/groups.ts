export interface GroupKeyFact {
	label: string;
	value: string;
}

export interface GroupNextAction {
	title: string;
	due: string;
	description: string;
}

export interface GroupDetails {
	keyFacts: GroupKeyFact[];
	highlights: string[];
	nextActions: GroupNextAction[];
}

export interface Group {
	id: number;
	title: string;
	slug: string;
	subtitle: string;
	participants: number;
	description: string;
	details: GroupDetails;
	revealDate: string;
	drawDate: string;
	budget: string;
	location: string;
	status: string;
	participantsList: string[];
}

export const groups: Group[] = [
	{
		id: 1,
		title: 'Família Lima 2024',
		slug: 'familia-lima-2024',
		subtitle: 'Celebração em 24 de dezembro',
		participants: 18,
		description: 'Troca de presentes definida para 20h, wishlist compartilhada com todos os participantes.',
		revealDate: '24 de dezembro • 20h',
		drawDate: '25 de novembro',
		budget: 'R$ 120 por participante',
		location: 'Casa da Tia Ana, Curitiba',
		status: 'Preparativos em andamento',
		details: {
			keyFacts: [
				{ label: 'Encontro', value: '24 de dezembro • 20h' },
				{ label: 'Local', value: 'Casa da Tia Ana, Curitiba' },
				{ label: 'Orçamento', value: 'R$ 120 por participante' }
			],
			highlights: [
				'Todos os 18 participantes confirmaram presença.',
				'Listas de desejos atualizadas na última semana.',
				'Sorteio foi realizado automaticamente em 25/11.'
			],
			nextActions: [
				{
					title: 'Enviar mensagem de boas-vindas',
					due: 'Até 30/11',
					description: 'Use o mural para reforçar as regras e o clima da celebração.'
				},
				{
					title: 'Revisar endereços de entrega',
					due: 'Até 05/12',
					description: 'Confirme com cada participante o endereço para envio do presente.'
				},
				{
					title: 'Confirmar cardápio colaborativo',
					due: 'Até 12/12',
					description: 'Defina quem levará entradas, pratos principais e sobremesas.'
				}
			]
		},
		participantsList: [
			'João Lima',
			'Ana Beatriz',
			'Fernando Torres',
			'Maria Clara',
			'Rafaela Souza',
			'Lucas Menezes'
		]
	},
	{
		id: 2,
		title: 'Amigos do Trabalho',
		slug: 'amigos-do-trabalho',
		subtitle: 'Celebração em 18 de dezembro',
		participants: 12,
		description: 'Sorteio concluído. Preparar mensagens secretas para envio nesta semana.',
		revealDate: '18 de dezembro • 19h',
		drawDate: '20 de novembro',
		budget: 'R$ 80 por participante',
		location: 'Coworking Central, São Paulo',
		status: 'Aguardando confirmações finais',
		details: {
			keyFacts: [
				{ label: 'Encontro', value: '18 de dezembro • 19h' },
				{ label: 'Local', value: 'Coworking Central, São Paulo' },
				{ label: 'Orçamento', value: 'R$ 80 por participante' }
			],
			highlights: [
				'Restam 2 confirmações de presença.',
				'Mensagens anônimas liberadas para todos os participantes.',
				'Playlist colaborativa já disponível.'
			],
			nextActions: [
				{
					title: 'Cobrar confirmações pendentes',
					due: 'Até 27/11',
					description: 'Envie lembretes automáticos para os participantes que ainda não responderam.'
				},
				{
					title: 'Abrir votação para escolha de bebidas',
					due: 'Até 01/12',
					description: 'Crie um formulário rápido com as opções preferidas do time.'
				},
				{
					title: 'Planejar dinâmica de integração',
					due: 'Até 08/12',
					description: 'Selecione uma brincadeira rápida para o início do encontro.'
				}
			]
		},
		participantsList: [
			'Bruna Martins',
			'Carlos Alberto',
			'Felipe Monteiro',
			'Lívia Campos',
			'Sofia Ferreira',
			'Thiago Costa'
		]
	},
	{
		id: 3,
		title: 'Vizinhança Solidária',
		slug: 'vizinhanca-solidaria',
		subtitle: 'Celebração em 16 de dezembro',
		participants: 26,
		description: 'Campanha de doações aberta, escolha seu cartão de boas festas para envio.',
		revealDate: '16 de dezembro • 17h',
		drawDate: '10 de novembro',
		budget: 'A partir de R$ 50 + doação de brinquedo',
		location: 'Praça da Vila Aurora, Belo Horizonte',
		status: 'Logística de doações em andamento',
		details: {
			keyFacts: [
				{ label: 'Encontro', value: '16 de dezembro • 17h' },
				{ label: 'Local', value: 'Praça da Vila Aurora, Belo Horizonte' },
				{ label: 'Orçamento', value: 'A partir de R$ 50 + doação de brinquedo' }
			],
			highlights: [
				'Metade das famílias já recebeu os kits de boas-vindas.',
				'Campanha de arrecadação atingiu 65% da meta.',
				'Voluntários escalados para montagem da decoração.'
			],
			nextActions: [
				{
					title: 'Divulgar campanha nas redes',
					due: 'Até 22/11',
					description: 'Use os materiais prontos no drive compartilhado para ampliar o alcance.'
				},
				{
					title: 'Organizar logística de entrega',
					due: 'Até 30/11',
					description: 'Divida as entregas por setores da vizinhança para otimizar tempo e deslocamento.'
				},
				{
					title: 'Confirmar voluntários do evento',
					due: 'Até 06/12',
					description: 'Garanta que cada turno tenha pelo menos 4 pessoas disponíveis.'
				}
			]
		},
		participantsList: [
			'Aurora Santos',
			'Bruno Vieira',
			'Camila Rocha',
			'Diego Pires',
			'Evelyn Martins',
			'Gustavo Andrade',
			'Helena Freitas',
			'Igor Barbosa'
		]
	}
];

export function getGroupBySlug(slug: string): Group | undefined {
	return groups.find((group) => group.slug === slug);
}
