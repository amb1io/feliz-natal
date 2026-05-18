(function initGroupForm() {
	const initialData = window.__GROUP_FORM_INITIAL_DATA__ ?? null;

	const buildParticipants = (entries) => {
		if (!Array.isArray(entries) || !entries.length) {
			return [{ email: '', phone: '' }];
		}
		return entries.map((entry) => ({
			email: entry?.email ?? '',
			phone: entry?.phone ?? ''
		}));
	};

	window.groupForm = () => ({
		form: {
			name: initialData?.name ?? '',
			giftType: initialData?.giftType ?? '',
			drawDate: initialData?.drawDate ?? '',
			revealDate: initialData?.revealDate ?? '',
			priceMin: initialData?.priceMin ?? 50,
			priceMax: initialData?.priceMax ?? 200,
			noLimit: Boolean(initialData?.noLimit ?? false),
			location: initialData?.location ?? '',
			locationName: initialData?.locationName ?? null,
			locationLat: initialData?.locationLat ?? null,
			locationLng: initialData?.locationLng ?? null,
			tags: Array.isArray(initialData?.tags) ? [...initialData.tags] : [],
			description: initialData?.description ?? '',
			participants: buildParticipants(initialData?.participants)
		},
		tagDraft: '',
		rangeMaxValue: Math.max(1000, initialData?.priceMin ?? 0, initialData?.priceMax ?? 0),
		isEditing: Boolean(initialData?.id),
		isSubmitting: false,
		startSubmitting() {
			this.isSubmitting = true;
			const feedback = document.getElementById('form-feedback');
			if (feedback) feedback.innerHTML = 'Salvando registro...';
		},
		get priceLabel() {
			if (this.form.noLimit) {
				return `Mínimo R$ ${this.form.priceMin.toFixed(0)} · Sem limite máximo`;
			}
			return `R$ ${this.form.priceMin.toFixed(0)} – R$ ${this.form.priceMax.toFixed(0)}`;
		},
		syncMin() {
			if (this.form.priceMin < 0) this.form.priceMin = 0;
			if (this.form.priceMin > this.rangeMaxValue) this.form.priceMin = this.rangeMaxValue;
			if (this.form.priceMin > this.form.priceMax && !this.form.noLimit) {
				this.form.priceMax = this.form.priceMin;
			}
			this.updateSliderTrack();
		},
		syncMax() {
			if (this.form.priceMax < 0) this.form.priceMax = 0;
			if (this.form.priceMax > this.rangeMaxValue) this.form.priceMax = this.rangeMaxValue;
			if (this.form.priceMax < this.form.priceMin) {
				this.form.priceMin = this.form.priceMax;
			}
			this.updateSliderTrack();
		},
		toggleNoLimit() {
			if (this.form.noLimit) this.form.priceMax = this.rangeMaxValue;
			this.updateSliderTrack();
		},
		captureTag() {
			const raw = this.tagDraft.trim();
			if (!raw) return;
			const newTags = raw
				.split(',')
				.map((tag) => tag.trim())
				.filter((tag) => tag.length > 0 && !this.form.tags.includes(tag));
			this.form.tags.push(...newTags);
			this.tagDraft = '';
		},
		removeTag(tag) {
			this.form.tags = this.form.tags.filter((existing) => existing !== tag);
		},
		addParticipant() {
			this.form.participants.push({ email: '', phone: '' });
		},
		removeParticipant(index) {
			if (this.form.participants.length === 1) return;
			this.form.participants.splice(index, 1);
		},
		maskPhone(value) {
			const digits = (value ?? '').toString().replace(/\D/g, '').slice(0, 11);
			if (digits.length === 0) return '';
			if (digits.length === 1) return `(${digits}`;
			if (digits.length === 2) return `(${digits})`;
			if (digits.length <= 6) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
			return `(${digits.slice(0, 2)})${digits.slice(2, 6)}-${digits.slice(6)}`;
		},
		onPhoneInput(event, participant) {
			const masked = this.maskPhone(event.target.value);
			event.target.value = masked;
			participant.phone = masked;
		},
		updateSliderTrack() {
			if (!this.$refs.sliderTrack) return;
			const maxValue = this.rangeMaxValue;
			const minPercent = (this.form.priceMin / maxValue) * 100;
			const maxSelected = this.form.noLimit ? maxValue : this.form.priceMax;
			const maxPercent = (maxSelected / maxValue) * 100;
			this.$refs.sliderTrack.style.background = `linear-gradient(to right, rgba(109, 76, 65, 0.18) ${minPercent}%, var(--color-primary) ${minPercent}%, var(--color-primary) ${maxPercent}%, rgba(109, 76, 65, 0.18) ${maxPercent}%)`;
		},
		init() {
			this.$nextTick(() => this.updateSliderTrack());
			const locationInput = this.$refs.location;
			if (!locationInput) return;

			const syncLocationValue = (value, { name = null, lat = null, lng = null } = {}) => {
				this.form.location = value;
				this.form.locationName = name ?? (value || null);
				this.form.locationLat = lat;
				this.form.locationLng = lng;
				locationInput.value = value ?? '';
			};

			locationInput.addEventListener('input', () => {
				const currentValue = locationInput.value;
				this.form.location = currentValue;
				this.form.locationName = currentValue || null;
				if (!currentValue) {
					this.form.locationLat = null;
					this.form.locationLng = null;
				}
			});

			const mapsKey = window.__GROUP_FORM_MAPS_KEY__;
			if (!mapsKey) {
				console.warn('Google Maps key not configured. Places autocomplete disabled.');
				return;
			}

			window
				.loadGoogleMapsPlaces(mapsKey)
				.then(() => {
					window.initGroupPlacesAutocomplete({
						input: locationInput,
						onPlaceSelected: (place) => {
							const formatted =
								(place && (place.formatted_address || place.name || locationInput.value)) ||
								locationInput.value;
							const geometry = place?.geometry?.location;
							const lat =
								geometry && typeof geometry.lat === 'function' ? geometry.lat() : null;
							const lng =
								geometry && typeof geometry.lng === 'function' ? geometry.lng() : null;
							syncLocationValue(formatted, {
								name: place?.name ?? formatted,
								lat,
								lng
							});
						}
					});
				})
				.catch((error) => {
					console.warn('Não foi possível carregar o Google Places Autocomplete.', error);
				});
		}
	});
})();
