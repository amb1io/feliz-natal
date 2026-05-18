window.loadGoogleMapsPlaces =
	window.loadGoogleMapsPlaces ||
	function (key) {
		if (!key) {
			return Promise.reject(new Error('Google Maps API key is missing or invalid.'));
		}

		if (window.google && window.google.maps && window.google.maps.places) {
			return Promise.resolve();
		}

		if (window.__googleMapsLoadingPromise) {
			return window.__googleMapsLoadingPromise;
		}

		window.__googleMapsLoadingPromise = new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__initGooglePlaces`;
			script.async = true;
			script.defer = true;
			script.dataset.googleMaps = 'places';

			script.onerror = () => {
				window.__googleMapsLoadingPromise = undefined;
				delete window.__initGooglePlaces;
				script.remove();
				reject(new Error('Falha ao carregar a biblioteca do Google Maps.'));
			};

			window.__initGooglePlaces = () => {
				resolve();
				window.__googleMapsLoadingPromise = undefined;
				delete window.__initGooglePlaces;
			};

			document.head.appendChild(script);
		});

		return window.__googleMapsLoadingPromise;
	};

window.initGroupPlacesAutocomplete =
	window.initGroupPlacesAutocomplete ||
	function ({ input, onPlaceSelected }) {
		if (!input || typeof onPlaceSelected !== 'function') return;

		const autocomplete = new google.maps.places.Autocomplete(input, {
			types: ['establishment'],
			fields: ['formatted_address', 'geometry', 'name', 'place_id']
		});

		autocomplete.addListener('place_changed', () => {
			const place = autocomplete.getPlace();
			onPlaceSelected(place);
		});

		return autocomplete;
	};
