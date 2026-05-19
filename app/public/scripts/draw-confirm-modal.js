(() => {
	const form = document.querySelector('[data-draw-form]');
	const confirmModal = document.querySelector('[data-draw-confirm-modal]');
	const confirmSubmit = confirmModal?.querySelector('[data-draw-confirm-submit]');
	if (!form || !(confirmModal instanceof HTMLElement)) return;

	const hasDraw = form.dataset.hasDraw === 'true';
	let drawConfirmed = false;

	const isDrawIntent = () => {
		const intentInput = form.querySelector('input[name="intent"]');
		return intentInput instanceof HTMLInputElement && intentInput.value === 'draw';
	};

	const showConfirmModal = () => {
		confirmModal.classList.remove('hidden');
		confirmModal.classList.add('flex');
	};

	const hideConfirmModal = () => {
		confirmModal.classList.add('hidden');
		confirmModal.classList.remove('flex');
	};

	const interceptIfNeeded = (event) => {
		if (!hasDraw || !isDrawIntent() || drawConfirmed) return;
		event.preventDefault();
		showConfirmModal();
	};

	form.addEventListener('submit', interceptIfNeeded);
	form.addEventListener('htmx:beforeRequest', (event) => {
		if (event.target !== form) return;
		interceptIfNeeded(event);
	});

	confirmModal.addEventListener('click', (event) => {
		const rawTarget = event.target;
		if (!(rawTarget instanceof Node)) return;
		const targetElement = rawTarget instanceof Element ? rawTarget : rawTarget.parentElement;
		if (!targetElement) return;
		if (targetElement === confirmModal) {
			hideConfirmModal();
		}
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && !confirmModal.classList.contains('hidden')) {
			hideConfirmModal();
		}
	});

	if (confirmSubmit instanceof HTMLButtonElement) {
		confirmSubmit.addEventListener('click', () => {
			hideConfirmModal();
			drawConfirmed = true;
			if (typeof form.requestSubmit === 'function') {
				form.requestSubmit();
				return;
			}
			form.submit();
		});
	}

	form.addEventListener('htmx:afterRequest', () => {
		drawConfirmed = false;
	});
})();
