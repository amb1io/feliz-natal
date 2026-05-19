(() => {
	const form = document.querySelector('[data-draw-form]');
	const loader = document.querySelector('[data-draw-loader]');
	const alertModal = document.querySelector('[data-draw-alert-modal]');
	const confirmModal = document.querySelector('[data-draw-confirm-modal]');
	const confirmSubmitButton = confirmModal?.querySelector('[data-draw-confirm-submit]');
	const submitButton = form?.querySelector('[data-draw-submit]');
	const errorPlaceholder = document.querySelector('[data-draw-error]');
	let hideTimer = null;
	if (!form || !loader || !(submitButton instanceof HTMLButtonElement)) return;

	const showModal = (modal) => {
		if (!(modal instanceof HTMLElement)) return;
		modal.removeAttribute('hidden');
		modal.classList.remove('hidden');
		modal.classList.add('flex');
	};

	const hideModal = (modal) => {
		if (!(modal instanceof HTMLElement)) return;
		modal.setAttribute('hidden', '');
		modal.classList.add('hidden');
		modal.classList.remove('flex');
	};

	const showAlertModal = () => showModal(alertModal);
	const hideAlertModal = () => hideModal(alertModal);
	const showConfirmModal = () => showModal(confirmModal);
	const hideConfirmModal = () => hideModal(confirmModal);

	hideAlertModal();
	hideConfirmModal();

	const showLoader = () => {
		if (hideTimer !== null) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		loader.classList.add('flex');
		loader.classList.remove('hidden');
		submitButton.setAttribute('disabled', 'true');
		submitButton.classList.add('opacity-75', 'pointer-events-none');
	};

	const hideLoader = () => {
		if (hideTimer !== null) {
			clearTimeout(hideTimer);
		}
		hideTimer = window.setTimeout(() => {
			loader.classList.add('hidden');
			loader.classList.remove('flex');
			submitButton.removeAttribute('disabled');
			submitButton.classList.remove('opacity-75', 'pointer-events-none');
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

	const hasAcceptedInvites = () => Number(form.dataset.acceptedInviteCount ?? '0') > 0;
	const hasPreviousDraw = () => {
		const fromDataset = form.dataset.hasDraw === 'true';
		const fromLabel = (submitButton.textContent ?? '').toLowerCase().includes('novo sorteio');
		return fromDataset || fromLabel;
	};

	const proceedWithDraw = () => {
		setError('');
		showLoader();
		if (typeof form.requestSubmit === 'function') {
			form.requestSubmit();
			return;
		}
		const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
		const notCancelled = form.dispatchEvent(submitEvent);
		if (notCancelled) {
			form.submit();
		}
	};

	const handleDrawButtonClick = (event) => {
		event.preventDefault();
		if (!hasAcceptedInvites()) {
			showAlertModal();
			return;
		}
		if (hasPreviousDraw()) {
			showConfirmModal();
			return;
		}
		proceedWithDraw();
	};

	submitButton.addEventListener('click', handleDrawButtonClick);

	if (confirmSubmitButton instanceof HTMLButtonElement) {
		confirmSubmitButton.addEventListener('click', () => {
			hideConfirmModal();
			proceedWithDraw();
		});
	}

	if ('htmx' in window && window.htmx) {
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
	}

	const bindModalDismiss = (modal, hide) => {
		if (!(modal instanceof HTMLElement)) return;
		modal.addEventListener('click', (event) => {
			const rawTarget = event.target;
			if (!(rawTarget instanceof Node)) return;
			const targetElement =
				rawTarget instanceof Element ? rawTarget : rawTarget.parentElement;
			if (!targetElement) return;
			if (targetElement === modal || targetElement.closest('[data-draw-alert-close]')) {
				hide();
			}
		});
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
				hide();
			}
		});
	};

	bindModalDismiss(alertModal, hideAlertModal);
	bindModalDismiss(confirmModal, hideConfirmModal);
})();
