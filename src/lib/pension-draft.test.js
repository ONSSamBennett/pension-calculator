import assert from "node:assert/strict";
import test from "node:test";
import {
	applyDocument,
	createDefaultDraft,
	createDefinedBenefit,
	createDefinedContribution,
	createPersonalSavings,
	createStatePension,
	fromDocument,
	toDocument
} from "./pension-draft.js";
import { definedBenefitResult } from "./defined-benefit.js";
import { definedContributionResult } from "./defined-contribution.js";
import { projectedStatePensionAnnual, statePensionAnnual } from "./state-pension.js";
import { personalSavingsResult } from "./personal-savings.js";

test("default draft round-trips without turning blank fields into zero", () => {
	const initial = createDefaultDraft();
	const document = JSON.parse(JSON.stringify(toDocument(initial)));
	assert.equal(document.formatVersion, 12);
	assert.equal(document.currentAge, 40);
	assert.deepEqual(document.pensions[0], {
		id: 1,
		kind: "statePension",
		name: "State Pension",
		qualifyingYears: 35,
		qualifyingAge: 67,
		annualIncreaseRate: 3.2,
		legacyAmount: null
	});
	assert.equal(document.withdrawals.annualIncome, null);
	assert.ok(!("nextId" in document));
	assert.deepEqual(fromDocument(document), initial);
});

test("State Pension uses qualifying years and caps at 35 years", () => {
	const pension = createStatePension(1);
	assert.equal(statePensionAnnual(pension), 12547.6);
	pension.qualifyingYears = 17;
	assert.ok(Math.abs(statePensionAnnual(pension) - (241.3 / 35) * 17 * 52) < 0.001);
	pension.qualifyingYears = 0;
	assert.equal(statePensionAnnual(pension), 0);
	pension.qualifyingYears = 45;
	assert.equal(statePensionAnnual(pension), 12547.6);
	pension.qualifyingYears = "";
	assert.throws(() => statePensionAnnual(pension), /qualifying years/);
	pension.qualifyingYears = 35;
	pension.qualifyingAge = 0;
	assert.throws(() => statePensionAnnual(pension), /qualifying age/);
});

test("State Pension increase compounds to qualifying age and preserves edits", () => {
	const pension = createStatePension(1);
	assert.ok(Math.abs(projectedStatePensionAnnual(pension, 40) - 12547.6 * 1.032 ** 27) < 0.01);
	pension.annualIncreaseRate = 0;
	assert.equal(projectedStatePensionAnnual(pension, 40), 12547.6);
	pension.annualIncreaseRate = 3.2;
	pension.qualifyingAge = 40;
	assert.equal(projectedStatePensionAnnual(pension, 40), 12547.6);
	pension.qualifyingAge = 67;
	pension.annualIncreaseRate = -1;
	assert.throws(() => projectedStatePensionAnnual(pension, 40), /annual State Pension increase/);
	assert.throws(
		() => projectedStatePensionAnnual({ ...pension, annualIncreaseRate: 3.2 }, ""),
		/current age/
	);
	const draft = createDefaultDraft();
	draft.pensions[0].annualIncreaseRate = 4;
	assert.equal(
		fromDocument(JSON.parse(JSON.stringify(toDocument(draft)))).pensions[0].annualIncreaseRate,
		4
	);
});

test("version-ten State Pension imports keep NI inputs and gain the default increase", () => {
	const document = toDocument(createDefaultDraft());
	const { annualIncreaseRate, ...oldState } = document.pensions[0];
	oldState.qualifyingYears = 20;
	const restored = fromDocument({ ...document, formatVersion: 10, pensions: [oldState] });
	assert.equal(restored.pensions[0].qualifyingYears, 20);
	assert.equal(restored.pensions[0].annualIncreaseRate, 3.2);
});

test("legacy State Pension moves first without losing its saved annual amount", () => {
	const draft = createDefaultDraft();
	const file = toDocument(draft);
	const oldFile = {
		...file,
		formatVersion: 9,
		pensions: [
			{ id: 4, kind: "pot", name: "Other pension", amount: 5000 },
			{ id: 9, kind: "statePension", name: "My State Pension", amount: 12000 }
		]
	};
	const restored = fromDocument(oldFile);
	assert.deepEqual(restored.pensions[0], {
		...createStatePension(9),
		name: "My State Pension",
		legacyAmount: 12000
	});
	assert.equal(restored.pensions[1].id, 4);
	assert.equal(restored.nextId, 10);
	assert.equal(toDocument(restored).pensions[0].legacyAmount, 12000);
});

test("current age round-trips and older files restore with the default age", () => {
	const draft = createDefaultDraft();
	draft.currentAge = 53;
	draft.pensions.push({ id: 2, kind: "pot", name: "Unclassified pot", amount: "" });
	draft.pensions.push({ id: 3, kind: "income", name: "Unclassified income", amount: 10000 });
	const document = toDocument(draft);
	assert.equal(fromDocument(document).currentAge, 53);
	assert.equal(document.pensions[1].amount, null);
	const { currentAge, ...oldDocument } = document;
	oldDocument.formatVersion = 1;
	oldDocument.pensions = document.pensions.slice(1);
	assert.equal(fromDocument(oldDocument).currentAge, 40);
	assert.deepEqual(
		fromDocument(oldDocument).pensions.map((pension) => pension.kind),
		["statePension", "pot", "income"]
	);
	assert.throws(() => fromDocument({ ...oldDocument, currentAge: null }));
	assert.deepEqual(
		fromDocument({ ...document, formatVersion: 2, pensions: oldDocument.pensions })
			.pensions.slice(1)
			.map((pension) => pension.kind),
		["pot", "income"]
	);
});

test("filled and partial fields, source IDs and hidden strategy values survive", () => {
	const draft = createDefaultDraft();
	draft.pensions = [
		createStatePension(1),
		{ id: 3, kind: "pot", name: "Workplace", amount: 0 },
		{ id: 8, kind: "income", name: "State pension", amount: "12000" }
	];
	draft.annualIncome = 0;
	draft.retirementAge = 62;
	draft.strategy = "steady";
	draft.withdrawalRate = 4.5;
	const document = JSON.parse(JSON.stringify(toDocument(draft)));
	assert.deepEqual(
		document.pensions.slice(1).map((pension) => pension.amount),
		[0, 12000]
	);
	assert.equal(document.withdrawals.annualIncome, 0);
	assert.equal(document.withdrawals.retirementAge, 62);
	assert.equal(document.withdrawals.withdrawalRate, 4.5);
	assert.deepEqual(fromDocument(document), {
		...draft,
		nextId: 9,
		pensions: [draft.pensions[0], draft.pensions[1], { ...draft.pensions[2], amount: 12000 }]
	});
});

test("restoring an empty list adds the standard state pension", () => {
	const document = toDocument(createDefaultDraft());
	document.pensions = [];
	assert.deepEqual(fromDocument(document).pensions, [createStatePension(1)]);
	assert.equal(fromDocument(document).nextId, 2);
});

test("invalid documents are rejected without changing the current draft", () => {
	const draft = createDefaultDraft();
	draft.pensions.push({ id: 2, kind: "pot", name: "", amount: "" });
	const valid = toDocument(draft);
	const invalid = [
		{ ...valid, formatVersion: 13 },
		{ ...valid, currentAge: 17 },
		{ ...valid, currentAge: 42.5 },
		{
			...valid,
			pensions: [
				{ ...valid.pensions[0], id: 2 },
				{ ...valid.pensions[0], id: 2 }
			]
		},
		{ ...valid, pensions: [{ ...valid.pensions[0], amount: Infinity }] },
		{ ...valid, withdrawals: { ...valid.withdrawals, strategy: "unknown" } },
		{ ...valid, withdrawals: { ...valid.withdrawals, unexpected: true } },
		{ ...valid, extra: "discarded data" },
		{ ...valid, pensions: [{ ...valid.pensions[0], id: Number.MAX_SAFE_INTEGER }] }
	];
	for (const document of invalid) {
		assert.throws(() => applyDocument(draft, document));
		assert.deepEqual(draft.pensions, [
			createStatePension(1),
			{ id: 2, kind: "pot", name: "", amount: "" }
		]);
	}
	assert.throws(() => toDocument({ ...draft, annualIncome: "not a number" }));
});

test("applying a validated document updates the existing draft reference", () => {
	const draft = createDefaultDraft();
	const document = toDocument(draft);
	document.pensions = [{ id: 5, kind: "income", name: "Defined benefit", amount: 5000 }];
	document.withdrawals.strategy = "percentage";
	const existing = draft;
	applyDocument(draft, document);
	assert.equal(draft, existing);
	assert.equal(draft.nextId, 7);
	assert.equal(draft.pensions[0].kind, "statePension");
	assert.equal(draft.pensions[1].name, "Defined benefit");
	assert.equal(draft.strategy, "percentage");
});

test("DB status and CARE modes preserve both active and inactive fields", () => {
	const draft = createDefaultDraft();
	const db = createDefinedBenefit(4);
	assert.equal(db.normalAge, 65);
	assert.equal(db.startAge, 65);
	db.name = "Scheme A";
	db.scheme = "care";
	db.accrualMethod = "yearly";
	db.pensionablePay = 50000;
	db.serviceStartAge = 25;
	db.leaveAge = 60;
	db.earnings = [
		{ year: 2020, pay: 35000 },
		{ year: "", pay: "" }
	];
	db.annualIncome = 12000;
	db.accruedAnnualPension = 7000;
	db.lumpSum = 0;
	draft.pensions.push(db);
	const document = JSON.parse(JSON.stringify(toDocument(draft)));
	assert.deepEqual(document.pensions[1].earnings[1], { year: null, pay: null });
	assert.equal(document.pensions[1].annualIncome, 12000);
	assert.equal(document.pensions[1].accruedAnnualPension, 7000);
	assert.equal(document.pensions[1].lumpSum, 0);
	assert.equal(document.pensions[1].normalAge, 65);
	assert.equal(document.pensions[1].startAge, 65);
	assert.equal(document.pensions[1].serviceStartAge, 25);
	assert.equal(document.pensions[1].leaveAge, 60);
	assert.deepEqual(fromDocument(document).pensions[1], db);
	assert.equal(fromDocument(document).nextId, 5);
	const { accruedAnnualPension, accrualMethod, serviceStartAge, leaveAge, ...oldDb } =
		document.pensions[1];
	for (const version of [2, 3]) {
		const imported = fromDocument({
			...document,
			formatVersion: version,
			pensions: [{ ...oldDb, careMethod: accrualMethod, pastServiceYears: 5 }]
		}).pensions[1];
		assert.deepEqual(imported, {
			...db,
			accruedAnnualPension: "",
			serviceStartAge: "",
			leaveAge: ""
		});
	}
	const importedV4 = fromDocument({
		...document,
		formatVersion: 4,
		pensions: [{ ...oldDb, accruedAnnualPension, accrualMethod, pastServiceYears: 5 }]
	}).pensions[1];
	assert.deepEqual(importedV4, { ...db, serviceStartAge: "", leaveAge: "" });
	const importedV5 = fromDocument({
		...document,
		formatVersion: 5,
		pensions: [{ ...document.pensions[1], pastServiceYears: 5 }]
	}).pensions[1];
	assert.deepEqual(importedV5, db);
	assert.deepEqual(
		fromDocument({ ...document, formatVersion: 6, pensions: [document.pensions[1]] }).pensions[1],
		db
	);
	assert.ok(!("pastServiceYears" in document.pensions[1]));
});

test("an unselected source and each new type survive JSON round trips", () => {
	const draft = createDefaultDraft();
	draft.pensions = [
		createStatePension(1),
		{ id: 2, kind: "unselected", name: "", amount: "" },
		{ ...createDefinedContribution(3), name: "Workplace", existingPot: 150000 },
		{ ...createPersonalSavings(4), name: "ISA", currentBalance: 25000 },
		{ id: 5, kind: "propertyEquity", name: "Home", amount: 100000 }
	];
	const document = JSON.parse(JSON.stringify(toDocument(draft)));
	assert.equal(document.pensions[1].amount, null);
	assert.deepEqual(fromDocument(document), { ...draft, nextId: 6 });
	assert.throws(() => fromDocument({ ...document, formatVersion: 2 }));
});

test("older savings balances migrate without losing zero or blank values", () => {
	const document = toDocument(createDefaultDraft());
	for (const amount of [25000, 0, null]) {
		const restored = fromDocument({
			...document,
			formatVersion: 11,
			pensions: [document.pensions[0], { id: 4, kind: "personalSavings", name: "ISA", amount }]
		});
		assert.deepEqual(restored.pensions[1], {
			...createPersonalSavings(4),
			name: "ISA",
			currentBalance: amount ?? ""
		});
		assert.equal(toDocument(restored).pensions[1].currentBalance, amount);
	}
});

test("savings fields round-trip, while unknown fields and modes are rejected", () => {
	const draft = createDefaultDraft();
	const savings = createPersonalSavings(2);
	Object.assign(savings, {
		contributionFrequency: "weekly",
		contributionAmount: 100,
		endAge: 64,
		customReturnRate: 4.5,
		bonusRate: 25,
		currentBalance: 0
	});
	draft.pensions.push(savings);
	const document = JSON.parse(JSON.stringify(toDocument(draft)));
	assert.equal(document.pensions[1].annualFeeRate, null);
	assert.equal(document.pensions[1].currentBalance, 0);
	assert.deepEqual(fromDocument(document).pensions[1], savings);
	for (const source of [
		{ ...document.pensions[1], contributionFrequency: "daily" },
		{ ...document.pensions[1], returnMode: "unknown" },
		{ ...document.pensions[1], bonusRate: Infinity },
		{ ...document.pensions[1], amount: 1 }
	]) {
		assert.throws(() => applyDocument(draft, { ...document, pensions: [source] }));
		assert.deepEqual(draft.pensions[1], savings);
	}
});

test("savings deposits and bonus arrive at period end and grow until retirement", () => {
	const savings = createPersonalSavings(2);
	Object.assign(savings, {
		currentBalance: 1000,
		contributionAmount: 100,
		endAge: 40,
		bonusRate: 25
	});
	const result = personalSavingsResult(savings, 40, 42);
	assert.equal(result.futureContributions, 100);
	assert.equal(result.futureBonus, 25);
	assert.ok(Math.abs(result.projectedBalance - (1000 * 1.06 ** 2 + 125 * 1.06)) < 0.01);
	assert.ok(
		Math.abs(
			1000 +
				result.futureContributions +
				result.futureBonus +
				result.futureInvestmentGrowth -
				result.futureFeesPaid -
				result.projectedBalance
		) < 0.01
	);
	savings.endAge = 39;
	assert.equal(personalSavingsResult(savings, 40, 42).futureContributions, 0);
	assert.equal(personalSavingsResult(savings, 40, 40).projectedBalance, 1000);
});

test("savings contribution frequency, annual increase, return and fees change projection", () => {
	const savings = createPersonalSavings(2);
	Object.assign(savings, { contributionAmount: 100, endAge: 41, contributionIncreaseRate: 2.5 });
	assert.equal(personalSavingsResult(savings, 40, 42).futureContributions, 202.5);
	savings.contributionFrequency = "monthly";
	assert.ok(Math.abs(personalSavingsResult(savings, 40, 42).futureContributions - 2430) < 0.01);
	const monthly = personalSavingsResult(savings, 40, 42);
	savings.contributionFrequency = "weekly";
	assert.equal(personalSavingsResult(savings, 40, 42).futureContributions, 10530);
	savings.contributionFrequency = "monthly";
	savings.annualFeeRate = 1;
	assert.ok(personalSavingsResult(savings, 40, 42).projectedBalance < monthly.projectedBalance);
	savings.returnMode = "custom";
	savings.customReturnRate = 0;
	savings.annualFeeRate = "";
	assert.ok(Math.abs(personalSavingsResult(savings, 40, 42).projectedBalance - 2430) < 0.01);
	savings.customReturnRate = "";
	assert.throws(() => personalSavingsResult(savings, 40, 42), /custom annual return/);
	savings.returnMode = "optimistic";
	savings.endAge = "";
	assert.throws(() => personalSavingsResult(savings, 40, 42), /age when contributions end/);
	assert.throws(() => personalSavingsResult(savings, 40, 39), /target retirement age/);
});

test("old defined-contribution amounts migrate to a known existing pot", () => {
	const document = toDocument(createDefaultDraft());
	const legacy = {
		...document,
		formatVersion: 6,
		pensions: [{ id: 7, kind: "definedContribution", name: "Old scheme", amount: 0 }]
	};
	for (const version of [3, 4, 5, 6]) {
		legacy.formatVersion = version;
		const restored = fromDocument(legacy);
		assert.deepEqual(restored.pensions[1], {
			...createDefinedContribution(7),
			name: "Old scheme",
			existingPot: 0
		});
		assert.equal(restored.nextId, 9);
	}
	legacy.pensions[0].amount = null;
	assert.equal(fromDocument(legacy).pensions[1].existingPot, "");
});

test("DC defaults, inactive custom return, and yearly pay survive JSON round trips", () => {
	const draft = createDefaultDraft();
	const dc = createDefinedContribution(2);
	assert.equal(dc.employeeRate, 5);
	assert.equal(dc.employerRate, 3);
	assert.equal(dc.annualFeeRate, 0.3);
	assert.equal(dc.returnMode, "balanced");
	dc.startAge = 38;
	dc.endAge = 44;
	dc.pastPotMethod = "known";
	dc.existingPot = 0;
	dc.customReturnRate = 4.5;
	dc.earnings = [{ year: "", pay: "" }];
	draft.pensions.push(dc);
	const document = JSON.parse(JSON.stringify(toDocument(draft)));
	assert.equal(document.pensions[1].startAge, 38);
	assert.equal(document.pensions[1].endAge, 44);
	assert.equal(document.pensions[1].existingPot, 0);
	assert.equal(document.pensions[1].annualFeeRate, 0.3);
	assert.equal(document.pensions[1].earnings[0].pay, null);
	assert.deepEqual(fromDocument(document).pensions[1], dc);
	assert.throws(() =>
		fromDocument({
			...document,
			pensions: [document.pensions[0], { ...document.pensions[1], returnMode: "unknown" }]
		})
	);
	assert.throws(() =>
		fromDocument({
			...document,
			pensions: [document.pensions[0], { ...document.pensions[1], unexpected: true }]
		})
	);
});

test("version-seven contribution years are kept without guessing ages", () => {
	const draft = createDefaultDraft();
	const dc = createDefinedContribution(2);
	Object.assign(dc, { startYear: 2024, endYear: 2030, existingPot: 10000 });
	draft.pensions.push(dc);
	const file = toDocument(draft);
	const { startAge, endAge, annualFeeRate, ...oldDc } = file.pensions[1];
	const restored = fromDocument({ ...file, formatVersion: 7, pensions: [oldDc] }).pensions[1];
	assert.equal(restored.annualFeeRate, 0.3);
	assert.equal(restored.startAge, "");
	assert.equal(restored.endAge, "");
	assert.equal(restored.startYear, 2024);
	assert.equal(restored.endYear, 2030);
	assert.throws(
		() => definedContributionResult(restored, 40, 42, 2026),
		/age when contributions began/
	);
	assert.deepEqual(
		fromDocument(JSON.parse(JSON.stringify(toDocument({ ...draft, pensions: [restored] }))))
			.pensions[1],
		restored
	);
	const versionEight = fromDocument({
		...file,
		formatVersion: 8,
		pensions: [{ ...oldDc, startAge: 38, endAge: 44 }]
	}).pensions[1];
	assert.equal(versionEight.annualFeeRate, 0.3);
	assert.equal(versionEight.startAge, 38);
});

test("DC return presets and custom percentage compound annually", () => {
	const dc = createDefinedContribution(1);
	Object.assign(dc, { startAge: 40, endAge: 41, pensionablePay: 100000 });
	dc.annualFeeRate = 0;
	assert.deepEqual(definedContributionResult(dc, 40, 42, 2026), {
		existingPot: 0,
		pastContributions: 0,
		futureContributions: 16000,
		futureInvestmentGrowth: 480,
		futureFeesPaid: 0,
		investmentGrowth: 480,
		projectedPot: 16480,
		valuationYear: 2028,
		returnRate: 6
	});
	dc.returnMode = "cautious";
	assert.equal(definedContributionResult(dc, 40, 42, 2026).projectedPot, 16240);
	dc.returnMode = "optimistic";
	assert.equal(definedContributionResult(dc, 40, 42, 2026).projectedPot, 16720);
	dc.returnMode = "custom";
	dc.customReturnRate = -2;
	assert.equal(definedContributionResult(dc, 40, 42, 2026).projectedPot, 15840);
	dc.customReturnRate = "";
	assert.throws(() => definedContributionResult(dc, 40, 42, 2026), /custom annual return/);
});

test("DC entered pot does not reapply past returns", () => {
	const dc = createDefinedContribution(1);
	Object.assign(dc, {
		startAge: 38,
		endAge: 41,
		pensionablePay: 100000,
		annualFeeRate: 0,
		existingPot: 10000,
		earnings: [{ year: 2024, pay: 1 }]
	});
	const result = definedContributionResult(dc, 40, 42, 2026);
	assert.equal(result.existingPot, 10000);
	assert.equal(result.pastContributions, 0);
	assert.equal(result.futureContributions, 16000);
	assert.ok(Math.abs(result.projectedPot - 27716) < 0.01);
});

test("DC estimated and year-by-year past pots match with constant pay", () => {
	const dc = createDefinedContribution(1);
	Object.assign(dc, {
		startAge: 38,
		endAge: 39,
		pensionablePay: 100000,
		annualFeeRate: 0,
		pastPotMethod: "estimate"
	});
	const estimated = definedContributionResult(dc, 40, 40, 2026);
	assert.equal(estimated.pastContributions, 16000);
	assert.equal(estimated.projectedPot, 16480);
	dc.pastPotMethod = "yearly";
	dc.earnings = [
		{ year: 2024, pay: 100000 },
		{ year: 2025, pay: 100000 }
	];
	assert.deepEqual(definedContributionResult(dc, 40, 40, 2026), estimated);
	dc.earnings[1].year = 2024;
	assert.throws(() => definedContributionResult(dc, 40, 40, 2026), /distinct/);
});

test("DC future-only jobs begin contributions at the chosen calendar year", () => {
	const dc = createDefinedContribution(1);
	Object.assign(dc, {
		startAge: 42,
		endAge: 43,
		pensionablePay: 100000,
		annualFeeRate: 0,
		payGrowthRate: 10,
		existingPot: 99999,
		pastPotMethod: "known"
	});
	const result = definedContributionResult(dc, 40, 44, 2026);
	assert.equal(result.existingPot, 0);
	assert.ok(Math.abs(result.projectedPot - 20908.8) < 0.01);
	dc.endAge = 41;
	assert.throws(() => definedContributionResult(dc, 40, 44, 2026), /Last contribution age/);
});

test("DC pot keeps earning returns after contributions stop until retirement", () => {
	const dc = createDefinedContribution(1);
	Object.assign(dc, { startAge: 40, endAge: 41, pensionablePay: 100000 });
	dc.annualFeeRate = 0;
	const result = definedContributionResult(dc, 40, 44, 2026);
	assert.equal(result.existingPot, 0);
	assert.equal(result.futureContributions, 16000);
	assert.ok(Math.abs(result.projectedPot - 16480 * 1.06 ** 2) < 0.01);
	assert.equal(result.valuationYear, 2030);
});

test("DC retirement snapshot excludes contributions in or after the retirement year", () => {
	const dc = createDefinedContribution(1);
	Object.assign(dc, { startAge: 40, endAge: 50, pensionablePay: 100000 });
	dc.annualFeeRate = 0;
	assert.equal(definedContributionResult(dc, 40, 40, 2026).projectedPot, 0);
	const result = definedContributionResult(dc, 40, 42, 2026);
	assert.equal(result.futureContributions, 16000);
	assert.equal(result.projectedPot, 16480);
	assert.throws(() => definedContributionResult(dc, 40, 39, 2026), /target retirement age/);
});

test("DC default 0.3% fee applies to invested pot before year-end contributions", () => {
	const dc = createDefinedContribution(1);
	Object.assign(dc, { startAge: 40, endAge: 41, pensionablePay: 100000 });
	assert.equal(definedContributionResult(dc, 40, 41, 2026).projectedPot, 8000);
	const result = definedContributionResult(dc, 40, 42, 2026);
	assert.ok(Math.abs(result.projectedPot - 16454.56) < 0.01);
	assert.equal(result.futureFeesPaid, 25.44);
	assert.ok(
		Math.abs(
			result.existingPot +
				result.futureContributions +
				result.futureInvestmentGrowth -
				result.futureFeesPaid -
				result.projectedPot
		) < 0.01
	);
	dc.annualFeeRate = -1;
	assert.throws(() => definedContributionResult(dc, 40, 42, 2026), /annual pension fee/);
	dc.annualFeeRate = "";
	assert.throws(() => definedContributionResult(dc, 40, 42, 2026), /annual pension fee/);
});

test("DC estimated past pot includes fees but entered current pot is not charged retrospectively", () => {
	const dc = createDefinedContribution(1);
	Object.assign(dc, {
		startAge: 38,
		endAge: 39,
		pensionablePay: 100000,
		pastPotMethod: "estimate"
	});
	const estimated = definedContributionResult(dc, 40, 40, 2026);
	assert.ok(Math.abs(estimated.existingPot - 16454.56) < 0.01);
	dc.pastPotMethod = "known";
	dc.existingPot = 10000;
	assert.equal(definedContributionResult(dc, 40, 40, 2026).existingPot, 10000);
	assert.ok(Math.abs(definedContributionResult(dc, 40, 41, 2026).projectedPot - 10568.2) < 0.01);
});

test("version-five files derive service from ages instead of a saved year count", () => {
	const draft = createDefaultDraft();
	const db = createDefinedBenefit(2);
	Object.assign(db, {
		serviceStartAge: 20,
		leaveAge: 60,
		pensionablePay: 60000,
		accrualDenominator: 60
	});
	draft.pensions.push(db);
	const current = toDocument(draft);
	const legacy = {
		...current,
		formatVersion: 5,
		pensions: [{ ...current.pensions[1], pastServiceYears: 1 }]
	};
	const restored = fromDocument(legacy).pensions[1];
	assert.ok(!("pastServiceYears" in restored));
	assert.equal(definedBenefitResult(restored, 40, 2026).annualIncome, 40000);
	legacy.pensions[0].pastServiceYears = "invalid";
	assert.throws(() => fromDocument(legacy));
});

test("future DB service ignores inactive past-accrual inputs until work begins", () => {
	const db = createDefinedBenefit(1);
	Object.assign(db, {
		serviceStartAge: 45,
		leaveAge: 55,
		pensionablePay: 60000,
		accrualDenominator: 60,
		accrualMethod: "known",
		accruedAnnualPension: 9000,
		earnings: [{ year: 2020, pay: 10000 }]
	});
	assert.deepEqual(definedBenefitResult(db, 40, 2026), {
		annualIncome: 10000,
		valuationAge: 65,
		estimated: true
	});
	db.accrualMethod = "yearly";
	assert.equal(definedBenefitResult(db, 40, 2026).annualIncome, 10000);
});

test("malformed DB sources never replace the current draft", () => {
	const draft = createDefaultDraft();
	draft.pensions = [createDefinedBenefit(1)];
	const valid = toDocument(draft);
	for (const source of [
		{ ...valid.pensions[0], scheme: "unknown" },
		{ ...valid.pensions[0], earnings: [{ year: 2020, pay: Infinity }] },
		{ ...valid.pensions[0], unused: true }
	]) {
		assert.throws(() => applyDocument(draft, { ...valid, pensions: [source] }));
		assert.deepEqual(draft.pensions, [createDefinedBenefit(1)]);
	}
});

test("final salary estimates service and pay growth without payment-time adjustments", () => {
	const db = createDefinedBenefit(1);
	Object.assign(db, {
		pensionablePay: 60000,
		normalAge: 65,
		startAge: 65,
		serviceStartAge: 20,
		leaveAge: 65,
		accrualDenominator: 60,
		lumpSum: 10000
	});
	assert.deepEqual(definedBenefitResult(db, 40, 2026), {
		annualIncome: 45000,
		valuationAge: 65,
		estimated: true
	});
	assert.equal(definedBenefitResult(db, 41, 2026).annualIncome, 45000);
	db.serviceStartAge = 21;
	assert.equal(definedBenefitResult(db, 40, 2026).annualIncome, 44000);
	db.serviceStartAge = 20;
	db.payGrowthRate = 2;
	db.adjustmentRate = -10;
	assert.ok(Math.abs(definedBenefitResult(db, 40, 2026).annualIncome - 45000 * 1.02 ** 25) < 0.01);
	db.startAge = 39;
	assert.equal(definedBenefitResult(db, 40, 2026).valuationAge, 65);
});

test("CARE quick and yearly estimates match with equal past earnings", () => {
	const db = createDefinedBenefit(1);
	Object.assign(db, {
		scheme: "care",
		pensionablePay: 54000,
		normalAge: 42,
		startAge: 42,
		serviceStartAge: 38,
		leaveAge: 42,
		accrualDenominator: 54,
		revaluationRate: 0
	});
	const quick = definedBenefitResult(db, 40, 2026);
	assert.deepEqual(quick, { annualIncome: 4000, valuationAge: 42, estimated: true });
	db.accrualMethod = "yearly";
	db.earnings = [
		{ year: 2024, pay: 54000 },
		{ year: 2025, pay: 54000 }
	];
	assert.deepEqual(definedBenefitResult(db, 40, 2026), quick);
	db.revaluationRate = 2;
	assert.ok(definedBenefitResult(db, 40, 2026).annualIncome > quick.annualIncome);
	db.earnings[1].year = 2024;
	assert.throws(() => definedBenefitResult(db, 40, 2026), /distinct/);
});

test("final salary year-by-year history uses the latest pay and requires complete service", () => {
	const db = createDefinedBenefit(1);
	Object.assign(db, {
		accrualMethod: "yearly",
		startAge: 42,
		serviceStartAge: 38,
		leaveAge: 42,
		accrualDenominator: 60,
		earnings: [
			{ year: 2024, pay: 30000 },
			{ year: 2025, pay: 52000 }
		]
	});
	assert.ok(Math.abs(definedBenefitResult(db, 40, 2026).annualIncome - (52000 * 4) / 60) < 0.01);
	db.earnings[0].pay = 1000;
	assert.ok(Math.abs(definedBenefitResult(db, 40, 2026).annualIncome - (52000 * 4) / 60) < 0.01);
	db.earnings.pop();
	assert.throws(() => definedBenefitResult(db, 40, 2026), /each completed service year/);
});

test("known accrued pension replaces past-service estimate and adds only future accrual", () => {
	const db = createDefinedBenefit(1);
	Object.assign(db, {
		accrualMethod: "known",
		accruedAnnualPension: 15000,
		pensionablePay: 60000,
		serviceStartAge: 20,
		leaveAge: 65,
		accrualDenominator: 60
	});
	assert.equal(definedBenefitResult(db, 40, 2026).annualIncome, 40000);
	db.startAge = 40;
	db.leaveAge = 40;
	db.pensionablePay = "";
	db.accrualDenominator = "";
	assert.equal(definedBenefitResult(db, 40, 2026).annualIncome, 15000);
	db.accruedAnnualPension = "";
	assert.throws(() => definedBenefitResult(db, 40, 2026), /accrued gross annual pension/);
});

test("known CARE accrual revalues to normal age before adding future accrual", () => {
	const db = createDefinedBenefit(1);
	Object.assign(db, {
		scheme: "care",
		accrualMethod: "known",
		accruedAnnualPension: 2000,
		pensionablePay: 54000,
		serviceStartAge: 38,
		leaveAge: 42,
		accrualDenominator: 54,
		startAge: 42,
		revaluationRate: 2
	});
	const expected = 2000 * 1.02 ** 25 + 1000 * (1.02 ** 24 + 1.02 ** 23);
	assert.ok(Math.abs(definedBenefitResult(db, 40, 2026).annualIncome - expected) < 0.01);
});

test("final-salary accrual stops at leave regardless of saved payment age", () => {
	const db = createDefinedBenefit(1);
	Object.assign(db, {
		serviceStartAge: 20,
		leaveAge: 60,
		startAge: 65,
		pensionablePay: 60000,
		payGrowthRate: 2,
		accrualDenominator: 60
	});
	const expected = (60000 * 1.02 ** 20 * 40) / 60;
	assert.ok(Math.abs(definedBenefitResult(db, 40, 2026).annualIncome - expected) < 0.01);
	db.startAge = 70;
	assert.ok(Math.abs(definedBenefitResult(db, 40, 2026).annualIncome - expected) < 0.01);
	db.leaveAge = 71;
	assert.equal(definedBenefitResult(db, 40, 2026).valuationAge, 71);
});

test("CARE accrual stops at leave but revalues through deferred payment", () => {
	const db = createDefinedBenefit(1);
	Object.assign(db, {
		scheme: "care",
		serviceStartAge: 38,
		leaveAge: 42,
		startAge: 47,
		pensionablePay: 54000,
		accrualDenominator: 54,
		revaluationRate: 2
	});
	const expected = 1000 * (1.02 ** 26 + 1.02 ** 27 + 1.02 ** 24 + 1.02 ** 23);
	assert.ok(Math.abs(definedBenefitResult(db, 40, 2026).annualIncome - expected) < 0.01);
});

test("an already-departed scheme earns no new service or final-salary growth", () => {
	const db = createDefinedBenefit(1);
	Object.assign(db, {
		serviceStartAge: 20,
		leaveAge: 35,
		startAge: 65,
		pensionablePay: 50000,
		accrualDenominator: 60,
		payGrowthRate: 5
	});
	assert.equal(definedBenefitResult(db, 40, 2026).annualIncome, 12500);
	db.leaveAge = 34;
	assert.ok(Math.abs(definedBenefitResult(db, 40, 2026).annualIncome - (50000 * 14) / 60) < 0.01);
});

test("switching methods retains inactive inputs without including them in known accrual", () => {
	const draft = createDefaultDraft();
	const db = createDefinedBenefit(2);
	Object.assign(db, {
		scheme: "care",
		accrualMethod: "known",
		accruedAnnualPension: 6000,
		pensionablePay: 54000,
		accrualDenominator: 54,
		startAge: 40,
		serviceStartAge: 38,
		leaveAge: 40,
		earnings: [
			{ year: 2024, pay: 40000 },
			{ year: 2025, pay: 50000 }
		]
	});
	draft.pensions.push(db);
	const restored = fromDocument(JSON.parse(JSON.stringify(toDocument(draft)))).pensions[1];
	assert.deepEqual(restored, db);
	assert.equal(definedBenefitResult(restored, 40, 2026).annualIncome, 6000);
	restored.accrualMethod = "yearly";
	assert.ok(definedBenefitResult(restored, 40, 2026).annualIncome > 0);
});

test("legacy in-payment fields remain saved but do not affect the scheme estimate", () => {
	const db = createDefinedBenefit(1);
	db.status = "inPayment";
	db.annualIncome = 12000;
	db.serviceStartAge = 20;
	db.leaveAge = 40;
	db.pensionablePay = 60000;
	db.accrualDenominator = 60;
	db.startAge = 40;
	db.adjustmentRate = -20;
	db.lumpSum = 10000;
	assert.deepEqual(definedBenefitResult(db, 40, 2026), {
		annualIncome: 20000,
		valuationAge: 65,
		estimated: true
	});
	db.annualIncome = "";
	assert.equal(definedBenefitResult(db, 40, 2026).annualIncome, 20000);
});
