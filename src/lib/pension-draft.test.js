import assert from "node:assert/strict";
import test from "node:test";
import { applyDocument, createDefaultDraft, fromDocument, toDocument } from "./pension-draft.js";

test("default draft round-trips without turning blank fields into zero", () => {
	const initial = createDefaultDraft();
	const document = JSON.parse(JSON.stringify(toDocument(initial)));
	assert.equal(document.formatVersion, 1);
	assert.equal(document.pensions[0].amount, null);
	assert.equal(document.withdrawals.annualIncome, null);
	assert.ok(!("nextId" in document));
	assert.deepEqual(fromDocument(document), initial);
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
	const valid = toDocument(draft);
	const invalid = [
		{ ...valid, formatVersion: 2 },
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
		assert.deepEqual(draft, createDefaultDraft());
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
