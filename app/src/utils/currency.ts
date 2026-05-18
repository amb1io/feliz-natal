export const formatCurrency = (value?: number | null) => {
	if (value === null || value === undefined) return null;
	return new Intl.NumberFormat('pt-BR', {
		style: 'currency',
		currency: 'BRL',
		minimumFractionDigits: 2
	}).format(Number(value));
};
