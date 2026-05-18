export const formatDateForInput = (value?: string | null) => {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		if (typeof value === 'string' && value.length >= 10) {
			return value.slice(0, 10);
		}
		return '';
	}
	return date.toISOString().slice(0, 10);
};

export const formatDateValue = (value?: string | null) => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString('pt-BR', {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	});
};

export const toDateValue = (value?: string | null) => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};
