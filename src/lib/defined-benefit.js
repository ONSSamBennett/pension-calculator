function number(value, label, minimum = 0) {
	if (
		value === "" ||
		value === null ||
		value === undefined ||
		(typeof value === "string" && !value.trim())
	) {
		throw new Error(`Enter ${label}`);
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < minimum) throw new Error(`Enter a valid ${label}`);
	return parsed;
}

function age(value, label) {
	const parsed = number(value, label, 18);
	if (!Number.isInteger(parsed) || parsed > 120) throw new Error(`Enter a valid ${label}`);
	return parsed;
}

function yearlyEarnings(pension, currentAge, serviceStartAge, leaveAge, asOfYear, completedYears) {
	if (completedYears === 0) throw new Error("Enter completed service years for yearly pay");
	if (pension.earnings.length !== completedYears)
		throw new Error("Enter pensionable pay for each completed service year");
	const years = new Set();
	let latest = null;
	for (const row of pension.earnings) {
		const year = number(row.year, "earnings year");
		if (
			!Number.isInteger(year) ||
			year > asOfYear - Math.max(0, currentAge - leaveAge) ||
			year < asOfYear - (currentAge - serviceStartAge) ||
			years.has(year)
		) {
			throw new Error("Earnings years must be distinct years in your working lifetime");
		}
		years.add(year);
		const pay = number(row.pay, "pensionable pay for each year");
		if (!latest || year > latest.year) latest = { year, pay };
	}
	return latest;
}

export function definedBenefitResult(pension, currentAge, asOfYear = new Date().getFullYear()) {
	const now = age(currentAge, "current age");
	const serviceStartAge = number(pension.serviceStartAge, "age when eligible service began", 16);
	const leaveAge = age(pension.leaveAge, "age when eligible service ends");
	if (!Number.isInteger(serviceStartAge) || serviceStartAge > 120)
		throw new Error("Enter a valid age when eligible service began");
	const paymentAge = Math.max(now, leaveAge, age(pension.normalAge, "normal scheme pension age"));
	if (leaveAge < serviceStartAge) throw new Error("Leave age must not be before service start age");
	const yearsUntilPayment = paymentAge - now;
	const yearsUntilLeave = Math.max(0, leaveAge - now);
	const futureServiceStart = Math.max(0, serviceStartAge - now);
	const futureServiceYears = Math.max(0, yearsUntilLeave - futureServiceStart);
	const growth = number(pension.payGrowthRate, "annual pay growth", -100) / 100;
	if (pension.scheme !== "finalSalary" && pension.scheme !== "care") {
		throw new Error("Choose a defined-benefit scheme type");
	}
	if (!["estimate", "yearly", "known"].includes(pension.accrualMethod))
		throw new Error("Choose a past accrual method");
	const revaluation =
		pension.scheme === "care"
			? number(pension.revaluationRate, "annual CARE revaluation", -100) / 100
			: 0;
	const completedYears = Math.max(0, Math.min(now, leaveAge) - serviceStartAge);
	const accrualMethod = completedYears ? pension.accrualMethod : "estimate";
	const pastYears = accrualMethod === "known" ? 0 : completedYears;
	const latest =
		accrualMethod === "yearly"
			? yearlyEarnings(pension, now, serviceStartAge, leaveAge, asOfYear, pastYears)
			: null;
	const pay =
		accrualMethod === "yearly"
			? latest
				? latest.pay *
					(1 + growth) ** Math.max(0, Math.min(asOfYear, asOfYear + leaveAge - now) - latest.year)
				: 0
			: futureServiceYears || accrualMethod === "estimate"
				? number(pension.pensionablePay, "current pensionable pay")
				: 0;
	const denominator =
		futureServiceYears || accrualMethod !== "known"
			? number(pension.accrualDenominator, "accrual denominator", 1)
			: 1;
	let pastAccrual = 0;
	if (accrualMethod === "known") {
		const accrued = number(pension.accruedAnnualPension, "accrued gross annual pension");
		pastAccrual =
			accrued *
			(1 + (pension.scheme === "care" ? revaluation : growth)) **
				(pension.scheme === "care" ? yearsUntilPayment : yearsUntilLeave);
	} else if (pension.scheme === "finalSalary") {
		pastAccrual = (pay * (1 + growth) ** yearsUntilLeave * pastYears) / denominator;
	} else if (accrualMethod === "estimate") {
		for (let yearsAgo = 1; yearsAgo <= pastYears; yearsAgo++) {
			pastAccrual +=
				(pay / denominator) *
				(1 + revaluation) ** (yearsAgo + Math.max(0, now - leaveAge) + yearsUntilPayment);
		}
	} else {
		for (const row of pension.earnings) {
			pastAccrual +=
				(number(row.pay, "pensionable pay for each year") / denominator) *
				(1 + revaluation) ** (asOfYear - Number(row.year) + yearsUntilPayment);
		}
	}
	let futureAccrual = 0;
	if (pension.scheme === "finalSalary") {
		futureAccrual = (pay * (1 + growth) ** yearsUntilLeave * futureServiceYears) / denominator;
	} else {
		for (let year = futureServiceStart; year < yearsUntilLeave; year++) {
			futureAccrual +=
				((pay * (1 + growth) ** year) / denominator) *
				(1 + revaluation) ** (yearsUntilPayment - year - 1);
		}
	}

	const annualIncome = pastAccrual + futureAccrual;
	if (!Number.isFinite(annualIncome))
		throw new Error("These assumptions produce an invalid estimate");
	return { annualIncome, valuationAge: paymentAge, estimated: true };
}
