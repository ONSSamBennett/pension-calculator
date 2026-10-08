export const DEFAULT_INFLATION_RATE = 2.5;

export function realTermsValue(
	amount,
	valuationAge,
	currentAge,
	annualInflationRate = DEFAULT_INFLATION_RATE
) {
	const value = Number(amount);
	const years = Number(valuationAge) - Number(currentAge);
	const inflation = Number(annualInflationRate);
	if (
		!Number.isFinite(value) ||
		!Number.isFinite(years) ||
		!Number.isFinite(inflation) ||
		inflation < 0
	) {
		throw new Error("Enter valid values for a real-terms calculation");
	}
	return value / (1 + inflation / 100) ** Math.max(0, years);
}

export function realTermsFlowTotal(
	flows,
	amountField,
	currentAge,
	annualInflationRate = DEFAULT_INFLATION_RATE
) {
	return flows.reduce(
		(total, flow) =>
			total + realTermsValue(flow[amountField], flow.age, currentAge, annualInflationRate),
		0
	);
}

export function realTermsResidualGrowth({
	endingBalance,
	valuationAge,
	openingBalance,
	currentAge,
	inflows,
	outflows,
	annualInflationRate = DEFAULT_INFLATION_RATE
}) {
	const realInflows = inflows.reduce(
		(total, flow) =>
			total + realTermsFlowTotal(flow.flows, flow.field, currentAge, annualInflationRate),
		0
	);
	const realOutflows = outflows.reduce(
		(total, flow) =>
			total + realTermsFlowTotal(flow.flows, flow.field, currentAge, annualInflationRate),
		0
	);
	return (
		realTermsValue(endingBalance, valuationAge, currentAge, annualInflationRate) -
		realTermsValue(openingBalance, currentAge, currentAge, annualInflationRate) -
		realInflows +
		realOutflows
	);
}
