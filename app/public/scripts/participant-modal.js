window.participantModal = function participantModal() {
	return {
		open: false,
		participant: null,
		showParticipant(event) {
			let payload = null;
			if (event && typeof event === 'object' && 'currentTarget' in event) {
				const raw = event.currentTarget?.dataset?.participant;
				if (raw) {
					try {
						payload = JSON.parse(decodeURIComponent(raw));
					} catch (error) {
						console.error('Erro ao abrir participante:', error);
					}
				}
			} else if (event) {
				payload = event;
			}

			if (!payload) return;
			if (payload.userId) {
				window.location.href = `/amigo-secreto/presentes/${encodeURIComponent(payload.userId)}`;
				return;
			}
			this.participant = payload;
			this.open = true;
			document.body.classList.add('overflow-hidden');
		},
		hideModal() {
			this.open = false;
			this.participant = null;
			document.body.classList.remove('overflow-hidden');
		}
	};
};
