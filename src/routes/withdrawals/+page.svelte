<script>
	import { getContext } from "svelte";
	import { Button, Input, Label, Select } from "flowbite-svelte";
	import { resolve } from "$app/paths";
	import { definedBenefitResult } from "$lib/defined-benefit.js";
	import { definedContributionResult } from "$lib/defined-contribution.js";
	import { personalSavingsResult } from "$lib/personal-savings.js";
	import { propertyEquityResult } from "$lib/property-equity.js";
	import { projectedStatePensionAnnual } from "$lib/state-pension.js";
	import { realTermsValue } from "$lib/real-terms.js";
	import { drawdownResult, drawdownStartingBalance } from "$lib/drawdown.js";
	import { isValidPlanAge, retirementIncomeChartData } from "$lib/retirement-income-chart.js";
	import AnnualIncomeChart from "$lib/AnnualIncomeChart.svelte";
	import PriceDisplaySwitch from "$lib/PriceDisplaySwitch.svelte";
	import DraftFileActions from "$lib/DraftFileActions.svelte";

	const draft = getContext("pension-draft");
	const priceDisplay = getContext("price-display");
	let planUntilInput = $state(String(draft.finalAge));
	const currentYear = new Date().getFullYear();
	const poundsAndPence = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
	const withdrawalMethods = [
		{ name: "Fixed annual amount", value: "amount" },
		{ name: "Percentage of remaining pot", value: "percentage" }
	];
	const drawdownReturnModes = [
		{ name: "Cautious (3%)", value: "cautious" },
		{ name: "Balanced (6%)", value: "balanced" },
		{ name: "Optimistic (9%)", value: "optimistic" },
		{ name: "Custom", value: "custom" }
	];

	function updatePlanUntilAge(event) {
		planUntilInput = event.currentTarget.value;
		const age = Number(planUntilInput);
		if (isValidPlanAge(draft.retirementAge, planUntilInput)) {
			draft.finalAge = age;
		}
	}
	function amountInSelectedTerms(item) {
		return priceDisplay.realTerms
			? realTermsValue(
					item.amount,
					item.valuationAge,
					draft.currentAge,
					draft.settings.annualInflationRate
				)
			: item.amount;
	}

	function formatAmount(item) {
		return poundsAndPence.format(amountInSelectedTerms(item));
	}

	function formatTotal(items) {
		return poundsAndPence.format(
			items.reduce((total, item) => total + amountInSelectedTerms(item), 0)
		);
	}

	function drawdownFor(item) {
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

	function retirementResources() {
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

	const resources = $derived.by(retirementResources);

	function retirementChartData() {
		const pots = resources.pots.map((item) => ({
			name: item.name,
			annualWithdrawals: drawdownFor(item).result?.annualWithdrawals ?? []
		}));
		return retirementIncomeChartData({
			currentAge: draft.currentAge,
			retirementAge: draft.retirementAge,
			finalAge: draft.finalAge,
			incomes: resources.incomes,
			pots,
			targetAnnualIncome: draft.annualIncome,
			realTerms: priceDisplay.realTerms,
			annualInflationRate: draft.settings.annualInflationRate
		});
	}

	const incomeChart = $derived.by(retirementChartData);
</script>

<svelte:head>
	<title>Withdrawals | Pension planner</title>
	<meta name="description" content="Set up a pension withdrawal plan." />
</svelte:head>

<div class="pension-page-heading">
	<p class="pension-step">02 / 02 &nbsp; WITHDRAWALS</p>
	<h1>Plan your withdrawals</h1>
	<p>Set your retirement time horizon and annual income target.</p>
	<DraftFileActions />
</div>

<div class="pension-page-price-display">
	<PriceDisplaySwitch bind:realTerms={priceDisplay.realTerms} />
	<p>
		Real terms uses {draft.settings.annualInflationRate}% annual inflation to express future values
		in today's prices.
	</p>
</div>

<div class="pension-workspace">
	<section aria-labelledby="withdrawals-heading" class="pension-content">
		<div class="pension-section-heading">
			<div>
				<h2 id="withdrawals-heading">Drawdown assumptions</h2>
				<p>Choose a time horizon and set an annual income target.</p>
			</div>
		</div>
		<div class="pension-fields pension-withdrawal-fields">
			<div>
				<Label for="retirement-age">Retirement age</Label>
				<Input
					id="retirement-age"
					type="number"
					min="18"
					max="120"
					bind:value={draft.retirementAge}
				/>
			</div>
			<div>
				<Label for="final-age">Plan until age</Label>
				<Input
					id="final-age"
					type="number"
					min={Number(draft.retirementAge) + 1}
					max="120"
					value={planUntilInput}
					oninput={updatePlanUntilAge}
				/>
				{#if !isValidPlanAge(draft.retirementAge, planUntilInput)}
					<p class="pension-error">
						Enter a whole-number plan age greater than retirement age and no more than 120.
					</p>
				{/if}
			</div>
			<div>
				<Label for="annual-income">Target annual income (£, today's prices)</Label>
				<Input id="annual-income" type="number" min="0" step="1" bind:value={draft.annualIncome} />
			</div>
		</div>
		<section
			class="pension-result pension-retirement-summary"
			aria-labelledby="retirement-resources-heading"
		>
			<h3 id="retirement-resources-heading">Retirement resources</h3>
			<p class="pension-resource-note">
				{#if priceDisplay.realTerms}
					Values are shown in today's prices, adjusted for {draft.settings.annualInflationRate}%
					annual inflation until each source's valuation age.
				{:else}
					Values are shown in actual prices at each source's valuation age.
				{/if}
				Income sources show when payments are expected to start. Property equity is listed separately
				and is not treated as spendable income.
			</p>
			<div class="pension-resource-groups">
				<section class="pension-resource-group" aria-labelledby="income-sources-heading">
					<h4 id="income-sources-heading">Annual income</h4>
					<strong class="pension-resource-total">Total: {formatTotal(resources.incomes)}</strong>
					{#if resources.incomes.length}
						<ul class="pension-resource-list">
							{#each resources.incomes as item (item.id)}
								<li>
									<span>{item.name}<small>{item.detail}</small></span><strong
										>{formatAmount(item)}</strong
									>
								</li>
							{/each}
						</ul>
					{:else}
						<p>No annual income estimates are available.</p>
					{/if}
				</section>
				<section class="pension-resource-group" aria-labelledby="pot-sources-heading">
					<h4 id="pot-sources-heading">Pension and savings pots</h4>
					<strong class="pension-resource-total">Total: {formatTotal(resources.pots)}</strong>
					{#if resources.pots.length}
						<ul class="pension-resource-list">
							{#each resources.pots as item (item.id)}
								{@const drawdown = drawdownFor(item)}
								<li class="pension-resource-pot-item">
									<div class="pension-resource-pot-header">
										<span>{item.name}<small>{item.detail}</small></span><strong
											>{formatAmount(item)}</strong
										>
									</div>
									<div class="pension-drawdown">
										<h5>Quick drawdown</h5>
										<div class="pension-fields pension-drawdown-fields">
											<div>
												<Label for={`drawdown-age-${item.id}`}>Start drawing at age</Label>
												<Input
													id={`drawdown-age-${item.id}`}
													type="number"
													min={draft.currentAge}
													max="120"
													step="1"
													bind:value={item.pension.drawdown.startAge}
												/>
											</div>
											<div>
												<Label for={`drawdown-method-${item.id}`}>Withdrawal method</Label>
												<Select
													id={`drawdown-method-${item.id}`}
													items={withdrawalMethods}
													bind:value={item.pension.drawdown.withdrawalMethod}
												/>
											</div>
											{#if item.pension.drawdown.withdrawalMethod === "amount"}
												<div>
													<Label for={`drawdown-amount-${item.id}`}
														>Annual withdrawal (£, today's prices)</Label
													>
													<Input
														id={`drawdown-amount-${item.id}`}
														type="number"
														min="0"
														step="1"
														bind:value={item.pension.drawdown.annualAmount}
													/>
												</div>
											{:else}
												<div>
													<Label for={`drawdown-rate-${item.id}`}>Annual withdrawal (%)</Label>
													<Input
														id={`drawdown-rate-${item.id}`}
														type="number"
														min="0"
														max="100"
														step="0.1"
														bind:value={item.pension.drawdown.withdrawalRate}
													/>
												</div>
											{/if}
											<div>
												<Label for={`drawdown-return-${item.id}`}>Expected annual return</Label>
												<Select
													id={`drawdown-return-${item.id}`}
													items={drawdownReturnModes}
													bind:value={item.pension.drawdown.returnMode}
												/>
											</div>
											{#if item.pension.drawdown.returnMode === "custom"}
												<div>
													<Label for={`drawdown-custom-${item.id}`}>Custom annual return (%)</Label>
													<Input
														id={`drawdown-custom-${item.id}`}
														type="number"
														min="-100"
														max="100"
														step="0.1"
														bind:value={item.pension.drawdown.customReturnRate}
													/>
												</div>
											{/if}
										</div>
										<p class="pension-drawdown-note">
											Fixed withdrawals are entered in today's prices and rise by {draft.settings
												.annualInflationRate}% each year in the nominal simulation. Returns apply to
											the remaining balance between annual withdrawals. The estimate runs through
											your plan age.
										</p>
										{#if drawdown.result}
											<p class="pension-drawdown-result" aria-live="polite">
												{#if drawdown.result.dryAge !== null}
													Pot runs dry at age {drawdown.result.dryAge}.
												{:else}
													Pot lasts through age {draft.finalAge}.
												{/if}
											</p>
										{:else}
											<p class="pension-drawdown-result" aria-live="polite">{drawdown.message}</p>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p>No pension or savings pots are available.</p>
					{/if}
				</section>
				<section class="pension-resource-group" aria-labelledby="property-sources-heading">
					<h4 id="property-sources-heading">Property equity</h4>
					<strong class="pension-resource-total">Total: {formatTotal(resources.property)}</strong>
					{#if resources.property.length}
						<ul class="pension-resource-list">
							{#each resources.property as item (item.id)}
								<li>
									<span>{item.name}<small>{item.detail}</small></span><strong
										>{formatAmount(item)}</strong
									>
								</li>
							{/each}
						</ul>
					{:else}
						<p>No property equity estimate is available.</p>
					{/if}
				</section>
			</div>
			{#if resources.incomplete.length}
				<div class="pension-resource-incomplete">
					<h4>Sources needing more information</h4>
					<ul>
						{#each resources.incomplete as item (item.id)}
							<li><strong>{item.name}:</strong> {item.error}.</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	</section>

	<aside class="pension-aside">
		<p class="pension-aside-label">INCOME PROJECTION</p>
		<h2>Annual retirement income</h2>
		<AnnualIncomeChart
			ages={incomeChart.ages}
			series={incomeChart.series}
			targetValues={incomeChart.targetValues}
		/>
		<p class="pension-chart-note">
			{priceDisplay.realTerms ? "Real terms use today's prices." : "Values shown in actual prices."}
			{#if incomeChart.targetValues}
				Dashed line shows your target in today's prices, uprated by {draft.settings
					.annualInflationRate}% for actual prices.
			{/if}
		</p>
		<hr class="pension-projection-divider" />
		<p class="pension-aside-label">PROJECTION</p>
		<h2>Your drawdown plan</h2>
		<p class="pension-muted">
			A drawdown projection will appear here once withdrawal calculations are agreed.
		</p>
		<Button tag="a" href={resolve("/")} color="green" class="pension-action"
			>Back to pensions</Button
		>
	</aside>
</div>
