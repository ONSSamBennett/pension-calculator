export const DEFAULT_INFLATION_RATE = 2.5;

export function realTermsValue(amount, valuationAge, currentAge) {
	const value = Number(amount);
	const years = Number(valuationAge) - Number(currentAge);
	if (!Number.isFinite(value) || !Number.isFinite(years)) {
		throw new Error("Enter valid values for a real-terms calculation");
	}
	return value / (1 + DEFAULT_INFLATION_RATE / 100) ** Math.max(0, years);
}

export function realTermsFlowTotal(flows, amountField, currentAge) {
	return flows.reduce(
		(total, flow) => total + realTermsValue(flow[amountField], flow.age, currentAge),
		0
	);
}

export function realTermsResidualGrowth({
	endingBalance,
	valuationAge,
	openingBalance,
	currentAge,
	inflows,
	outflows
}) {
	const realInflows = inflows.reduce(
		(total, flow) => total + realTermsFlowTotal(flow.flows, flow.field, currentAge),
		0
	);
	const realOutflows = outflows.reduce(
		(total, flow) => total + realTermsFlowTotal(flow.flows, flow.field, currentAge),
		0
	);
	return (
		realTermsValue(endingBalance, valuationAge, currentAge) -
		realTermsValue(openingBalance, currentAge, currentAge) -
		realInflows +
		realOutflows
	);
}
