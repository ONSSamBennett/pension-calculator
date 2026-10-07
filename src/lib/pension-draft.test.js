import assert from "node:assert/strict";
import test from "node:test";
import {
	applyDocument,
	createDefaultDraft,
	createDefinedBenefit,
	fromDocument,
	toDocument
} from "./pension-draft.js";
import { definedBenefitResult } from "./defined-benefit.js";

test("default draft round-trips without turning blank fields into zero", () => {
	const initial = createDefaultDraft();
	const document = JSON.parse(JSON.stringify(toDocument(initial)));
	assert.equal(document.formatVersion, 6);
	assert.equal(document.currentAge, 40);
	assert.deepEqual(document.pensions, []);
	assert.equal(document.withdrawals.annualIncome, null);
	assert.ok(!("nextId" in document));
	assert.deepEqual(fromDocument(document), initial);
});

test("current age round-trips and older files restore with the default age", () => {
	const draft = createDefaultDraft();
	draft.currentAge = 53;
	draft.pensions.push({ id: 1, kind: "pot", name: "Unclassified pot", amount: "" });
	draft.pensions.push({ id: 2, kind: "income", name: "Unclassified income", amount: 10000 });
	const document = toDocument(draft);
	assert.equal(fromDocument(document).currentAge, 53);
	assert.equal(document.pensions[0].amount, null);
	const { currentAge, ...oldDocument } = document;
	oldDocument.formatVersion = 1;
	assert.equal(fromDocument(oldDocument).currentAge, 40);
	assert.deepEqual(
		fromDocument(oldDocument).pensions.map((pension) => pension.kind),
		["pot", "income"]
	);
	assert.throws(() => fromDocument({ ...oldDocument, currentAge: null }));
	assert.deepEqual(fromDocument({ ...document, formatVersion: 2 }).pensions, draft.pensions);
});

test("filled and partial fields, source IDs and hidden strategy values survive", () => {
	const draft = createDefaultDraft();
	draft.pensions = [
		{ id: 3, kind: "pot", name: "Workplace", amount: 0 },
		{ id: 8, kind: "income", name: "State pension", amount: "12000" }
	];
	draft.annualIncome = 0;
	draft.strategy = "steady";
	draft.withdrawalRate = 4.5;
	const document = JSON.parse(JSON.stringify(toDocument(draft)));
	assert.deepEqual(
		document.pensions.map((pension) => pension.amount),
		[0, 12000]
	);
	assert.equal(document.withdrawals.annualIncome, 0);
	assert.equal(document.withdrawals.withdrawalRate, 4.5);
	assert.deepEqual(fromDocument(document), {
		...draft,
		nextId: 9,
		pensions: [draft.pensions[0], { ...draft.pensions[1], amount: 12000 }]
	});
});

test("restoring an empty list keeps the next new source ID valid", () => {
	const document = toDocument(createDefaultDraft());
	document.pensions = [];
	assert.equal(fromDocument(document).nextId, 1);
});

test("invalid documents are rejected without changing the current draft", () => {
	const draft = createDefaultDraft();
	draft.pensions.push({ id: 1, kind: "pot", name: "", amount: "" });
	const valid = toDocument(draft);
	const invalid = [
		{ ...valid, formatVersion: 7 },
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
		assert.deepEqual(draft.pensions, [{ id: 1, kind: "pot", name: "", amount: "" }]);
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
	assert.equal(draft.nextId, 6);
	assert.equal(draft.pensions[0].name, "Defined benefit");
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
	assert.deepEqual(document.pensions[0].earnings[1], { year: null, pay: null });
	assert.equal(document.pensions[0].annualIncome, 12000);
	assert.equal(document.pensions[0].accruedAnnualPension, 7000);
	assert.equal(document.pensions[0].lumpSum, 0);
	assert.equal(document.pensions[0].normalAge, 65);
	assert.equal(document.pensions[0].startAge, 65);
	assert.equal(document.pensions[0].serviceStartAge, 25);
	assert.equal(document.pensions[0].leaveAge, 60);
	assert.deepEqual(fromDocument(document).pensions[0], db);
	assert.equal(fromDocument(document).nextId, 5);
	const { accruedAnnualPension, accrualMethod, serviceStartAge, leaveAge, ...oldDb } =
		document.pensions[0];
	for (const version of [2, 3]) {
		const imported = fromDocument({
			...document,
			formatVersion: version,
			pensions: [{ ...oldDb, careMethod: accrualMethod, pastServiceYears: 5 }]
		}).pensions[0];
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
	}).pensions[0];
	assert.deepEqual(importedV4, { ...db, serviceStartAge: "", leaveAge: "" });
	const importedV5 = fromDocument({
		...document,
		formatVersion: 5,
		pensions: [{ ...document.pensions[0], pastServiceYears: 5 }]
	}).pensions[0];
	assert.deepEqual(importedV5, db);
	assert.ok(!("pastServiceYears" in document.pensions[0]));
});

test("an unselected source and each new type survive JSON round trips", () => {
	const draft = createDefaultDraft();
	draft.pensions = [
		{ id: 1, kind: "unselected", name: "", amount: "" },
		{ id: 2, kind: "definedContribution", name: "Workplace", amount: 150000 },
		{ id: 3, kind: "personalSavings", name: "ISA", amount: 25000 },
		{ id: 4, kind: "statePension", name: "State", amount: 12000 },
		{ id: 5, kind: "propertyEquity", name: "Home", amount: 100000 }
	];
	const document = JSON.parse(JSON.stringify(toDocument(draft)));
	assert.equal(document.pensions[0].amount, null);
	assert.deepEqual(fromDocument(document), { ...draft, nextId: 6 });
	assert.throws(() => fromDocument({ ...document, formatVersion: 2 }));
});

test("version-five files derive service from ages instead of a saved year count", () => {
	const draft = createDefaultDraft();
	const db = createDefinedBenefit(1);
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
		pensions: [{ ...current.pensions[0], pastServiceYears: 1 }]
	};
	const restored = fromDocument(legacy).pensions[0];
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
	const db = createDefinedBenefit(1);
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
	const restored = fromDocument(JSON.parse(JSON.stringify(toDocument(draft)))).pensions[0];
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
