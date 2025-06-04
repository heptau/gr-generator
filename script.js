// Globální proměnné, které se inicializují v initializeElements()
let mainDisplayCanvas, mainDisplayCtx, ecInput, fgColorInput, bgColorInput, diagnosticMessageContainer, qrTypeSelect, dynamicFormFieldsContainer, downloadPngButton;
const dpr = window.devicePixelRatio || 1;

const qrCodeTypes = {
	text: {
		label: "Text",
		fields: [{ name: "textContent", label: "Text", type: "textarea", placeholder: "Váš text zde...", rows: 4 }],
		formatter: (data) => data.textContent || ""
	},
	url: {
		label: "URL Adresa",
		fields: [{ name: "url", label: "URL", type: "url", placeholder: "https://www.priklad.cz", inputmode: "url" }],
		formatter: (data) => {
			let url = data.url || "";
			// Jednoduché přidání http:// pokud chybí protokol a není to jiný známý typ URI
			if (url && !/^[a-zA-Z]+:\/\//.test(url) && url.includes('.')) {
				url = 'http://' + url;
			}
			return url;
		}
	},
	wifi: {
		label: "Wi-Fi Připojení",
		fields: [
			{ name: "ssid", label: "Název sítě (SSID)", type: "text", placeholder: "MojeDomaciWiFi" },
			{ name: "password", label: "Heslo", type: "password", placeholder: "HesloKWiFi", inputmode: "text" }, // inputmode text pro viditelnost znaků při psaní na některých mobilech
			{
				name: "encryption", label: "Šifrování", type: "select", options: [
					{ value: "WPA", text: "WPA/WPA2/WPA3" }, // WPA zahrnuje WPA2 i WPA3 v mnoha čtečkách
					{ value: "WEP", text: "WEP" },
					{ value: "nopass", text: "Žádné (Otevřená)" }
				], defaultValue: "WPA"
			},
			{ name: "hiddenSSID", label: "Skrytá síť (SSID)", type: "checkbox", defaultValue: false }
		],
		formatter: (data) => {
			let wifiString = `WIFI:T:${data.encryption || 'nopass'};S:${data.ssid || ''};`;
			if (data.encryption !== "nopass" && data.password) {
				// Speciální znaky v hesle a SSID by měly být escapovány: \, ;, ,, ", :
				const escapeWifiValue = (val) => val.replace(/([\\;,":])/g, '\\$1');
				wifiString += `P:${escapeWifiValue(data.password)};`;
			}
			if (data.hiddenSSID) {
				wifiString += `H:true;`;
			}
			wifiString += ";"; // Dvě středníky na konci specifikace
			return wifiString;
		}
	},
	geo: {
		label: "Geolokace",
		fields: [
			{ name: "latitude", label: "Zem. šířka", type: "number", placeholder: "např. 50.07553", step: "any", inputmode: "decimal" },
			{ name: "longitude", label: "Zem. délka", type: "number", placeholder: "např. 14.43780", step: "any", inputmode: "decimal" },
			{ name: "actionGetCurrentPosition", type: "button", text: "Zjistit moji polohu", onClickFunction: "getCurrentGeolocation" }
		],
		formatter: (data) => (data.latitude && data.longitude) ? `geo:${data.latitude},${data.longitude}` : ""
	},
	email: {
		label: "E-mail",
		fields: [
			{ name: "emailTo", label: "Adresát (To)", type: "email", placeholder: "prijemce@example.com", inputmode: "email" },
			{ name: "emailSubject", label: "Předmět", type: "text", placeholder: "Předmět e-mailu" },
			{ name: "emailBody", label: "Tělo zprávy", type: "textarea", placeholder: "Text vašeho e-mailu...", rows: 3 }
		],
		formatter: (data) => {
			let mailtoString = `mailto:${data.emailTo || ''}`;
			const params = [];
			if (data.emailSubject) params.push(`subject=${encodeURIComponent(data.emailSubject)}`);
			if (data.emailBody) params.push(`body=${encodeURIComponent(data.emailBody)}`);
			if (params.length > 0) mailtoString += `?${params.join('&')}`;
			return mailtoString;
		}
	},
	tel: {
		label: "Telefonní číslo",
		fields: [
			{ name: "phoneNumber", label: "Telefonní číslo", type: "tel", placeholder: "+420123456789", inputmode: "tel" }
		],
		formatter: (data) => data.phoneNumber ? `tel:${data.phoneNumber.replace(/\s+/g, '')}` : "" // Odstranit mezery
	},
	sms: {
		label: "SMS zpráva",
		fields: [
			{ name: "smsTo", label: "Číslo příjemce", type: "tel", placeholder: "+420123456789", inputmode: "tel" },
			{ name: "smsBody", label: "Text SMS", type: "textarea", placeholder: "Text vaší SMS zprávy...", rows: 3 }
		],
		formatter: (data) => {
			const number = data.smsTo ? data.smsTo.replace(/\s+/g, '') : "";
			const body = data.smsBody || "";
			return number ? `SMSTO:${number}:${encodeURIComponent(body)}` : (body ? `SMSTO::${encodeURIComponent(body)}` : "");
		}
	},
	spayd: {
		label: "QR Platba (CZ - SPAYD)",
		fields: [
			{ name: "spayd_iban", label: "IBAN (ACC)", type: "text", placeholder: "CZ12345678901234567890", inputmode: "text", pattern: "[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}" },
			{ name: "spayd_amount", label: "Částka (AM)", type: "number", placeholder: "123.45", step: "0.01", inputmode: "decimal" },
			{ name: "spayd_currency", label: "Měna (CC)", type: "text", value: "CZK", readonly: true },
			{ name: "spayd_vs", label: "Var. symb. (X-VS)", type: "text", placeholder: "Max 10 čísel", inputmode: "numeric", maxLength: 10 },
			{ name: "spayd_ks", label: "Konst. symb. (X-KS)", type: "text", placeholder: "Max 4 čísla", inputmode: "numeric", maxLength: 4 },
			{ name: "spayd_ss", label: "Spec. symb. (X-SS)", type: "text", placeholder: "Max 10 čísel", inputmode: "numeric", maxLength: 10 },
			{ name: "spayd_message", label: "Zpráva (MSG)", type: "text", placeholder: "Platba za...", maxLength: 60 },
			{ name: "spayd_date", label: "Datum splat. (DT)", type: "date" },
		],
		formatter: (data) => {
			let spaydString = "SPD*1.0";
			const appendIfPresent = (tag, value, isNumericOnly = false, maxLength = 0) => {
				if (value !== undefined && value !== null && String(value).trim() !== "") {
					let val = String(value).trim();
					if (isNumericOnly) val = val.replace(/[^0-9]/g, '');
					if (maxLength > 0 && val.length > maxLength) val = val.substring(0, maxLength);
					if (val) spaydString += `*${tag}:${val.toUpperCase()}`;
				}
			};
			const appendAmount = (tag, value) => {
				if (value !== undefined && value !== null && String(value).trim() !== "") {
					const numValue = parseFloat(value);
					if (!isNaN(numValue)) {
						spaydString += `*${tag}:${numValue.toFixed(2)}`;
					}
				}
			};

			appendIfPresent("ACC", data.spayd_iban ? data.spayd_iban.replace(/\s+/g, '').toUpperCase() : null);
			appendAmount("AM", data.spayd_amount);
			appendIfPresent("CC", data.spayd_currency || "CZK");
			appendIfPresent("X-VS", data.spayd_vs, true, 10);
			appendIfPresent("X-KS", data.spayd_ks, true, 4);
			appendIfPresent("X-SS", data.spayd_ss, true, 10);
			appendIfPresent("MSG", data.spayd_message, false, 60);
			if (data.spayd_date) {
				try {
					const date = new Date(data.spayd_date);
					if (!isNaN(date.getTime())) { // Ověření platnosti data
						const year = date.getFullYear();
						const month = (date.getMonth() + 1).toString().padStart(2, '0');
						const day = date.getDate().toString().padStart(2, '0');
						appendIfPresent("DT", `${year}${month}${day}`);
					}
				} catch (e) { console.warn("Neplatný formát data pro SPAYD DT:", data.spayd_date); }
			}
			return spaydString.includes("*ACC:") && spaydString.length > "SPD*1.0*ACC:".length ? spaydString : "";
		}
	},
	sepa: {
		label: "SEPA Platba (EUR)",
		fields: [
			{ name: "sepa_name", label: "Jméno příjemce", type: "text", placeholder: "Název Firmy s.r.o.", maxLength: 70 },
			{ name: "sepa_iban", label: "IBAN příjemce", type: "text", placeholder: "DE12345678901234567890", inputmode: "text", pattern: "[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}" },
			{ name: "sepa_bic", label: "BIC (SWIFT)", type: "text", placeholder: "BANKDEFFXXX", inputmode: "text", pattern: "[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?", maxLength: 11 },
			{ name: "sepa_amount", label: "Částka", type: "number", placeholder: "100.00", step: "0.01", inputmode: "decimal" },
			{ name: "sepa_currency", label: "Měna", type: "text", value: "EUR", readonly: true },
			{ name: "sepa_reference", label: "Reference (Účel)", type: "text", placeholder: "Faktura 123", maxLength: 140 }, // Variabilní symbol nebo jiná reference
			{ name: "sepa_message", label: "Zpráva (Pozn.)", type: "text", placeholder: "Poznámka k platbě", maxLength: 140 }
		],
		formatter: (data) => {
			const serviceTag = "BCD";
			const version = "002";
			const characterSet = "1"; // UTF-8
			const identification = "SCT";

			const bic = data.sepa_bic ? data.sepa_bic.toUpperCase().replace(/\s+/g, '') : "";
			const name = data.sepa_name || ""; // Max 70 znaků
			const iban = data.sepa_iban ? data.sepa_iban.toUpperCase().replace(/\s+/g, '') : "";
			let amount = "";
			if (data.sepa_amount) {
				const numValue = parseFloat(data.sepa_amount);
				if (!isNaN(numValue) && numValue > 0) { // Částka musí být kladná
					amount = numValue.toFixed(2);
				}
			}
			const currency = data.sepa_currency || "EUR";
			const remittanceInfo = data.sepa_reference || ""; // Účel platby / Reference (max 140 chars)
			const purposeCode = ""; // Volitelné (např. SALA, PENS, ...)
			const unstructuredRemittanceInfo = data.sepa_message || ""; // Zpráva příjemci (max 140 chars)

			if (!iban || !name || !amount || !bic || currency !== "EUR") {
				return "";
			}

			const lines = [
				serviceTag, version, characterSet, identification, bic,
				name.substring(0, 70), // Omezení délky
				iban,
				currency + amount,
				purposeCode,
				remittanceInfo.substring(0, 140),
				unstructuredRemittanceInfo.substring(0, 140),
				"" // Některé specifikace vyžadují prázdný řádek na konci pro Beneficiary reference, zde necháme prázdné
			];
			return lines.join("\n");
		}
	}
};

function getCurrentGeolocation() {
	if (navigator.geolocation) {
		diagnosticMessageContainer.innerHTML = "<p>Zjišťuji polohu...</p>";
		navigator.geolocation.getCurrentPosition(
			(position) => {
				const latField = document.getElementById('field-latitude');
				const lonField = document.getElementById('field-longitude');
				if (latField) latField.value = position.coords.latitude.toFixed(6);
				if (lonField) lonField.value = position.coords.longitude.toFixed(6);
				diagnosticMessageContainer.innerHTML = "<p style='color:green;'>Poloha zjištěna!</p>";
				updateQR();
				setTimeout(() => { if (diagnosticMessageContainer) diagnosticMessageContainer.innerHTML = ""; }, 3000);
			},
			(error) => {
				let msg = "Chyba při zjišťování polohy: ";
				switch (error.code) {
					case error.PERMISSION_DENIED: msg += "Přístup k poloze byl odepřen."; break;
					case error.POSITION_UNAVAILABLE: msg += "Informace o poloze nejsou dostupné."; break;
					case error.TIMEOUT: msg += "Vypršel čas pro zjištění polohy."; break;
					default: msg += "Neznámá chyba."; break;
				}
				console.error(msg, error);
				diagnosticMessageContainer.innerHTML = `<p>${msg}</p>`; // Odebráno ID diagnosticMessage, styly jsou přes p
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
		);
	} else {
		diagnosticMessageContainer.innerHTML = "<p>Geolokace není tímto prohlížečem podporována.</p>";
	}
}
window.getCurrentGeolocation = getCurrentGeolocation;

function renderQrTypeForm(typeKey) {
	dynamicFormFieldsContainer.innerHTML = '';
	const typeConfig = qrCodeTypes[typeKey];
	if (!typeConfig) { updateQR(); return; }

	const fieldset = document.createElement('fieldset');
	fieldset.className = 'control-group';

	typeConfig.fields.forEach(field => {
		const row = document.createElement('div');
		row.className = 'form-row';

		if (field.type === "button") {
			const button = document.createElement('button');
			button.type = "button";
			button.textContent = field.text;
			button.className = "small-action-button";
			if (field.onClickFunction && typeof window[field.onClickFunction] === 'function') {
				button.addEventListener('click', window[field.onClickFunction]);
			}
			row.style.justifyContent = 'center'; // Centruje tlačítko v řádku
			row.appendChild(button);
		} else if (field.type === "checkbox") {
			const label = document.createElement('label');
			label.htmlFor = `field-${field.name}`;
			label.textContent = field.label; // Bez dvojtečky, label vlevo
			// label.style.flexGrow = "1"; // Toto je nyní v CSS pro specifičtější selektor
			row.appendChild(label);

			const inputElement = document.createElement('input');
			inputElement.type = "checkbox";
			inputElement.id = `field-${field.name}`;
			inputElement.name = field.name;
			inputElement.checked = field.defaultValue === true;

			// Styly pro checkbox jsou nyní v CSS, zde pouze event listener
			inputElement.addEventListener('change', updateQR);
			row.appendChild(inputElement);
		} else {
			const label = document.createElement('label');
			label.htmlFor = `field-${field.name}`;
			label.textContent = field.label + ":";
			row.appendChild(label);

			let inputElement;
			if (field.type === "textarea") {
				inputElement = document.createElement('textarea');
				inputElement.rows = field.rows || 3;
			} else if (field.type === "select") {
				inputElement = document.createElement('select');
				field.options.forEach(opt => {
					const option = document.createElement('option');
					option.value = opt.value;
					option.textContent = opt.text;
					if (opt.value === field.defaultValue) option.selected = true;
					inputElement.appendChild(option);
				});
			} else {
				inputElement = document.createElement('input');
				inputElement.type = field.type;
				if (field.step) inputElement.step = field.step;
				if (field.maxLength) inputElement.maxLength = field.maxLength;
				if (field.pattern) inputElement.pattern = field.pattern;
				if (field.value) inputElement.value = field.value;
				if (field.readonly) inputElement.readOnly = true;
			}
			inputElement.id = `field-${field.name}`;
			inputElement.name = field.name;
			inputElement.placeholder = field.placeholder || "";
			if (field.inputmode) inputElement.inputMode = field.inputmode;

			inputElement.addEventListener('input', updateQR);
			row.appendChild(inputElement);
		}
		fieldset.appendChild(row);
	});
	dynamicFormFieldsContainer.appendChild(fieldset);
	updateQR();
}

function getCurrentQrDataString() {
	const selectedType = qrTypeSelect.value;
	const typeConfig = qrCodeTypes[selectedType];
	if (!typeConfig) return "";

	const formData = {};
	typeConfig.fields.forEach(field => {
		if (field.type === "button") return;
		const inputElement = document.getElementById(`field-${field.name}`);
		if (inputElement) {
			formData[field.name] = (field.type === "checkbox") ? inputElement.checked : inputElement.value;
		} else {
			formData[field.name] = (field.type === "checkbox") ? false : '';
		}
	});
	return typeConfig.formatter(formData);
}

function initializeElements() {
	mainDisplayCanvas = document.getElementById('qrCanvas');
	mainDisplayCtx = mainDisplayCanvas.getContext('2d');
	ecInput = document.getElementById('ecLevel');
	fgColorInput = document.getElementById('fgColor');
	bgColorInput = document.getElementById('bgColor');
	diagnosticMessageContainer = document.getElementById('diagnosticMessageContainer');
	qrTypeSelect = document.getElementById('qrTypeSelect');
	dynamicFormFieldsContainer = document.getElementById('dynamic-form-fields-container');
	downloadPngButton = document.getElementById('downloadPngButton');

	// Nastavení DPI pro canvas, aby byl ostrý na retina displejích
	// Velikost canvasu je nyní lépe řízena CSS (max-width, aspect-ratio)
	// Je důležité, aby `mainDisplayCanvas.width` a `mainDisplayCanvas.height` (atributy)
	// byly nastaveny na pixelovou velikost, zatímco CSS řídí zobrazenou velikost.
	const style = getComputedStyle(mainDisplayCanvas);
	const cssWidth = parseFloat(style.width) || 220; // Fallback, pokud CSS není ještě aplikováno
	const cssHeight = parseFloat(style.height) || 220;

	mainDisplayCanvas.width = cssWidth * dpr;
	mainDisplayCanvas.height = cssHeight * dpr;
	mainDisplayCtx.scale(dpr, dpr);
}

function generateQRForDisplay(dataString, ecLevel, fgHex, bgHex) {
	if (typeof QRCode === 'undefined') { console.error("G_QR: QRCode N/A"); return; }
	if (!mainDisplayCtx || !mainDisplayCanvas) { return; }

	// Použijeme CSS rozměry pro kreslení, protože context je již škálovaný pomocí DPR
	const cssWidth = mainDisplayCanvas.width / dpr;
	const cssHeight = mainDisplayCanvas.height / dpr;

	mainDisplayCtx.fillStyle = bgHex; mainDisplayCtx.fillRect(0, 0, cssWidth, cssHeight); // Kreslíme na plnou "CSS" velikost

	// Velikost QR kódu by měla být menší než canvas, aby byl nějaký okraj, pokud není margin:0
	// Zde QRCode.toCanvas nastavuje vlastní margin, takže můžeme použít téměř plnou velikost
	const qrDrawSize = Math.min(cssWidth, cssHeight); // Velikost pro QRCode.toCanvas

	if (qrDrawSize <= 0) { console.warn("generateQRForDisplay: qrDrawSize neplatná:", qrDrawSize); return; }

	const opts = {
		errorCorrectionLevel: ecLevel,
		width: qrDrawSize, // QRCode.toCanvas použije toto jako cílovou šířku vč. marginu
		margin: 2, // Počet modulů pro okraj (quiet zone)
		color: { dark: fgHex, light: bgHex }
	};

	// Kreslíme na dočasný canvas, protože QRCode.toCanvas přebírá kontrolu nad cílovým canvasem
	// a my chceme QR kód vycentrovat. Alternativně můžeme nechat QRCode.toCanvas kreslit přímo,
	// pokud jeho chování s marginem je vyhovující.
	const tempCanvas = document.createElement('canvas');

	QRCode.toCanvas(tempCanvas, dataString || " ", opts, function (error) {
		if (error) {
			console.error("Chyba generování QR:", error);
			// Zobrazit chybovou zprávu uživateli, pokud je datastring prázdný nebo příliš dlouhý
			if (dataString.length === 0) {
				mainDisplayCtx.font = `${14 * dpr}px Arial`; // Velikost písma násobená dpr
				mainDisplayCtx.fillStyle = "#AAAAAA";
				mainDisplayCtx.textAlign = "center";
				mainDisplayCtx.fillText("Zadejte data pro QR kód", cssWidth / 2, cssHeight / 2);
			}
			return;
		}
		// Vyčistit hlavní canvas (již uděláno výše)
		// mainDisplayCtx.fillStyle = bgHex; mainDisplayCtx.fillRect(0, 0, cssWidth, cssHeight);

		// Vypočítat pozici pro centrování tempCanvas na mainDisplayCanvas
		// tempCanvas.width a tempCanvas.height jsou pixelové rozměry vygenerovaného QR
		const x = (cssWidth - (tempCanvas.width / dpr)) / 2; // Dělíme dpr, protože tempCanvas není škálovaný
		const y = (cssHeight - (tempCanvas.height / dpr)) / 2;

		mainDisplayCtx.drawImage(tempCanvas, x, y, tempCanvas.width / dpr, tempCanvas.height / dpr);
	});
}


function updateQR() {
	if (typeof QRCode === 'undefined' || !qrTypeSelect || !ecInput || !fgColorInput || !bgColorInput) {
		console.warn("updateQR: Některé elementy nejsou připraveny nebo QRCode není definováno.");
		// Je možné, že initializeElements() ještě neproběhlo nebo selhalo.
		// Můžeme zkusit inicializovat znovu, pokud je to bezpečné.
		if (!mainDisplayCanvas && document.readyState === 'complete') {
			console.log("Pokouším se o re-inicializaci prvků v updateQR.");
			initializeElements();
			if (!mainDisplayCanvas) { // Pokud stále nejsou, tak je problém
				console.error("Re-inicializace prvků v updateQR selhala.");
				return;
			}
		} else if (!mainDisplayCanvas) {
			return; // Ještě není čas
		}
	}
	const dataString = getCurrentQrDataString();
	generateQRForDisplay(dataString, ecInput.value, fgColorInput.value, bgColorInput.value);
}

async function createExportableQrCanvas(dataString, ecLevel, fgColorHex, bgColorHex) {
	const qrModuleSizeInPixels = 8; const quietZoneModules = 2;
	if (typeof QRCode === 'undefined') { throw new Error("QRCode N/A pro export."); }
	const qrObject = await QRCode.create(dataString || " ", { errorCorrectionLevel: ecLevel });
	const numModules = qrObject.modules.size; const qrData = qrObject.modules.data;
	const qrContentSize = numModules * qrModuleSizeInPixels; const quietZoneInPixels = quietZoneModules * qrModuleSizeInPixels; const imageSize = qrContentSize + (2 * quietZoneInPixels);
	const exportCanvas = document.createElement('canvas'); exportCanvas.width = imageSize; exportCanvas.height = imageSize;
	const eCtx = exportCanvas.getContext('2d', { alpha: false });
	eCtx.fillStyle = bgColorHex; eCtx.fillRect(0, 0, imageSize, imageSize);
	eCtx.fillStyle = fgColorHex;
	for (let y = 0; y < numModules; y++) { for (let x = 0; x < numModules; x++) { const dataIndex = y * numModules + x; if (qrData[dataIndex] === 1) { eCtx.fillRect(quietZoneInPixels + (x * qrModuleSizeInPixels), quietZoneInPixels + (y * qrModuleSizeInPixels), qrModuleSizeInPixels, qrModuleSizeInPixels); } } }
	return exportCanvas;
}

async function handleDownloadPNG() {
	try {
		const dataString = getCurrentQrDataString();
		// Jednoduchá kontrola, zda je co generovat. Prázdný string by měl vygenerovat QR pro mezeru.
		// Ale pro uživatele je lepší dát varování, pokud jsou všechna pole prázdná.
		let isEmptyInput = false;
		if (!dataString || dataString.trim() === "" || dataString === "SMSTO::" || dataString === "mailto:" || dataString === "geo:," || dataString === "SPD*1.0" || dataString.startsWith("WIFI:T:nopass;S:;;")) {
			// Specifické kontroly pro prázdné formátované stringy
			const selectedType = qrTypeSelect.value;
			const typeConfig = qrCodeTypes[selectedType];
			if (typeConfig && typeConfig.fields.length > 0) { // Pokud jsou definovaná pole
				isEmptyInput = typeConfig.fields.every(field => {
					if (field.type === 'button') return true;
					const el = document.getElementById(`field-${field.name}`);
					if (!el) return true; // Pole neexistuje
					if (field.type === "checkbox") return !el.checked; // Prázdné, pokud není zaškrtnuto (může být sporné, záleží na logice)
					// Pro ostatní typy, pokud je hodnota prázdná nebo jen mezery
					return !el.value || el.value.trim() === "";
				});
			} else { // Pokud nejsou definovaná pole (např. Text by mohl být prázdný)
				isEmptyInput = !dataString || dataString.trim() === "";
			}
		}

		if (isEmptyInput) {
			alert("Nelze generovat QR kód pro prázdný vstup. Vyplňte prosím alespoň jedno relevantní pole pro vybraný typ obsahu.");
			return;
		}

		const exportCanvas = await createExportableQrCanvas(dataString, ecInput.value, fgColorInput.value, bgColorInput.value);
		const link = document.createElement('a');
		link.download = `qrcode_${qrTypeSelect.value}_${Date.now()}.png`;
		link.href = exportCanvas.toDataURL('image/png');
		link.click();
	} catch (error) { alert("Chyba při generování PNG: " + error.message); console.error("Chyba v handleDownloadPNG:", error); }
}

function checkInitialDiacritics() {
	// Tato funkce se zdá být placeholder nebo pro jiný účel, teď jen čistí zprávy.
	if (diagnosticMessageContainer) diagnosticMessageContainer.innerHTML = "";
}

function appInit() {
	initializeElements();
	checkInitialDiacritics();

	qrTypeSelect.addEventListener('change', (event) => {
		renderQrTypeForm(event.target.value);
	});
	renderQrTypeForm(qrTypeSelect.value); // Prvotní renderování formuláře pro výchozí typ

	ecInput.addEventListener('change', updateQR);
	fgColorInput.addEventListener('input', updateQR); // Input je lepší pro color pickery (reaguje ihned)
	bgColorInput.addEventListener('input', updateQR);
	if (downloadPngButton) {
		downloadPngButton.addEventListener('click', handleDownloadPNG);
	}

	// Resize listener pro případnou úpravu DPI canvasu, pokud se změní velikost okna
	let resizeTimeout;
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(() => {
			// Je důležité reinicializovat prvky, které mohou záviset na velikosti okna,
			// zejména canvas a jeho DPI scaling.
			initializeElements();
			updateQR();
		}, 250); // Debounce, aby se nespouštělo příliš často
	});
	console.log("Aplikace inicializována.");
	updateQR(); // Zavoláme updateQR i po inicializaci pro zobrazení výchozího QR
}

let attempts = 0; const maxAttempts = 25;
function waitForLibraries() {
	if (typeof QRCode !== 'undefined') {
		console.log("Knihovna QRCode úspěšně načtena.");
		appInit();
	} else {
		attempts++;
		if (attempts < maxAttempts) {
			console.log(`Čekání na QRCode... pokus ${attempts}/${maxAttempts}.`);
			setTimeout(waitForLibraries, 200);
		} else {
			console.error("QRCode se nenačetla!");
			if (diagnosticMessageContainer) {
				diagnosticMessageContainer.innerHTML = "<p>Chyba: Klíčová knihovna pro generování QR kódů se nenačetla. Zkuste prosím obnovit stránku.</p>";
			} else {
				alert("Chyba: QRCode knihovna se nenačetla. Obnovte stránku.");
			}
		}
	}
}

// Použijeme DOMContentLoaded pro jistotu, že DOM je připraven před manipulací
// i když script je defer. waitForLibraries pak řeší načtení externí QRCode knihovny.
document.addEventListener('DOMContentLoaded', () => {
	// Přiřazení globálních proměnných pro elementy, které jsou vždy v DOM
	// (ty, které nejsou dynamicky generované)
	// Toto je jen částečná inicializace, plná je v initializeElements()
	qrTypeSelect = document.getElementById('qrTypeSelect');
	ecInput = document.getElementById('ecLevel');
	fgColorInput = document.getElementById('fgColor');
	bgColorInput = document.getElementById('bgColor');
	diagnosticMessageContainer = document.getElementById('diagnosticMessageContainer');
	dynamicFormFieldsContainer = document.getElementById('dynamic-form-fields-container');
	downloadPngButton = document.getElementById('downloadPngButton');
	mainDisplayCanvas = document.getElementById('qrCanvas'); // Canvas je také vždy v DOM

	waitForLibraries();
});
