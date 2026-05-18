export const shuffle = <T,>(items: T[]): T[] => {
	const array = [...items];
	for (let index = array.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[array[index], array[randomIndex]] = [array[randomIndex], array[index]];
	}
	return array;
};

/** Derangement: no participant draws themselves. */
export const derange = <T,>(items: T[], maxAttempts = 100): T[] | null => {
	if (items.length < 2) return null;
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const recipients = shuffle(items);
		const isValid = items.every((id, index) => recipients[index] !== id);
		if (isValid) return recipients;
	}
	return null;
};
