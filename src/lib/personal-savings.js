const returnRates = { cautious: 3, balanced: 6, optimistic: 9 };
const periods = { yearly: 1, monthly: 12, weekly: 52 };

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

function optionalNumber(value, label, maximum = Infinity) {
	return value === "" || value === null || value === undefined
		? 0
		: number(value, label, 0, maximum);
}

export function personalSavingsResult(savings, currentAge, retirementAge) {
	const age = number(currentAge, "current age", 18, 120);
	if (!Number.isInteger(age)) throw new Error("Enter a valid current age");
	const targetAge = number(retirementAge, "target retirement age", age, 120);
	if (!Number.isInteger(targetAge)) throw new Error("Enter a valid target retirement age");
	const endAge =
		savings.endAge === "" ? null : number(savings.endAge, "contribution end age", 18, 120);
	if (endAge !== null && !Number.isInteger(endAge))
		throw new Error("Enter a whole-year contribution end age");
	if (!Object.hasOwn(periods, savings.contributionFrequency))
		throw new Error("Choose a contribution frequency");
	if (!Object.hasOwn(returnRates, savings.returnMode) && savings.returnMode !== "custom") {
		throw new Error("Choose an expected return");
	}
	const returnRate =
		(savings.returnMode === "custom"
			? number(savings.customReturnRate, "custom annual return", -100, 100)
			: returnRates[savings.returnMode]) / 100;
	const annualFeeRate = optionalNumber(savings.annualFeeRate, "annual savings fee", 100) / 100;
	const bonusRate = optionalNumber(savings.bonusRate, "additional bonus", 100) / 100;
	const growthRate =
		number(savings.contributionIncreaseRate, "annual contribution increase", -99.99, 100) / 100;
	const contributionAmount = optionalNumber(savings.contributionAmount, "contribution amount");
	const currentBalance = optionalNumber(savings.currentBalance, "current balance");
	if (contributionAmount > 0 && endAge === null && targetAge > age) {
		throw new Error("Enter the age when contributions end");
	}
	const count = periods[savings.contributionFrequency];
	const periodReturn = (1 + returnRate) ** (1 / count) - 1;
	const periodFee = 1 - (1 - annualFeeRate) ** (1 / count);
	let projectedBalance = currentBalance;
	let futureContributions = 0;
	let futureBonus = 0;
	let futureInvestmentGrowth = 0;
	let futureFeesPaid = 0;
	for (let year = 0; year < targetAge - age; year++) {
		const contribution =
			endAge !== null && age + year <= endAge ? contributionAmount * (1 + growthRate) ** year : 0;
		for (let period = 0; period < count; period++) {
			const gain = projectedBalance * periodReturn;
			const fee = (projectedBalance + gain) * periodFee;
			const bonus = contribution * bonusRate;
			projectedBalance += gain - fee + contribution + bonus;
			futureContributions += contribution;
			futureBonus += bonus;
			futureInvestmentGrowth += gain;
			futureFeesPaid += fee;
		}
	}
	if (!Number.isFinite(projectedBalance))
		throw new Error("These assumptions produce an invalid projection");
	return {
		projectedBalance,
		futureContributions,
		futureBonus,
		futureInvestmentGrowth,
		futureFeesPaid
	};
}
