import { formatCurrency } from './currency';
import type { GrupoRow } from '../server/types';

export const buildBudgetDescription = (grupoRow: GrupoRow) => {
	const minBudgetText = formatCurrency(grupoRow.orcamento_minimo ?? null);
	const maxBudgetText = formatCurrency(grupoRow.orcamento_maximo ?? null);

	if (grupoRow.orcamento_sem_limites) {
		return 'Sem limite definido';
	}
	if (minBudgetText && maxBudgetText) {
		return `${minBudgetText} - ${maxBudgetText}`;
	}
	if (minBudgetText) {
		return `A partir de ${minBudgetText}`;
	}
	if (maxBudgetText) {
		return `Até ${maxBudgetText}`;
	}
	return 'Não definido';
};

export const buildDisplayLocation = (grupoRow: GrupoRow) => {
	const locationName = grupoRow.localizacao_nome ?? null;
	const locationAddress = grupoRow.localizacao ?? null;
	return locationName && locationAddress && locationName !== locationAddress
		? `${locationName} (${locationAddress})`
		: locationName ?? locationAddress;
};
