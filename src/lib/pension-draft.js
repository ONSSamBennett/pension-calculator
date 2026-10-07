export const FORMAT_VERSION = 13;

const simpleKinds = [
	"pot",
	"income",
	"unselected",
	"definedContribution",
	"personalSavings",
	"statePension",
	"propertyEquity"
];

const dbNumbers = [
	"annualIncome",
	"accruedAnnualPension",
	"pensionablePay",
	"normalAge",
	"startAge",
	"serviceStartAge",
	"leaveAge",
	"accrualDenominator",
	"payGrowthRate",
	"adjustmentRate",
	"lumpSum",
	"revaluationRate"
];

const dcNumbers = [
	"startAge",
	"endAge",
	"startYear",
	"endYear",
	"pensionablePay",
	"payGrowthRate",
	"employeeRate",
	"employerRate",
	"annualFeeRate",
	"existingPot",
	"customReturnRate"
];

const savingsNumbers = [
	"currentBalance",
	"contributionAmount",
	"endAge",
	"contributionIncreaseRate",
	"annualFeeRate",
	"bonusRate",
	"customReturnRate"
];

const propertyEquityNumbers = [
	"currentEquity",
	"annualHousePriceIncreaseRate",
	"remainingMortgage",
	"monthlyEquityPayment"
];

export function createPropertyEquity(id) {
	return {
		id,
		kind: "propertyEquity",
		name: "",
		currentEquity: "",
		annualHousePriceIncreaseRate: 2,
		remainingMortgage: "",
		monthlyEquityPayment: ""
	};
}

export function createPersonalSavings(id) {
	return {
		id,
		kind: "personalSavings",
		name: "",
		currentBalance: "",
		contributionFrequency: "yearly",
		contributionAmount: "",
		endAge: "",
		contributionIncreaseRate: 2.5,
		returnMode: "balanced",
		customReturnRate: "",
		annualFeeRate: "",
		bonusRate: ""
	};
}

export function createDefinedContribution(id) {
	return {
		id,
		kind: "definedContribution",
		name: "",
		startAge: "",
		endAge: "",
		startYear: "",
		endYear: "",
		pensionablePay: "",
		payGrowthRate: 0,
		employeeRate: 5,
		employerRate: 3,
		annualFeeRate: 0.3,
		pastPotMethod: "known",
		existingPot: "",
		earnings: [],
		returnMode: "balanced",
		customReturnRate: ""
	};
}

export function createStatePension(id) {
	return {
		id,
		kind: "statePension",
		name: "State Pension",
		qualifyingYears: 35,
		qualifyingAge: 67,
		annualIncreaseRate: 3.2,
		legacyAmount: ""
	};
}

export function createDefinedBenefit(id) {
	return {
		id,
		kind: "definedBenefit",
		name: "",
		status: "notStarted",
		scheme: "finalSalary",
		accrualMethod: "estimate",
		annualIncome: "",
		accruedAnnualPension: "",
		pensionablePay: "",
		normalAge: 65,
		startAge: 65,
		serviceStartAge: "",
		leaveAge: "",
		accrualDenominator: "",
		payGrowthRate: 0,
		adjustmentRate: 0,
		lumpSum: "",
		revaluationRate: 0,
		earnings: []
	};
}

export function createDefaultDraft() {
	return {
		pensions: [createStatePension(1)],
		nextId: 2,
		currentAge: 40,
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
	const version = document?.formatVersion;
	if (
		version !== 1 &&
		version !== 2 &&
		version !== 3 &&
		version !== 4 &&
		version !== 5 &&
		version !== 6 &&
		version !== 7 &&
		version !== 8 &&
		version !== 9 &&
		version !== 10 &&
		version !== 11 &&
		version !== 12 &&
		version !== FORMAT_VERSION
	) {
		throw new Error("Unsupported pension draft format version");
	}
	assertFields(
		document,
		version === 1
			? ["formatVersion", "pensions", "withdrawals"]
			: ["formatVersion", "currentAge", "pensions", "withdrawals"],
		"Document"
	);
	const currentAge = version === 1 ? 40 : documentNumber(document.currentAge, "Current age");
	if (
		currentAge !== null &&
		(!Number.isInteger(currentAge) || currentAge < 18 || currentAge > 120)
	) {
		throw new Error("Current age must be a whole number between 18 and 120");
	}
	if (!Array.isArray(document.pensions)) throw new Error("Pensions must be an array");
	const ids = new Set();
	let highestId = 0;
	const pensions = document.pensions.map((pension, index) => {
		const label = `Pension ${index + 1}`;
		if (pension === null || typeof pension !== "object") throw new Error(`${label} is invalid`);
		const isDb = version >= 2 && pension.kind === "definedBenefit";
		const isDc = version >= 7 && pension.kind === "definedContribution";
		const isState = version >= 10 && pension.kind === "statePension";
		const isSavings = version >= 12 && pension.kind === "personalSavings";
		const isPropertyEquity = version >= 13 && pension.kind === "propertyEquity";
		assertFields(
			pension,
			isDb
				? version >= 4
					? [
							"id",
							"kind",
							"name",
							"status",
							"scheme",
							"accrualMethod",
							...dbNumbers.filter(
								(field) => version >= 5 || (field !== "serviceStartAge" && field !== "leaveAge")
							),
							...(version < 6 ? ["pastServiceYears"] : []),
							"earnings"
						]
					: [
							"id",
							"kind",
							"name",
							"status",
							"scheme",
							"careMethod",
							...dbNumbers.filter(
								(field) => !["accruedAnnualPension", "serviceStartAge", "leaveAge"].includes(field)
							),
							"pastServiceYears",
							"earnings"
						]
				: isDc
					? [
							"id",
							"kind",
							"name",
							...dcNumbers.filter(
								(field) =>
									(version >= 8 || (field !== "startAge" && field !== "endAge")) &&
									(version >= 9 || field !== "annualFeeRate")
							),
							"pastPotMethod",
							"earnings",
							"returnMode"
						]
					: isSavings
						? ["id", "kind", "name", ...savingsNumbers, "contributionFrequency", "returnMode"]
						: isPropertyEquity
							? ["id", "kind", "name", ...propertyEquityNumbers]
							: isState
								? [
										"id",
										"kind",
										"name",
										"qualifyingYears",
										"qualifyingAge",
										...(version >= 11 ? ["annualIncreaseRate"] : []),
										"legacyAmount"
									]
								: ["id", "kind", "name", "amount"],
			label
		);
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
		if (
			!isDb &&
			!isDc &&
			!isState &&
			!isSavings &&
			!isPropertyEquity &&
			!(version >= 3 ? simpleKinds : ["pot", "income"]).includes(pension.kind)
		) {
			throw new Error(`${label} has an unknown kind`);
		}
		if (typeof pension.name !== "string") throw new Error(`${label} name must be text`);
		if (isDb) {
			if (!["notStarted", "inPayment"].includes(pension.status))
				throw new Error(`${label} status is invalid`);
			if (!["finalSalary", "care"].includes(pension.scheme))
				throw new Error(`${label} scheme is invalid`);
			const accrualMethod = version >= 4 ? pension.accrualMethod : pension.careMethod;
			if (!["estimate", "yearly", ...(version >= 4 ? ["known"] : [])].includes(accrualMethod))
				throw new Error(`${label} past accrual method is invalid`);
			if (!Array.isArray(pension.earnings)) throw new Error(`${label} earnings must be an array`);
			if (version < 6) documentNumber(pension.pastServiceYears, `${label} completed service years`);
			const restored = {
				id: pension.id,
				kind: pension.kind,
				name: pension.name,
				status: pension.status,
				scheme: pension.scheme,
				accrualMethod
			};
			for (const field of dbNumbers)
				restored[field] =
					(version < 4 && field === "accruedAnnualPension") ||
					(version < 5 && (field === "serviceStartAge" || field === "leaveAge"))
						? ""
						: (documentNumber(pension[field], `${label} ${field}`) ?? "");
			restored.earnings = pension.earnings.map((entry) => {
				assertFields(entry, ["year", "pay"], `${label} earnings row`);
				return {
					year: documentNumber(entry.year, "Earnings year") ?? "",
					pay: documentNumber(entry.pay, "Earnings pay") ?? ""
				};
			});
			return restored;
		}
		if (isDc) {
			if (!["known", "estimate", "yearly"].includes(pension.pastPotMethod))
				throw new Error(`${label} has an unknown past-pot method`);
			if (!["cautious", "balanced", "optimistic", "custom"].includes(pension.returnMode))
				throw new Error(`${label} has an unknown return mode`);
			if (!Array.isArray(pension.earnings)) throw new Error(`${label} earnings must be an array`);
			const restored = {
				id: pension.id,
				kind: pension.kind,
				name: pension.name,
				pastPotMethod: pension.pastPotMethod,
				returnMode: pension.returnMode
			};
			for (const field of dcNumbers)
				restored[field] =
					version < 8 && (field === "startAge" || field === "endAge")
						? ""
						: version < 9 && field === "annualFeeRate"
							? 0.3
							: (documentNumber(pension[field], `${label} ${field}`) ?? "");
			restored.earnings = pension.earnings.map((row) => {
				assertFields(row, ["year", "pay"], `${label} earnings row`);
				return {
					year: documentNumber(row.year, "Earnings year") ?? "",
					pay: documentNumber(row.pay, "Earnings pay") ?? ""
				};
			});
			return restored;
		}
		if (isState) {
			return {
				id: pension.id,
				kind: pension.kind,
				name: pension.name,
				qualifyingYears: documentNumber(pension.qualifyingYears, `${label} qualifying years`) ?? "",
				qualifyingAge: documentNumber(pension.qualifyingAge, `${label} qualifying age`) ?? "",
				annualIncreaseRate:
					version >= 11
						? (documentNumber(pension.annualIncreaseRate, `${label} annual increase`) ?? "")
						: 3.2,
				legacyAmount: documentNumber(pension.legacyAmount, `${label} previous amount`) ?? ""
			};
		}
		if (isSavings) {
			if (!["yearly", "monthly", "weekly"].includes(pension.contributionFrequency))
				throw new Error(`${label} has an unknown contribution frequency`);
			if (!["cautious", "balanced", "optimistic", "custom"].includes(pension.returnMode))
				throw new Error(`${label} has an unknown return mode`);
			const restored = {
				id: pension.id,
				kind: pension.kind,
				name: pension.name,
				contributionFrequency: pension.contributionFrequency,
				returnMode: pension.returnMode
			};
			for (const field of savingsNumbers)
				restored[field] = documentNumber(pension[field], `${label} ${field}`) ?? "";
			return restored;
		}
		if (isPropertyEquity) {
			const restored = { id: pension.id, kind: pension.kind, name: pension.name };
			for (const field of propertyEquityNumbers)
				restored[field] = documentNumber(pension[field], `${label} ${field}`) ?? "";
			return restored;
		}
		if (pension.kind === "statePension") {
			return {
				...createStatePension(pension.id),
				name: pension.name,
				legacyAmount: documentNumber(pension.amount, `${label} amount`) ?? ""
			};
		}
		if (pension.kind === "definedContribution") {
			return {
				...createDefinedContribution(pension.id),
				name: pension.name,
				existingPot: documentNumber(pension.amount, `${label} amount`) ?? ""
			};
		}
		if (pension.kind === "personalSavings") {
			return {
				...createPersonalSavings(pension.id),
				name: pension.name,
				currentBalance: documentNumber(pension.amount, `${label} amount`) ?? ""
			};
		}
		if (pension.kind === "propertyEquity") {
			return {
				...createPropertyEquity(pension.id),
				name: pension.name,
				currentEquity: documentNumber(pension.amount, `${label} amount`) ?? ""
			};
		}
		return {
			id: pension.id,
			kind: pension.kind,
			name: pension.name,
			amount: documentNumber(pension.amount, `${label} amount`) ?? ""
		};
	});

	const stateIndex = pensions.findIndex((pension) => pension.kind === "statePension");
	if (stateIndex === -1) {
		pensions.unshift(createStatePension(++highestId));
	} else if (stateIndex > 0) {
		pensions.unshift(pensions.splice(stateIndex, 1)[0]);
	}

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
		currentAge: currentAge ?? "",
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
		currentAge: formNumber(draft.currentAge, "Current age"),
		pensions: draft.pensions.map((pension) => {
			if (pension.kind === "propertyEquity") {
				const entry = { id: pension.id, kind: pension.kind, name: pension.name };
				for (const field of propertyEquityNumbers) entry[field] = formNumber(pension[field], field);
				return entry;
			}
			if (pension.kind === "personalSavings") {
				const entry = {
					id: pension.id,
					kind: pension.kind,
					name: pension.name,
					contributionFrequency: pension.contributionFrequency,
					returnMode: pension.returnMode
				};
				for (const field of savingsNumbers) entry[field] = formNumber(pension[field], field);
				return entry;
			}
			if (pension.kind === "statePension") {
				return {
					id: pension.id,
					kind: pension.kind,
					name: pension.name,
					qualifyingYears: formNumber(pension.qualifyingYears, "Qualifying years"),
					qualifyingAge: formNumber(pension.qualifyingAge, "Qualifying age"),
					annualIncreaseRate: formNumber(
						pension.annualIncreaseRate,
						"Annual State Pension increase"
					),
					legacyAmount: formNumber(pension.legacyAmount, "Previous state pension amount")
				};
			}
			if (pension.kind === "definedContribution") {
				const entry = {
					id: pension.id,
					kind: pension.kind,
					name: pension.name,
					pastPotMethod: pension.pastPotMethod,
					returnMode: pension.returnMode
				};
				for (const field of dcNumbers) entry[field] = formNumber(pension[field], field);
				entry.earnings = pension.earnings.map((row) => ({
					year: formNumber(row.year, "Earnings year"),
					pay: formNumber(row.pay, "Earnings pay")
				}));
				return entry;
			}
			if (pension.kind !== "definedBenefit") {
				return {
					id: pension.id,
					kind: pension.kind,
					name: pension.name,
					amount: formNumber(pension.amount, "Pension amount")
				};
			}
			const entry = {
				id: pension.id,
				kind: pension.kind,
				name: pension.name,
				status: pension.status,
				scheme: pension.scheme,
				accrualMethod: pension.accrualMethod
			};
			for (const field of dbNumbers) entry[field] = formNumber(pension[field], field);
			entry.earnings = pension.earnings.map((row) => ({
				year: formNumber(row.year, "Earnings year"),
				pay: formNumber(row.pay, "Earnings pay")
			}));
			return entry;
		}),
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
