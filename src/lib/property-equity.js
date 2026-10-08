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

function optionalNumber(value, label) {
	return value === "" || value === null || value === undefined ? 0 : number(value, label);
}

export function propertyEquityResult(
	property,
	currentAge,
	retirementAge,
	annualHousePriceIncreaseRate
) {
	const age = number(currentAge, "current age", 18, 120);
	if (!Number.isInteger(age)) throw new Error("Enter a valid current age");
	const targetAge = number(retirementAge, "target retirement age", age, 120);
	if (!Number.isInteger(targetAge)) throw new Error("Enter a valid target retirement age");
	const currentEquity = number(property.currentEquity, "current equity");
	const mortgage = optionalNumber(property.remainingMortgage, "remaining mortgage");
	const monthlyPayment = optionalNumber(property.monthlyEquityPayment, "monthly mortgage payment");
	const annualIncrease =
		number(annualHousePriceIncreaseRate, "annual house price increase", -99.99, 100) / 100;
	if (mortgage > 0 && monthlyPayment <= 0) throw new Error("Enter a monthly mortgage payment");

	let propertyValue = currentEquity + mortgage;
	let remainingMortgage = mortgage;
	let mortgagePaid = 0;
	const monthlyIncrease = (1 + annualIncrease) ** (1 / 12) - 1;
	for (let month = 0; month < (targetAge - age) * 12; month++) {
		propertyValue *= 1 + monthlyIncrease;
		if (remainingMortgage > 0) {
			const payment = Math.min(monthlyPayment, remainingMortgage);
			remainingMortgage -= payment;
			mortgagePaid += payment;
		}
	}
	const estimatedEquity = propertyValue - remainingMortgage;
	if (!Number.isFinite(estimatedEquity))
		throw new Error("These assumptions produce an invalid estimate");
	return { propertyValue, remainingMortgage, mortgagePaid, estimatedEquity };
}
