<script>
	import { getContext } from "svelte";
	import { applyDocument, fromDocument, toDocument } from "$lib/pension-draft.js";
	import { Input, Label } from "flowbite-svelte";
	import PriceDisplaySwitch from "$lib/PriceDisplaySwitch.svelte";

	const draft = getContext("pension-draft");
	let dialogElement = $state();
	let dialogMode = $state("import");
	let jsonUrl = $state("");
	let pendingDocument = $state(null);
	let status = $state({ kind: "idle", message: "Choose a JSON file or check a URL." });
	let validationRun = 0;

	function openImport() {
		dialogMode = "import";
		invalidateCheck();
		jsonUrl = "";
		status = { kind: "idle", message: "Choose a JSON file or check a URL." };
		dialogElement?.showModal();
	}

	function openSettings() {
		dialogMode = "settings";
		dialogElement?.showModal();
	}

	function closeDialog() {
		dialogElement?.close();
	}

	function openSaveError(message) {
		dialogMode = "save";
		status = { kind: "error", message };
		dialogElement?.showModal();
	}

	function invalidateCheck() {
		validationRun += 1;
		pendingDocument = null;
	}

	function updateUrl(event) {
		jsonUrl = event.currentTarget.value;
		invalidateCheck();
		status = { kind: "idle", message: "Check the URL to validate the JSON before importing." };
	}

	function stageDocument(document, source) {
		try {
			fromDocument(document);
			pendingDocument = document;
			status = { kind: "ready", message: `${source} is valid. Ready to import.` };
		} catch (error) {
			pendingDocument = null;
			status = {
				kind: "error",
				message: `Only files exported from Pension planner can be imported. ${error.message}`
			};
		}
	}

	async function checkFile(event) {
		const file = event.currentTarget.files?.[0];
		invalidateCheck();
		if (!file) {
			status = { kind: "idle", message: "Choose a JSON file or check a URL." };
			return;
		}
		const run = validationRun;
		status = { kind: "checking", message: `Checking ${file.name}...` };
		const isJsonFile =
			file.name.toLowerCase().endsWith(".json") ||
			file.type.toLowerCase() === "application/json" ||
			file.type.toLowerCase().endsWith("+json");
		if (!isJsonFile) {
			status = { kind: "error", message: "A JSON file is required." };
			return;
		}
		try {
			const document = JSON.parse(await file.text());
			if (run !== validationRun) return;
			stageDocument(document, file.name);
		} catch {
			if (run === validationRun) {
				status = { kind: "error", message: "The selected file does not contain valid JSON." };
			}
		}
	}

	async function checkUrl() {
		invalidateCheck();
		const run = validationRun;
		let url;
		try {
			url = new URL(jsonUrl.trim());
			if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
		} catch {
			status = { kind: "error", message: "Enter a valid HTTP or HTTPS URL." };
			return;
		}

		status = { kind: "checking", message: "Fetching and checking JSON from the URL..." };
		try {
			const response = await fetch(url, { headers: { Accept: "application/json" } });
			if (!response.ok) throw new Error(`The server returned ${response.status}.`);
			const contentType = response.headers.get("content-type") ?? "";
			if (!/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
				if (run !== validationRun) return;
				status = {
					kind: "error",
					message: `The URL did not return JSON (Content-Type: ${contentType || "missing"}).`
				};
				return;
			}
			let document;
			try {
				document = await response.json();
			} catch {
				if (run === validationRun) {
					status = { kind: "error", message: "The URL response does not contain valid JSON." };
				}
				return;
			}
			if (run !== validationRun) return;
			stageDocument(document, "The URL response");
		} catch (error) {
			if (run === validationRun) {
				status = {
					kind: "error",
					message: `Could not fetch JSON from that URL. Check the address and that the server allows access. ${error.message}`
				};
			}
		}
	}

	function importDraft() {
		if (!pendingDocument) return;
		try {
			applyDocument(draft, pendingDocument);
			closeDialog();
		} catch (error) {
			pendingDocument = null;
			status = {
				kind: "error",
				message: `Only files exported from Pension planner can be imported. ${error.message}`
			};
		}
	}

	function downloadJson(json) {
		const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = "mypension.json";
		document.body.appendChild(link);
		link.click();
		setTimeout(() => {
			link.remove();
			URL.revokeObjectURL(url);
		}, 1000);
	}

	function saveDraft() {
		try {
			const json = `${JSON.stringify(toDocument(draft), null, 2)}\n`;
			downloadJson(json);
		} catch (error) {
			openSaveError(`Unable to download pension data. ${error.message}`);
		}
	}
</script>

<div class="pension-page-actions">
	<button
		class="pension-icon-button"
		type="button"
		aria-label="Import pension data"
		title="Import pension data from a JSON file or URL"
		onclick={openImport}
	>
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M12 15V3m0 0L8 7m4-4 4 4" />
			<path d="M5 14v6h14v-6" />
		</svg>
	</button>
	<button
		class="pension-icon-button"
		type="button"
		aria-label="Save pension data"
		title="Save pension data as a JSON file"
		onclick={saveDraft}
	>
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M12 3v12m0 0 4-4m-4 4-4-4" />
			<path d="M5 14v6h14v-6" />
		</svg>
	</button>
	<button
		class="pension-icon-button"
		type="button"
		aria-label="Settings"
		title="Settings for inflation, house prices, and price display"
		onclick={openSettings}
	>
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
			<path
				d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 1 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 1 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 1 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"
			/>
		</svg>
	</button>
</div>

<dialog class="pension-import-dialog" bind:this={dialogElement}>
	<div class="pension-import-dialog-content">
		<div class="pension-import-dialog-heading">
			<h2>
				{dialogMode === "import"
					? "Import pension data"
					: dialogMode === "settings"
						? "Settings"
						: "Unable to save pension data"}
			</h2>
			<button
				class="pension-icon-button"
				type="button"
				aria-label="Close import dialog"
				title="Close"
				onclick={closeDialog}
			>
				<svg
					viewBox="0 0 24 24"
					aria-hidden="true"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				>
					<path d="m6 6 12 12M18 6 6 18" />
				</svg>
			</button>
		</div>
		{#if dialogMode === "import"}
			<p>Choose a JSON file or enter a URL that returns a Pension planner JSON export.</p>
			<div class="pension-import-field">
				<label for="pension-json-file">JSON file</label>
				<input
					id="pension-json-file"
					type="file"
					accept=".json,application/json"
					onchange={checkFile}
				/>
			</div>
			<div class="pension-import-divider"><span>OR</span></div>
			<div class="pension-import-field">
				<label for="pension-json-url">JSON URL</label>
				<div class="pension-import-url-row">
					<input
						id="pension-json-url"
						type="url"
						value={jsonUrl}
						oninput={updateUrl}
						placeholder="https://example.com/pension-planner.json"
					/>
					<button class="pension-file-secondary-button" type="button" onclick={checkUrl}
						>Check URL</button
					>
				</div>
			</div>
			<p
				class={`pension-import-status pension-import-status-${status.kind}`}
				role="status"
				aria-live="polite"
			>
				{status.message}
			</p>
			<div class="pension-import-actions">
				<button
					class="pension-file-primary-button"
					type="button"
					disabled={!pendingDocument}
					onclick={importDraft}
				>
					Import data
				</button>
				<button class="pension-file-secondary-button" type="button" onclick={closeDialog}
					>Cancel</button
				>
			</div>
		{:else if dialogMode === "settings"}
			<p>
				These assumptions apply across the pension planner and are saved with your pension data.
			</p>
			<div class="pension-fields pension-settings-fields">
				<div>
					<Label for="annual-inflation-rate">Annual inflation rate (%)</Label>
					<Input
						id="annual-inflation-rate"
						type="number"
						min="0"
						max="100"
						step="0.1"
						bind:value={draft.settings.annualInflationRate}
					/>
				</div>
				<div>
					<Label for="annual-house-price-increase">Annual house price increase (%)</Label>
					<Input
						id="annual-house-price-increase"
						type="number"
						min="-99.99"
						max="100"
						step="0.1"
						bind:value={draft.settings.annualHousePriceIncreaseRate}
					/>
				</div>
			</div>
			<div class="pension-settings-price-mode">
				<PriceDisplaySwitch bind:realTerms={draft.settings.realTerms} />
			</div>
			<p class="pension-note">
				Inflation is used for real-term conversions, actual-price uprating, and defaults that track
				inflation. House-price growth applies to all property projections.
			</p>
			<div class="pension-import-actions">
				<button class="pension-file-primary-button" type="button" onclick={closeDialog}>Done</button
				>
			</div>
		{:else}
			<p
				class={`pension-import-status pension-import-status-${status.kind}`}
				role="status"
				aria-live="polite"
			>
				{status.message}
			</p>
			<div class="pension-import-actions">
				<button class="pension-file-secondary-button" type="button" onclick={closeDialog}>
					OK
				</button>
			</div>
		{/if}
	</div>
</dialog>
