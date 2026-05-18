(() => {
	const modal = document.querySelector('[data-secret-modal]');
	if (!modal) return;

	let autoOpen = modal.dataset.secretAutoOpen === 'true';

	const clearAutoOpenQuery = () => {
		if (!autoOpen) return;
		try {
			const url = new URL(window.location.href);
			if (url.searchParams.has('openSecret')) {
				url.searchParams.delete('openSecret');
				const nextUrl = `${url.pathname}${url.search}${url.hash}`;
				window.history.replaceState({}, document.title, nextUrl);
			}
		} catch {
			// noop
		}
		autoOpen = false;
		modal.dataset.secretAutoOpen = 'false';
	};

	const showModal = () => {
		modal.classList.remove('hidden');
		clearAutoOpenQuery();
	};

	const hideModal = () => {
		modal.classList.add('hidden');
	};

	document.addEventListener('click', (event) => {
		const target = event.target && (event.target instanceof Element ? event.target : null);
		if (!target) return;

		if (target.closest('[data-secret-open]')) {
			event.preventDefault();
			showModal();
			return;
		}

		if (target.closest('[data-secret-close]')) {
			event.preventDefault();
			hideModal();
		}
	});

	modal.addEventListener('click', (event) => {
		if (event.target === modal) {
			hideModal();
		}
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
			hideModal();
		}
	});

	if (autoOpen && modal.classList.contains('hidden')) {
		showModal();
	} else if (autoOpen) {
		clearAutoOpenQuery();
	}
})();
