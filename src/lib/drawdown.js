import { DEFAULT_INFLATION_RATE } from "./real-terms.js";

const returnRates = { cautious: 3, balanced: 6, optimistic: 9 };

function number(value, label, minimum = 0, maximum = Infinity) {
	if (
		value === "" ||
		value === null ||
		value === undefined ||
		(typeof value === "string" && !value.trim())
	) {
		throw new Error(`Enter ${label}`);
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
		throw new Error(`Enter a valid ${label}`);
	}
	return parsed;
}

function age(value, label, minimum = 18) {
	const parsed = number(value, label, minimum, 120);
	if (!Number.isInteger(parsed)) throw new Error(`Enter a whole-number ${label}`);
	return parsed;
}

export function drawdownReturnRate(options) {
	if (!Object.hasOwn(returnRates, options.returnMode) && options.returnMode !== "custom") {
		throw new Error("Choose an expected drawdown return");
	}
	return (
		(options.returnMode === "custom"
			? number(options.customReturnRate, "custom annual drawdown return", -100, 100)
			: returnRates[options.returnMode]) / 100
	);
}

export function drawdownStartingBalance(balance, currentAge, startAge, options) {
	const current = age(currentAge, "current age");
	const start = age(startAge, "drawdown start age", current);
	const initialBalance = number(balance, "starting pot");
	return initialBalance * (1 + drawdownReturnRate(options)) ** (start - current);
}

export function drawdownResult(
	startingBalance,
	options,
	currentAge,
	finalAge,
	annualInflationRate = DEFAULT_INFLATION_RATE
) {
	const current = age(currentAge, "current age");
	const start = age(options.startAge, "drawdown start age", current);
	const end = age(finalAge, "plan end age", start);
	const balanceAtStart = number(startingBalance, "starting pot");
	const annualReturn = drawdownReturnRate(options);
	if (options.withdrawalMethod !== "amount" && options.withdrawalMethod !== "percentage") {
		throw new Error("Choose a withdrawal amount or percentage");
	}
	const withdrawal =
		options.withdrawalMethod === "amount"
			? number(options.annualAmount, "annual withdrawal amount", Number.EPSILON)
			: number(options.withdrawalRate, "annual withdrawal percentage", Number.EPSILON, 100) / 100;

	let balance = balanceAtStart;
	let totalWithdrawals = 0;
	let dryAge = balance <= 0 ? start : null;
	const annualWithdrawals = [];
	for (let year = start; year <= end && dryAge === null; year++) {
		const amount =
			options.withdrawalMethod === "amount"
				? Math.min(
						balance,
						withdrawal * (1 + annualInflationRate / 100) ** Math.max(0, year - current)
					)
				: balance * withdrawal;
		annualWithdrawals.push({ age: year, amount });
		balance -= amount;
		totalWithdrawals += amount;
		if (balance <= 0) {
			balance = 0;
			dryAge = year;
			break;
		}
		if (year < end) balance *= 1 + annualReturn;
	}
	if (!Number.isFinite(balance) || !Number.isFinite(totalWithdrawals)) {
		throw new Error("These assumptions produce an invalid drawdown projection");
	}
	return {
		startingBalance: balanceAtStart,
		totalWithdrawals,
		endingBalance: balance,
		dryAge,
		annualWithdrawals
	};
}
