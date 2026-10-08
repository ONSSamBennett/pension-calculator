import { DEFAULT_INFLATION_RATE, realTermsValue } from "./real-terms.js";

export function isValidPlanAge(retirementAge, planAge) {
	if (
		retirementAge === "" ||
		retirementAge === null ||
		retirementAge === undefined ||
		planAge === "" ||
		planAge === null ||
		planAge === undefined
	) {
		return false;
	}
	const retirement = Number(retirementAge);
	const plan = Number(planAge);
	return (
		Number.isInteger(retirement) &&
		retirement >= 18 &&
		retirement < 120 &&
		Number.isInteger(plan) &&
		plan > retirement &&
		plan <= 120
	);
}

export function retirementIncomeChartData({
	currentAge,
	retirementAge,
	finalAge,
	incomes,
	pots,
	targetAnnualIncome,
	realTerms
}) {
	const current = Number(currentAge);
	const start = Number(retirementAge);
	const end = Number(finalAge);
	if (
		![current, start, end].every(Number.isInteger) ||
		current < 18 ||
		start < current ||
		!isValidPlanAge(retirementAge, finalAge)
	) {
		return { ages: [], series: [], targetValues: null };
	}
	const ages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
	const display = (amount, age) => (realTerms ? realTermsValue(amount, age, current) : amount);
	const series = [];

	for (const income of incomes) {
		const valuationAge = Number(income.valuationAge);
		const annualIncrease =
			income.kind === "statePension"
				? Number(income.pension.annualIncreaseRate) / 100
				: income.kind === "definedBenefit"
					? DEFAULT_INFLATION_RATE / 100
					: 0;
		series.push({
			name: income.name,
			values: ages.map((age) => {
				if (age < valuationAge) return 0;
				const amount = income.amount * (1 + annualIncrease) ** (age - valuationAge);
				return display(amount, age);
			})
		});
	}

	for (const pot of pots) {
		if (!pot.annualWithdrawals?.length) continue;
		const withdrawals = new Map(pot.annualWithdrawals.map((entry) => [entry.age, entry.amount]));
		series.push({
			name: pot.name,
			values: ages.map((age) => display(withdrawals.get(age) ?? 0, age))
		});
	}

	const target =
		targetAnnualIncome === "" || targetAnnualIncome === null || targetAnnualIncome === undefined
			? Number.NaN
			: Number(targetAnnualIncome);
	const targetValues = Number.isFinite(target)
		? ages.map((age) =>
				realTerms
					? target
					: target * (1 + DEFAULT_INFLATION_RATE / 100) ** Math.max(0, age - current)
			)
		: null;
	return { ages, series, targetValues };
}
