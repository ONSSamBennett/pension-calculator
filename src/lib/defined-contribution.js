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

function year(value, label) {
	const parsed = number(value, label, 1900);
	if (!Number.isInteger(parsed)) throw new Error(`Enter a valid ${label}`);
	return parsed;
}

const returnRates = { cautious: 3, balanced: 6, optimistic: 9 };

export function definedContributionResult(
	pension,
	currentAge,
	retirementAge,
	asOfYear = new Date().getFullYear()
) {
	const age = number(currentAge, "current age", 16, 120);
	if (!Number.isInteger(age)) throw new Error("Enter a valid current age");
	const targetAge = number(retirementAge, "target retirement age", age, 120);
	if (!Number.isInteger(targetAge)) throw new Error("Enter a valid target retirement age");
	const targetYear = asOfYear + targetAge - age;
	const startAge = number(pension.startAge, "age when contributions began", 16, 120);
	const endAge = number(pension.endAge, "age when contributions end", 16, 120);
	if (!Number.isInteger(startAge) || !Number.isInteger(endAge)) {
		throw new Error("Enter whole-year contribution ages");
	}
	if (startAge > endAge) throw new Error("Last contribution age must not precede first age");
	const start = asOfYear + startAge - age;
	const end = asOfYear + endAge - age;
	const employee = number(pension.employeeRate, "employee contribution rate", 0, 100);
	const employer = number(pension.employerRate, "employer contribution rate", 0, 100);
	const contributionRate = (employee + employer) / 100;
	const growth = number(pension.payGrowthRate, "annual pay growth", -99.99, 100) / 100;
	if (!Object.hasOwn(returnRates, pension.returnMode) && pension.returnMode !== "custom") {
		throw new Error("Choose an expected return");
	}
	const returnRate =
		(pension.returnMode === "custom"
			? number(pension.customReturnRate, "custom annual return", -100, 100)
			: returnRates[pension.returnMode]) / 100;
	const feeRate = number(pension.annualFeeRate, "annual pension fee", 0, 100) / 100;
	const pastEnd = Math.min(end, asOfYear - 1);
	const hasPast = start <= pastEnd;
	let existingPot = 0;
	let pastContributions = 0;
	let investmentGrowth = 0;

	if (hasPast) {
		if (pension.pastPotMethod === "known") {
			existingPot = number(pension.existingPot, "current pension pot");
		} else if (pension.pastPotMethod === "estimate" || pension.pastPotMethod === "yearly") {
			let pastPay = new Map();
			if (pension.pastPotMethod === "yearly") {
				if (pension.earnings.length !== pastEnd - start + 1) {
					throw new Error("Enter pensionable pay for each completed contribution year");
				}
				for (const row of pension.earnings) {
					const rowYear = year(row.year, "earnings year");
					if (rowYear < start || rowYear > pastEnd || pastPay.has(rowYear)) {
						throw new Error("Earnings years must be distinct completed contribution years");
					}
					pastPay.set(rowYear, number(row.pay, "annual pensionable pay"));
				}
			}
			const salary =
				pension.pastPotMethod === "estimate"
					? number(pension.pensionablePay, "current pensionable salary")
					: 0;
			for (let contributionYear = start; contributionYear <= pastEnd; contributionYear++) {
				const pay =
					pension.pastPotMethod === "yearly"
						? pastPay.get(contributionYear)
						: salary * (1 + growth) ** (contributionYear - asOfYear);
				const contribution = pay * contributionRate;
				pastContributions += contribution;
				existingPot +=
					contribution * ((1 + returnRate) * (1 - feeRate)) ** (asOfYear - contributionYear - 1);
			}
			investmentGrowth = existingPot - pastContributions;
		} else {
			throw new Error("Choose how to enter your existing pension pot");
		}
	}

	let futureContributions = 0;
	let futureInvestmentGrowth = 0;
	let futureFeesPaid = 0;
	let projectedPot = existingPot;
	let salary;
	for (let contributionYear = asOfYear; contributionYear < targetYear; contributionYear++) {
		let contribution = 0;
		if (contributionYear >= start && contributionYear <= end) {
			salary ??= number(pension.pensionablePay, "current pensionable salary");
			contribution = salary * (1 + growth) ** (contributionYear - asOfYear) * contributionRate;
		}
		const gain = projectedPot * returnRate;
		const fee = (projectedPot + gain) * feeRate;
		projectedPot += gain - fee + contribution;
		futureContributions += contribution;
		futureInvestmentGrowth += gain;
		futureFeesPaid += fee;
		investmentGrowth += gain;
	}
	if (!Number.isFinite(projectedPot) || !Number.isFinite(investmentGrowth)) {
		throw new Error("These assumptions produce an invalid projection");
	}
	return {
		existingPot,
		pastContributions,
		futureContributions,
		futureInvestmentGrowth,
		futureFeesPaid,
		investmentGrowth,
		projectedPot,
		valuationYear: targetYear,
		returnRate: returnRate * 100
	};
}
