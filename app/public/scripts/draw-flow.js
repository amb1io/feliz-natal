(() => {
	const form = document.querySelector('[data-draw-form]');
	const loader = document.querySelector('[data-draw-loader]');
	const alertModal = document.querySelector('[data-draw-alert-modal]');
	const submitButton = form?.querySelector('[data-draw-submit]');
	const errorPlaceholder = document.querySelector('[data-draw-error]');
	let hideTimer = null;
	if (!form || !loader) return;
	const acceptedInviteCount = Number(form.dataset.acceptedInviteCount ?? '0');
	const hasAcceptedInvites = acceptedInviteCount > 0;

	const showAlertModal = () => {
		if (!(alertModal instanceof HTMLElement)) return;
		alertModal.classList.remove('hidden');
		alertModal.classList.add('flex');
	};

	const hideAlertModal = () => {
		if (!(alertModal instanceof HTMLElement)) return;
		alertModal.classList.add('hidden');
		alertModal.classList.remove('flex');
	};

	const showLoader = () => {
		if (hideTimer !== null) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		loader.classList.add('flex');
		loader.classList.remove('hidden');
		if (submitButton instanceof HTMLButtonElement) {
			submitButton.setAttribute('disabled', 'true');
			submitButton.classList.add('opacity-75', 'pointer-events-none');
		}
	};

	const hideLoader = () => {
		if (hideTimer !== null) {
			clearTimeout(hideTimer);
		}
		hideTimer = window.setTimeout(() => {
			loader.classList.add('hidden');
			loader.classList.remove('flex');
			if (submitButton instanceof HTMLButtonElement) {
				submitButton.removeAttribute('disabled');
				submitButton.classList.remove('opacity-75', 'pointer-events-none');
			}
			hideTimer = null;
		}, 5000);
	};

	const setError = (message) => {
		if (!(errorPlaceholder instanceof HTMLElement)) return;
		errorPlaceholder.textContent = message;
		if (message) {
			errorPlaceholder.classList.remove('hidden');
		} else {
			errorPlaceholder.classList.add('hidden');
		}
	};

	const isDrawIntent = () => {
		const intentInput = form.querySelector('input[name="intent"]');
		return intentInput instanceof HTMLInputElement && intentInput.value === 'draw';
	};

	const shouldKeepLoader = (event) => {
		const xhr = event?.detail?.xhr;
		if (!xhr || typeof xhr.getResponseHeader !== 'function') return false;
		const redirectHeader = xhr.getResponseHeader('HX-Redirect');
		return typeof redirectHeader === 'string' && redirectHeader.length > 0;
	};

	if (!('htmx' in window) || !window.htmx) {
		form.addEventListener('submit', (event) => {
			if (!isDrawIntent()) return;
			if (event.defaultPrevented) return;
			if (!hasAcceptedInvites) {
				event.preventDefault();
				showAlertModal();
				return;
			}
			setError('');
			showLoader();
		});
		return;
	}

	form.addEventListener('htmx:beforeRequest', (event) => {
		if (event.target !== form || !isDrawIntent()) return;
		if (event.defaultPrevented) return;
		if (!hasAcceptedInvites) {
			event.preventDefault();
			showAlertModal();
			return;
		}
		setError('');
		showLoader();
	});

	form.addEventListener('htmx:afterRequest', (event) => {
		if (event.target !== form || !isDrawIntent()) return;
		if (shouldKeepLoader(event)) {
			return;
		}
		hideLoader();
	});

	form.addEventListener('htmx:responseError', (event) => {
		if (event.target !== form || !isDrawIntent()) return;
		const responseText = event.detail?.xhr?.responseText?.trim() ?? '';
		hideLoader();
		setError(responseText || 'Não foi possível realizar o sorteio agora. Tente novamente.');
	});

	form.addEventListener('htmx:sendError', (event) => {
		if (event.target !== form || !isDrawIntent()) return;
		hideLoader();
		setError('Não foi possível realizar o sorteio agora. Verifique sua conexão e tente novamente.');
	});

	if (alertModal instanceof HTMLElement) {
		alertModal.addEventListener('click', (event) => {
			const rawTarget = event.target;
			if (!(rawTarget instanceof Node)) return;
			const targetElement =
				rawTarget instanceof Element ? rawTarget : rawTarget.parentElement;
			if (!targetElement) return;
			if (targetElement === alertModal || targetElement.closest('[data-draw-alert-close]')) {
				hideAlertModal();
			}
		});
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && !alertModal.classList.contains('hidden')) {
				hideAlertModal();
			}
		});
	}
})();
