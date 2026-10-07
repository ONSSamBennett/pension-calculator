const weeklyFullPension = 241.3;
const fullQualifyingYears = 35;

export function statePensionAnnual(pension) {
	const qualifyingYears = Number(pension.qualifyingYears);
	const qualifyingAge = Number(pension.qualifyingAge);
	if (
		pension.qualifyingYears === "" ||
		pension.qualifyingYears == null ||
		(typeof pension.qualifyingYears === "string" && !pension.qualifyingYears.trim()) ||
		!Number.isInteger(qualifyingYears) ||
		qualifyingYears < 0 ||
		qualifyingYears > 120
	) {
		throw new Error("Enter qualifying years of National Insurance contributions");
	}
	if (
		pension.qualifyingAge === "" ||
		pension.qualifyingAge == null ||
		(typeof pension.qualifyingAge === "string" && !pension.qualifyingAge.trim()) ||
		!Number.isInteger(qualifyingAge) ||
		qualifyingAge < 18 ||
		qualifyingAge > 120
	) {
		throw new Error("Enter a valid estimated qualifying age");
	}
	return (
		(weeklyFullPension / fullQualifyingYears) * Math.min(qualifyingYears, fullQualifyingYears) * 52
	);
}

export function projectedStatePensionAnnual(pension, currentAge) {
	const annualToday = statePensionAnnual(pension);
	const age = Number(currentAge);
	const rate = Number(pension.annualIncreaseRate);
	if (currentAge === "" || currentAge == null || !Number.isInteger(age) || age < 18 || age > 120) {
		throw new Error("Enter a valid current age");
	}
	if (
		pension.annualIncreaseRate === "" ||
		pension.annualIncreaseRate == null ||
		!Number.isFinite(rate) ||
		rate < 0 ||
		rate > 100
	) {
		throw new Error("Enter a valid expected annual State Pension increase");
	}
	return annualToday * (1 + rate / 100) ** Math.max(0, Number(pension.qualifyingAge) - age);
}
