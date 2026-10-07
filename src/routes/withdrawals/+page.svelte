<script>
	import { getContext } from "svelte";
	import { Button, Input, Label } from "flowbite-svelte";
	import { resolve } from "$app/paths";
	import { definedBenefitResult } from "$lib/defined-benefit.js";
	import { definedContributionResult } from "$lib/defined-contribution.js";
	import { personalSavingsResult } from "$lib/personal-savings.js";
	import { propertyEquityResult } from "$lib/property-equity.js";
	import { projectedStatePensionAnnual } from "$lib/state-pension.js";
	import { DEFAULT_INFLATION_RATE, realTermsValue } from "$lib/real-terms.js";

	const draft = getContext("pension-draft");
	const currentYear = new Date().getFullYear();
	const poundsAndPence = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
	let showRealTerms = $state(false);

	function amountInSelectedTerms(item) {
		return showRealTerms
			? realTermsValue(item.amount, item.valuationAge, draft.currentAge)
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
						name: sourceName(pension, "State Pension"),
						amount: projectedStatePensionAnnual(pension, draft.currentAge),
						valuationAge: Number(pension.qualifyingAge),
						detail: `From age ${pension.qualifyingAge}`
					});
				} else if (pension.kind === "definedBenefit") {
					const result = definedBenefitResult(pension, draft.currentAge, currentYear);
					resources.incomes.push({
						id: pension.id,
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
						name: sourceName(pension, "Personal savings"),
						amount: result.projectedBalance,
						valuationAge: Number(draft.retirementAge),
						detail: `At age ${draft.retirementAge}`
					});
				} else if (
					pension.kind === "propertyEquity" &&
					(pension.currentEquity !== "" || pension.remainingMortgage !== "")
				) {
					const result = propertyEquityResult(pension, draft.currentAge, draft.retirementAge);
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
						name: sourceName(pension, "Previous pension pot"),
						amount: Number(pension.amount),
						valuationAge: Number(draft.retirementAge),
						detail: "Saved amount; no growth projected"
					});
				} else if (pension.kind === "income" && pension.amount !== "") {
					resources.incomes.push({
						id: pension.id,
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
</script>

<svelte:head>
	<title>Withdrawals | Pension planner</title>
	<meta name="description" content="Set up a pension withdrawal plan." />
</svelte:head>

<div class="pension-page-heading">
	<p class="pension-step">02 / 02 &nbsp; WITHDRAWALS</p>
	<h1>Plan your withdrawals</h1>
	<p>Set your retirement time horizon and annual income target.</p>
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
				<Input id="final-age" type="number" min="18" max="120" bind:value={draft.finalAge} />
			</div>
			<div>
				<Label for="annual-income">Target annual income (£)</Label>
				<Input id="annual-income" type="number" min="0" step="1" bind:value={draft.annualIncome} />
			</div>
		</div>
		<section
			class="pension-result pension-retirement-summary"
			aria-labelledby="retirement-resources-heading"
		>
			<h3 id="retirement-resources-heading">Retirement resources</h3>
			<div class="pension-resource-display">
				<span>Price display</span>
				<div class="pension-price-toggle" role="group" aria-label="Price display">
					<button
						type="button"
						aria-pressed={!showRealTerms}
						onclick={() => (showRealTerms = false)}>Actual prices</button
					>
					<button type="button" aria-pressed={showRealTerms} onclick={() => (showRealTerms = true)}
						>Real terms</button
					>
				</div>
			</div>
			<p class="pension-resource-note">
				{#if showRealTerms}
					Values are shown in today's prices, adjusted for {DEFAULT_INFLATION_RATE}% annual
					inflation until each source's valuation age.
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
								<li>
									<span>{item.name}<small>{item.detail}</small></span><strong
										>{formatAmount(item)}</strong
									>
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
