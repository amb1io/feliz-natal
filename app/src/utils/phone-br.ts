export const maskPhoneBr = (value: string) => {
	const digits = (value ?? '').toString().replace(/\D/g, '').slice(0, 11);
	if (digits.length === 0) return '';
	if (digits.length === 1) return `(${digits}`;
	if (digits.length === 2) return `(${digits})`;
	if (digits.length <= 6) {
		return `(${digits.slice(0, 2)})${digits.slice(2)}`;
	}
	return `(${digits.slice(0, 2)})${digits.slice(2, 6)}-${digits.slice(6)}`;
};
