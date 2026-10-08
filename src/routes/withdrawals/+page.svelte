<script>
	import { getContext } from "svelte";
	import { Button, Card, Input, Label, Select } from "flowbite-svelte";
	import { resolve } from "$app/paths";
	import { realTermsValue } from "$lib/real-terms.js";
	import { isValidPlanAge } from "$lib/retirement-income-chart.js";
	import { drawdownFor, getRetirementResources } from "$lib/retirement-projection.js";
	import DraftFileActions from "$lib/DraftFileActions.svelte";
	import RetirementIncomeProjection from "$lib/RetirementIncomeProjection.svelte";

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

	const resources = $derived.by(() => getRetirementResources(draft, currentYear));
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

<div class="pension-workspace pension-withdrawals-workspace">
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
								<li class="pension-resource-card-item">
									<Card size="xl" shadow="sm" class="pension-resource-card">
										<div class="pension-resource-card-header">
											<span>{item.name}<small>{item.detail}</small></span>
											<strong>{formatAmount(item)}</strong>
										</div>
									</Card>
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
								<li class="pension-resource-card-item">
									<Card size="xl" shadow="sm" class="pension-resource-card">
										<div class="pension-resource-card-header">
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
														<Label for={`drawdown-custom-${item.id}`}
															>Custom annual return (%)</Label
														>
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
													.annualInflationRate}% each year in the nominal simulation. Returns apply
												to the remaining balance between annual withdrawals. The estimate runs
												through your plan age.
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
									</Card>
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
								<li class="pension-resource-card-item">
									<Card size="xl" shadow="sm" class="pension-resource-card">
										<div class="pension-resource-card-header">
											<span>{item.name}<small>{item.detail}</small></span>
											<strong>{formatAmount(item)}</strong>
										</div>
									</Card>
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

	<aside class="pension-aside pension-withdrawals-aside">
		<div class="pension-withdrawals-aside-full">
			<RetirementIncomeProjection />
		</div>
	</aside>
</div>

<div class="pension-withdrawals-footer">
	<h2>See your income projection</h2>
	<Button tag="a" href={resolve("/projection/")} color="green" class="pension-action"
		>Go to projection</Button
	>
</div>
