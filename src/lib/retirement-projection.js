import { definedBenefitResult } from "./defined-benefit.js";
import { definedContributionResult } from "./defined-contribution.js";
import { drawdownResult, drawdownStartingBalance } from "./drawdown.js";
import { personalSavingsResult } from "./personal-savings.js";
import { propertyEquityResult } from "./property-equity.js";
import { realTermsValue } from "./real-terms.js";
import { retirementIncomeChartData } from "./retirement-income-chart.js";
import { projectedStatePensionAnnual } from "./state-pension.js";

export function drawdownFor(item, draft, currentYear) {
	const options = item.pension.drawdown;
	if (options.startAge === "") {
		return {
			message:
				"Enter a start age and withdrawal amount or percentage to see when this pot runs dry."
		};
	}
	try {
		const startAge = Number(options.startAge);
		let startingBalance;
		if (item.pension.kind === "definedContribution") {
			startingBalance = definedContributionResult(
				item.pension,
				draft.currentAge,
				startAge,
				currentYear
			).projectedPot;
		} else if (item.pension.kind === "personalSavings") {
			startingBalance = personalSavingsResult(
				item.pension,
				draft.currentAge,
				startAge
			).projectedBalance;
		} else {
			startingBalance = drawdownStartingBalance(
				item.pension.amount,
				draft.currentAge,
				startAge,
				options
			);
		}
		return {
			result: drawdownResult(
				startingBalance,
				options,
				draft.currentAge,
				draft.finalAge,
				draft.settings.annualInflationRate
			)
		};
	} catch (error) {
		return { message: error.message };
	}
}

export function getRetirementResources(draft, currentYear) {
	const resources = { incomes: [], pots: [], property: [], incomplete: [] };
	const sourceName = (pension, fallback) => pension.name?.trim() || fallback;
	const incomplete = (pension, error) =>
		resources.incomplete.push({
			id: pension.id,
			name: sourceName(pension, "Pension source"),
			error
		});

	for (const pension of draft.pensions) {
		try {
			if (pension.kind === "statePension") {
				resources.incomes.push({
					id: pension.id,
					kind: pension.kind,
					pension,
					name: sourceName(pension, "State Pension"),
					amount: projectedStatePensionAnnual(pension, draft.currentAge),
					valuationAge: Number(pension.qualifyingAge),
					detail: `From age ${pension.qualifyingAge}`
				});
			} else if (pension.kind === "definedBenefit") {
				const result = definedBenefitResult(pension, draft.currentAge, currentYear);
				resources.incomes.push({
					id: pension.id,
					kind: pension.kind,
					name: sourceName(pension, "Defined benefit pension"),
					amount: result.annualIncome,
					valuationAge: result.valuationAge,
					detail: `From age ${result.valuationAge}`
				});
			} else if (pension.kind === "definedContribution") {
				const result = definedContributionResult(
					pension,
					draft.currentAge,
					draft.retirementAge,
					currentYear
				);
				resources.pots.push({
					id: pension.id,
					pension,
					name: sourceName(pension, "Defined contribution pension"),
					amount: result.projectedPot,
					valuationAge: Number(draft.retirementAge),
					detail: `At age ${draft.retirementAge}`
				});
			} else if (
				pension.kind === "personalSavings" &&
				(pension.currentBalance !== "" || pension.contributionAmount !== "")
			) {
				const result = personalSavingsResult(pension, draft.currentAge, draft.retirementAge);
				resources.pots.push({
					id: pension.id,
					pension,
					name: sourceName(pension, "Personal savings"),
					amount: result.projectedBalance,
					valuationAge: Number(draft.retirementAge),
					detail: `At age ${draft.retirementAge}`
				});
			} else if (
				pension.kind === "propertyEquity" &&
				(pension.currentEquity !== "" || pension.remainingMortgage !== "")
			) {
				const result = propertyEquityResult(
					pension,
					draft.currentAge,
					draft.retirementAge,
					draft.settings.annualHousePriceIncreaseRate
				);
				resources.property.push({
					id: pension.id,
					name: sourceName(pension, "Property equity"),
					amount: result.estimatedEquity,
					valuationAge: Number(draft.retirementAge),
					detail: `At age ${draft.retirementAge}`
				});
			} else if (pension.kind === "pot" && pension.amount !== "") {
				resources.pots.push({
					id: pension.id,
					pension,
					name: sourceName(pension, "Previous pension pot"),
					amount: Number(pension.amount),
					valuationAge: Number(draft.retirementAge),
					detail: "Saved amount; no growth projected"
				});
			} else if (pension.kind === "income" && pension.amount !== "") {
				resources.incomes.push({
					id: pension.id,
					kind: pension.kind,
					name: sourceName(pension, "Previous pension income"),
					amount: Number(pension.amount),
					valuationAge: Number(draft.retirementAge),
					detail: "Saved annual amount"
				});
			}
		} catch (error) {
			incomplete(pension, error.message);
		}
	}

	return resources;
}

export function getRetirementIncomeChartData(draft, resources, realTerms, currentYear) {
	const pots = resources.pots.map((item) => ({
		name: item.name,
		annualWithdrawals: drawdownFor(item, draft, currentYear).result?.annualWithdrawals ?? []
	}));
	return retirementIncomeChartData({
		currentAge: draft.currentAge,
		retirementAge: draft.retirementAge,
		finalAge: draft.finalAge,
		incomes: resources.incomes,
		pots,
		targetAnnualIncome: draft.annualIncome,
		realTerms,
		annualInflationRate: draft.settings.annualInflationRate
	});
}
