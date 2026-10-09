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

export function personalSavingsResult(
	savings,
	currentAge,
	retirementAge,
	includeFutureFlows = false
) {
	const age = number(currentAge, "current age", 18, 120);
	if (!Number.isInteger(age)) throw new Error("Enter a valid current age");
	const targetAge = number(retirementAge, "target retirement age", age, 120);
	if (!Number.isInteger(targetAge)) throw new Error("Enter a valid target retirement age");
	const startAge =
		savings.startAge === "" || savings.startAge === null || savings.startAge === undefined
			? age
			: number(savings.startAge, "contribution start age", 18, 120);
	if (!Number.isInteger(startAge)) throw new Error("Enter a whole-year contribution start age");
	const endAge =
		savings.endAge === "" ? targetAge : number(savings.endAge, "contribution end age", 18, 120);
	if (!Number.isInteger(endAge)) throw new Error("Enter a whole-year contribution end age");
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
	const hasCurrentBalance =
		savings.currentBalance !== "" &&
		savings.currentBalance !== null &&
		savings.currentBalance !== undefined;
	const currentBalance = optionalNumber(savings.currentBalance, "current balance");
	const count = periods[savings.contributionFrequency];
	const periodReturn = (1 + returnRate) ** (1 / count) - 1;
	const periodFee = 1 - (1 - annualFeeRate) ** (1 / count);
	let estimatedExistingPot = 0;
	if (!hasCurrentBalance) {
		const finalPastContributionAge = Math.min(age - 1, endAge);
		for (
			let contributionAge = startAge;
			contributionAge <= finalPastContributionAge;
			contributionAge++
		) {
			const yearsAgo = age - contributionAge;
			estimatedExistingPot += (count * contributionAmount) / (1 + growthRate) ** yearsAgo;
		}
	}
	const existingPot = hasCurrentBalance ? currentBalance : estimatedExistingPot;
	let projectedBalance = existingPot;
	let futureContributions = 0;
	let futureBonus = 0;
	let futureInvestmentGrowth = 0;
	let futureFeesPaid = 0;
	const futureFlows = [];
	for (let year = 0; year < targetAge - age; year++) {
		const contributionAge = age + year;
		const contribution =
			contributionAge >= startAge && contributionAge <= endAge && startAge <= endAge
				? contributionAmount * (1 + growthRate) ** year
				: 0;
		for (let period = 0; period < count; period++) {
			const gain = projectedBalance * periodReturn;
			const fee = (projectedBalance + gain) * periodFee;
			const bonus = contribution * bonusRate;
			projectedBalance += gain - fee + contribution + bonus;
			futureContributions += contribution;
			futureBonus += bonus;
			futureInvestmentGrowth += gain;
			futureFeesPaid += fee;
			futureFlows.push({
				age: age + year + (period + 1) / count,
				contributions: contribution,
				bonus,
				growth: gain,
				fees: fee
			});
		}
	}
	if (!Number.isFinite(projectedBalance))
		throw new Error("These assumptions produce an invalid projection");
	return {
		projectedBalance,
		existingPot,
		estimatedExistingPot,
		futureContributions,
		futureBonus,
		futureInvestmentGrowth,
		futureFeesPaid,
		...(includeFutureFlows ? { futureFlows } : {})
	};
}
