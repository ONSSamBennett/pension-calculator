export const DEFAULT_INFLATION_RATE = 2.5;

export function realTermsValue(amount, valuationAge, currentAge) {
	const value = Number(amount);
	const years = Number(valuationAge) - Number(currentAge);
	if (!Number.isFinite(value) || !Number.isFinite(years)) {
		throw new Error("Enter valid values for a real-terms calculation");
	}
	return value / (1 + DEFAULT_INFLATION_RATE / 100) ** Math.max(0, years);
}
