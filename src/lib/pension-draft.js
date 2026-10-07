export const FORMAT_VERSION = 1;

export function createDefaultDraft() {
	return {
		pensions: [{ id: 1, kind: "pot", name: "", amount: "" }],
		nextId: 2,
		retirementAge: 67,
		finalAge: 95,
		annualIncome: "",
		strategy: "steady",
		withdrawalRate: 4
	};
}

function assertFields(value, fields, label) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
	const actual = Object.keys(value);
	if (actual.length !== fields.length || actual.some((field) => !fields.includes(field))) {
		throw new Error(`${label} has missing or unrecognized fields`);
	}
}

function documentNumber(value, label) {
	if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
		throw new Error(`${label} must be a finite number or null`);
	}
	return value;
}

function formNumber(value, label) {
	if (value === "" || value === null || value === undefined) return null;
	if (typeof value === "string" && value.trim() !== "") value = Number(value);
	return documentNumber(value, label);
}

export function fromDocument(document) {
	assertFields(document, ["formatVersion", "pensions", "withdrawals"], "Document");
	if (document.formatVersion !== FORMAT_VERSION) {
		throw new Error("Unsupported pension draft format version");
	}
	if (!Array.isArray(document.pensions)) throw new Error("Pensions must be an array");
	const ids = new Set();
	let highestId = 0;
	const pensions = document.pensions.map((pension, index) => {
		const label = `Pension ${index + 1}`;
		assertFields(pension, ["id", "kind", "name", "amount"], label);
		if (
			!Number.isSafeInteger(pension.id) ||
			pension.id < 1 ||
			pension.id >= Number.MAX_SAFE_INTEGER ||
			ids.has(pension.id)
		) {
			throw new Error(`${label} must have a unique positive integer ID`);
		}
		ids.add(pension.id);
		highestId = Math.max(highestId, pension.id);
		if (pension.kind !== "pot" && pension.kind !== "income") {
			throw new Error(`${label} has an unknown kind`);
		}
		if (typeof pension.name !== "string") throw new Error(`${label} name must be text`);
		return {
			id: pension.id,
			kind: pension.kind,
			name: pension.name,
			amount: documentNumber(pension.amount, `${label} amount`) ?? ""
		};
	});

	const withdrawal = document.withdrawals;
	assertFields(
		withdrawal,
		["retirementAge", "finalAge", "annualIncome", "strategy", "withdrawalRate"],
		"Withdrawals"
	);
	if (withdrawal.strategy !== "steady" && withdrawal.strategy !== "percentage") {
		throw new Error("Unknown withdrawal strategy");
	}
	return {
		pensions,
		nextId: highestId + 1,
		retirementAge: documentNumber(withdrawal.retirementAge, "Retirement age") ?? "",
		finalAge: documentNumber(withdrawal.finalAge, "Final age") ?? "",
		annualIncome: documentNumber(withdrawal.annualIncome, "Annual income") ?? "",
		strategy: withdrawal.strategy,
		withdrawalRate: documentNumber(withdrawal.withdrawalRate, "Withdrawal rate") ?? ""
	};
}

export function toDocument(draft) {
	const document = {
		formatVersion: FORMAT_VERSION,
		pensions: draft.pensions.map((pension) => ({
			id: pension.id,
			kind: pension.kind,
			name: pension.name,
			amount: formNumber(pension.amount, "Pension amount")
		})),
		withdrawals: {
			retirementAge: formNumber(draft.retirementAge, "Retirement age"),
			finalAge: formNumber(draft.finalAge, "Final age"),
			annualIncome: formNumber(draft.annualIncome, "Annual income"),
			strategy: draft.strategy,
			withdrawalRate: formNumber(draft.withdrawalRate, "Withdrawal rate")
		}
	};
	fromDocument(document);
	return document;
}

export function applyDocument(draft, document) {
	const restored = fromDocument(document);
	Object.assign(draft, restored);
}
