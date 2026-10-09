<script>
	import { getContext } from "svelte";
	import { resolve } from "$app/paths";
	import { Button, Card, Input, Label, Select } from "flowbite-svelte";
	import AgeRangeControl from "$lib/AgeRangeControl.svelte";
	import {
		createDefinedBenefit,
		createDefinedContribution,
		createPropertyEquity,
		createPersonalSavings
	} from "$lib/pension-draft.js";
	import { definedBenefitResult } from "$lib/defined-benefit.js";
	import { definedContributionResult } from "$lib/defined-contribution.js";
	import { projectedStatePensionAnnual, statePensionAnnual } from "$lib/state-pension.js";
	import { personalSavingsResult } from "$lib/personal-savings.js";
	import { propertyEquityResult } from "$lib/property-equity.js";
	import { realTermsFlowTotal, realTermsResidualGrowth, realTermsValue } from "$lib/real-terms.js";
	import DraftFileActions from "$lib/DraftFileActions.svelte";

	const draft = getContext("pension-draft");
	const priceDisplay = getContext("price-display");
	const kinds = [
		{ name: "Defined benefit", value: "definedBenefit" },
		{ name: "Defined contribution", value: "definedContribution" },
		{ name: "Personal savings", value: "personalSavings" },
		{ name: "Property equity", value: "propertyEquity" }
	];
	const legacyKinds = [
		{ name: "Pension pot (previous entry)", value: "pot" },
		{ name: "Projected annual pension (previous entry)", value: "income" }
	];
	const amounts = {
		pot: "Current pot value (£)",
		income: "Annual income (£)"
	};
	const names = {
		pot: "Name",
		income: "Name"
	};
	const schemes = [
		{ name: "Final salary", value: "finalSalary" },
		{ name: "Career average (CARE)", value: "care" }
	];
	const accrualMethods = [
		{ name: "Estimate from current pay", value: "estimate" },
		{ name: "Enter pensionable pay for each year", value: "yearly" },
		{ name: "Enter known accrued annual pension", value: "known" }
	];
	const pastPotMethods = [
		{ name: "Enter current pension pot", value: "known" },
		{ name: "Estimate from current salary", value: "estimate" },
		{ name: "Enter pensionable salary for each year", value: "yearly" }
	];
	const returnModes = [
		{ name: "Cautious (3%)", value: "cautious" },
		{ name: "Balanced (6%)", value: "balanced" },
		{ name: "Optimistic (9%)", value: "optimistic" },
		{ name: "Custom", value: "custom" }
	];
	const contributionFrequencies = [
		{ name: "Yearly", value: "yearly" },
		{ name: "Monthly", value: "monthly" },
		{ name: "Weekly", value: "weekly" }
	];
	const currentYear = new Date().getFullYear();
	const pounds = new Intl.NumberFormat("en-GB", {
		style: "currency",
		currency: "GBP",
		maximumFractionDigits: 0
	});
	const poundsAndPence = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

	function amountInSelectedTerms(amount, valuationAge) {
		return priceDisplay.realTerms
			? realTermsValue(amount, valuationAge, draft.currentAge, draft.settings.annualInflationRate)
			: amount;
	}

	function futureFlowTotal(result, field, totalField, currentBalance = "") {
		if (!priceDisplay.realTerms) return result[totalField];
		if (field !== "growth") {
			return realTermsFlowTotal(
				result.futureFlows,
				field,
				draft.currentAge,
				draft.settings.annualInflationRate
			);
		}

		const isDc = "projectedPot" in result;
		return realTermsResidualGrowth({
			endingBalance: isDc ? result.projectedPot : result.projectedBalance,
			valuationAge: draft.retirementAge,
			openingBalance: isDc ? result.existingPot : Number(currentBalance || 0),
			currentAge: draft.currentAge,
			annualInflationRate: draft.settings.annualInflationRate,
			inflows: [
				{ flows: result.futureFlows, field: "contributions" },
				...(result.futureBonus ? [{ flows: result.futureFlows, field: "bonus" }] : [])
			],
			outflows: [{ flows: result.futureFlows, field: "fees" }]
		});
	}

	function isValidSliderAge(value) {
		if (value === "" || value === null || value === undefined) return false;
		const age = Number(value);
		return Number.isInteger(age) && age >= 18 && age <= 120;
	}

	const pensionAgeRangeIsValid = $derived(
		isValidSliderAge(draft.currentAge) &&
			isValidSliderAge(draft.retirementAge) &&
			Number(draft.retirementAge) >= Number(draft.currentAge)
	);

	function addPension() {
		draft.pensions.push({ id: draft.nextId++, kind: "unselected", name: "", amount: "" });
	}

	function selectKind(pension, event) {
		const kind = event.currentTarget.value;
		if (kind === pension.kind) return;
		if (
			pension.kind !== "unselected" &&
			!confirm("Changing pension type will clear the inputs for this source. Continue?")
		) {
			event.currentTarget.value = pension.kind;
			return;
		}
		const index = draft.pensions.findIndex((entry) => entry.id === pension.id);
		draft.pensions[index] =
			kind === "definedBenefit"
				? {
						...createDefinedBenefit(pension.id, draft.settings.annualInflationRate),
						name: pension.name
					}
				: kind === "definedContribution"
					? {
							...createDefinedContribution(pension.id, draft.settings.annualInflationRate),
							name: pension.name
						}
					: kind === "personalSavings"
						? {
								...createPersonalSavings(pension.id, draft.settings.annualInflationRate),
								name: pension.name
							}
						: kind === "propertyEquity"
							? { ...createPropertyEquity(pension.id), name: pension.name }
							: { id: pension.id, kind, name: pension.name, amount: "" };
	}

	function resultFor(pension) {
		try {
			return { result: definedBenefitResult(pension, draft.currentAge) };
		} catch (error) {
			return { error: error.message };
		}
	}

	function dcResultFor(pension) {
		try {
			return {
				result: definedContributionResult(
					pension,
					draft.currentAge,
					draft.retirementAge,
					currentYear,
					true
				)
			};
		} catch (error) {
			return { error: error.message };
		}
	}

	function stateResultFor(pension) {
		try {
			return {
				amount: statePensionAnnual(pension),
				projected: projectedStatePensionAnnual(pension, draft.currentAge)
			};
		} catch (error) {
			return { error: error.message };
		}
	}

	function savingsResultFor(pension) {
		try {
			return {
				result: personalSavingsResult(pension, draft.currentAge, draft.retirementAge, true)
			};
		} catch (error) {
			return { error: error.message };
		}
	}

	function propertyEquityResultFor(pension) {
		try {
			return {
				result: propertyEquityResult(
					pension,
					draft.currentAge,
					draft.retirementAge,
					draft.settings.annualHousePriceIncreaseRate
				)
			};
		} catch (error) {
			return { error: error.message };
		}
	}

	function hasCompletedService(pension) {
		return (
			pension.serviceStartAge !== "" &&
			pension.leaveAge !== "" &&
			Number.isInteger(Number(draft.currentAge)) &&
			Number(pension.serviceStartAge) < Math.min(Number(draft.currentAge), Number(pension.leaveAge))
		);
	}
</script>

<svelte:head>
	<title>Your pensions | Pension planner</title>
	<meta name="description" content="Add your pension sources and retirement savings." />
</svelte:head>

<div class="pension-page-heading">
	<p class="pension-step">01 / 02 &nbsp; PENSIONS</p>
	<h1>Your pensions</h1>
	<p>Add your pension sources, savings and other assets for retirement.</p>
	<DraftFileActions />
</div>

<div class="pension-workspace pension-pensions-workspace">
	<section aria-labelledby="pensions-heading" class="pension-content">
		<AgeRangeControl
			firstId="current-age"
			secondId="target-retirement-age"
			firstLabel="Current age"
			secondLabel="Target retirement age"
			bind:firstValue={draft.currentAge}
			bind:secondValue={draft.retirementAge}
			min={18}
			max={120}
			minGap={0}
			firstError={!isValidSliderAge(draft.currentAge)
				? "Enter your current age between 18 and 120."
				: ""}
			secondError={!pensionAgeRangeIsValid
				? "Enter a target retirement age from your current age to 120."
				: ""}
			disabled={!pensionAgeRangeIsValid}
		/>
		<div class="pension-section-heading">
			<div>
				<h2 id="pensions-heading">Pension sources</h2>
				<p>{draft.pensions.length} {draft.pensions.length === 1 ? "source" : "sources"}</p>
			</div>
			<Button color="green" onclick={addPension}>Add pension</Button>
		</div>

		{#each draft.pensions as pension (pension.id)}
			<Card size="xl" shadow="sm" class="pension-resource-card pension-entry-card">
				<div class="pension-entry-heading">
					{#if pension.kind === "statePension"}
						<h3>State Pension</h3>
					{:else if pension.kind === "definedBenefit" || pension.kind === "definedContribution" || pension.kind === "personalSavings" || pension.kind === "propertyEquity"}
						<h3 class="pension-entry-name">
							<label for={`name-${pension.id}`}
								>{pension.kind === "definedBenefit"
									? "Scheme name"
									: pension.kind === "definedContribution"
										? "Pension name"
										: pension.kind === "personalSavings"
											? "Savings name"
											: "Property name"}</label
							>
							<input
								id={`name-${pension.id}`}
								type="text"
								class="pension-name-input"
								placeholder="Add asset name here..."
								bind:value={pension.name}
							/>
						</h3>
					{:else if pension.kind === "unselected"}
						<h3>New pension</h3>
					{:else}
						<h3>
							{[...kinds, ...legacyKinds].find((type) => type.value === pension.kind)?.name ??
								"Pension source"}
						</h3>
					{/if}
					{#if pension.kind !== "statePension" || draft.pensions[0].id !== pension.id}<Button
							color="light"
							size="sm"
							onclick={() =>
								(draft.pensions = draft.pensions.filter((entry) => entry.id !== pension.id))}
							>Remove</Button
						>{/if}
				</div>
				{#if pension.kind !== "statePension" || draft.pensions[0].id !== pension.id}
					<div class="pension-type-field">
						<Label for={`kind-${pension.id}`}>Pension type</Label>
						<Select
							id={`kind-${pension.id}`}
							placeholder=""
							items={[
								...(pension.kind === "unselected"
									? [{ name: "Choose a pension type", value: "unselected", disabled: true }]
									: []),
								...kinds,
								...(pension.kind === "statePension"
									? [{ name: "State pension (previous entry)", value: "statePension" }]
									: []),
								...(["pot", "income"].includes(pension.kind) ? legacyKinds : [])
							]}
							value={pension.kind}
							onchange={(event) => selectKind(pension, event)}
						/>
					</div>
				{/if}
				{#if pension.kind === "statePension"}
					<div class="pension-fields">
						<div>
							<Label for={`state-age-${pension.id}`}>Estimated qualifying age</Label>
							<Input
								id={`state-age-${pension.id}`}
								type="number"
								min="18"
								max="120"
								step="1"
								bind:value={pension.qualifyingAge}
							/>
						</div>
					</div>
					<details class="pension-advanced-settings">
						<summary>Advanced settings</summary>
						<div class="pension-fields">
							<div>
								<Label for={`state-years-${pension.id}`}
									>Expected National Insurance qualifying years on retirement</Label
								>
								<Input
									id={`state-years-${pension.id}`}
									type="number"
									min="0"
									max="120"
									step="1"
									bind:value={pension.qualifyingYears}
								/>
							</div>
							<div>
								<Label for={`state-increase-${pension.id}`}
									>Expected annual State Pension increase (%)</Label
								>
								<Input
									id={`state-increase-${pension.id}`}
									type="number"
									min="0"
									max="100"
									step="0.1"
									bind:value={pension.annualIncreaseRate}
								/>
							</div>
						</div>
					</details>
					{@const state = stateResultFor(pension)}
					<div class="pension-result" aria-live="polite">
						{#if state.projected !== undefined}<strong
								>Estimated yearly State Pension {Number(pension.qualifyingAge) >
								Number(draft.currentAge)
									? `at age ${pension.qualifyingAge}`
									: "now"}: {poundsAndPence.format(
									amountInSelectedTerms(state.projected, pension.qualifyingAge)
								)}</strong
							>
						{:else}<p>{state.error}</p>{/if}
					</div>
					{#if pension.legacyAmount !== ""}<p class="pension-note">
							Previously saved annual figure: {poundsAndPence.format(
								amountInSelectedTerms(Number(pension.legacyAmount), draft.currentAge)
							)}. The estimate above uses qualifying years instead.
						</p>{/if}
				{:else if pension.kind === "definedBenefit"}
					<div class="pension-fields">
						<div>
							<Label for={`service-start-${pension.id}`}
								>Age eligible service began or will begin</Label
							>
							<Input
								id={`service-start-${pension.id}`}
								type="number"
								min="16"
								max="120"
								step="1"
								bind:value={pension.serviceStartAge}
							/>
						</div>
						<div>
							<Label for={`leave-${pension.id}`}>Age you left or plan to leave this scheme</Label>
							<Input
								id={`leave-${pension.id}`}
								type="number"
								min="18"
								max="120"
								step="1"
								bind:value={pension.leaveAge}
							/>
							{#if pension.leaveAge !== "" && pension.serviceStartAge !== "" && Number(pension.leaveAge) < Number(pension.serviceStartAge)}
								<p class="pension-error">Leave age must be after service start age.</p>
							{/if}
						</div>
					</div>
					{#if pension.status === "inPayment"}
						<p class="pension-note">
							This saved scheme was marked as already paying. Its recorded payment is retained for
							later use, but is not included in this scheme estimate.
						</p>
					{/if}
					<div class="pension-fields pension-standard-fields">
						<div>
							<Label for={`scheme-${pension.id}`}>Scheme type</Label>
							<Select id={`scheme-${pension.id}`} items={schemes} bind:value={pension.scheme} />
						</div>
						<div>
							<Label for={`pay-${pension.id}`}
								>{pension.leaveAge !== "" && Number(pension.leaveAge) < Number(draft.currentAge)
									? "Pensionable pay when you left (£)"
									: "Current pensionable pay (£)"}</Label
							>
							<Input
								id={`pay-${pension.id}`}
								type="number"
								min="0"
								step="1"
								bind:value={pension.pensionablePay}
							/>
						</div>
						<div>
							<Label for={`normal-${pension.id}`}>Normal scheme pension age</Label>
							<Input
								id={`normal-${pension.id}`}
								type="number"
								min="18"
								max="120"
								step="1"
								bind:value={pension.normalAge}
							/>
						</div>
						<div>
							<Label for={`accrual-${pension.id}`}>Accrual denominator (for 1/60, enter 60)</Label>
							<Input
								id={`accrual-${pension.id}`}
								type="number"
								min="1"
								step="1"
								bind:value={pension.accrualDenominator}
							/>
						</div>
					</div>
					<details class="pension-advanced-settings">
						<summary>Advanced settings</summary>
						<div class="pension-fields pension-extra-fields">
							{#if hasCompletedService(pension)}
								<div>
									<Label for={`method-${pension.id}`}>Past accrual</Label>
									<Select
										id={`method-${pension.id}`}
										items={accrualMethods}
										bind:value={pension.accrualMethod}
									/>
								</div>
							{/if}
							<div>
								<Label for={`growth-${pension.id}`}
									>Annual pay growth and final-salary uprating (%)</Label
								>
								<Input
									id={`growth-${pension.id}`}
									type="number"
									min="-100"
									step="0.1"
									bind:value={pension.payGrowthRate}
								/>
							</div>
							{#if pension.scheme === "care"}
								<div>
									<Label for={`revalue-${pension.id}`}>Annual CARE revaluation (%)</Label>
									<Input
										id={`revalue-${pension.id}`}
										type="number"
										min="-100"
										step="0.1"
										bind:value={pension.revaluationRate}
									/>
								</div>
							{/if}
							{#if hasCompletedService(pension) && pension.accrualMethod === "known"}
								<div>
									<Label for={`accrued-${pension.id}`}
										>Current accrued gross annual pension (£)</Label
									>
									<Input
										id={`accrued-${pension.id}`}
										type="number"
										min="0"
										step="1"
										bind:value={pension.accruedAnnualPension}
									/>
								</div>
							{/if}
						</div>
						{#if hasCompletedService(pension) && pension.accrualMethod === "yearly"}
							<div class="pension-earnings">
								<h4>Pensionable pay by completed service year</h4>
								{#each pension.earnings as row, index}
									<div class="pension-earnings-row">
										<div>
											<Label for={`year-${pension.id}-${index}`}>Year</Label><Input
												id={`year-${pension.id}-${index}`}
												type="number"
												min="1900"
												step="1"
												bind:value={row.year}
											/>
										</div>
										<div>
											<Label for={`earnings-${pension.id}-${index}`}>Pensionable pay (£)</Label
											><Input
												id={`earnings-${pension.id}-${index}`}
												type="number"
												min="0"
												step="1"
												bind:value={row.pay}
											/>
										</div>
										<Button
											color="light"
											size="sm"
											onclick={() => pension.earnings.splice(index, 1)}>Remove year</Button
										>
									</div>
								{/each}
								<Button
									color="light"
									size="sm"
									onclick={() => pension.earnings.push({ year: "", pay: "" })}>Add year</Button
								>
							</div>
						{/if}
					</details>
					<p class="pension-note">
						New accrual and final-salary pay growth stop when you leave this scheme. CARE
						revaluation continues to normal scheme age, or later leave age. Previously accrued
						final-salary benefits continue to be uprated at the pay growth rate until the valuation
						age. Payment timing and scheme adjustments will be handled in withdrawals.
					</p>
					{#if hasCompletedService(pension) && pension.accrualMethod === "known"}
						<p class="pension-note">
							Enter the annual pension already earned for past service, valued today before any
							scheme adjustment. Completed service years are retained but not used for this method;
							future accrual is estimated separately.
						</p>
					{:else if hasCompletedService(pension) && pension.accrualMethod === "yearly"}
						<p class="pension-note">
							{pension.scheme === "finalSalary"
								? "Final salary uses your most recent entered pay to project final pensionable pay. Earlier pay is not averaged."
								: "CARE sums the accrued pension from each entered year and revalues it to pension start."}
							Enter one row for each completed service year.
						</p>
					{:else if hasCompletedService(pension) && pension.scheme === "care"}
						<p class="pension-note">
							Past CARE earnings are approximated using your current pensionable pay. Enter pay by
							year for a more detailed estimate.
						</p>
					{/if}
					{@const calculation = resultFor(pension)}
					<div class="pension-result" aria-live="polite">
						{#if calculation.result}
							<strong
								>Estimated gross annual pension at age {calculation.result.valuationAge}: {pounds.format(
									amountInSelectedTerms(
										calculation.result.annualIncome,
										calculation.result.valuationAge
									)
								)}</strong
							>
						{:else}
							<p>{calculation.error}</p>
						{/if}
					</div>
				{:else if pension.kind === "definedContribution"}
					<div class="pension-fields pension-standard-fields">
						<div>
							<Label for={`dc-start-${pension.id}`}>Age contributions began</Label>
							<Input
								id={`dc-start-${pension.id}`}
								type="number"
								min="16"
								max="120"
								step="1"
								bind:value={pension.startAge}
							/>
						</div>
						<div>
							<Label for={`dc-end-${pension.id}`}>Age contributions ended or will end</Label>
							<Input
								id={`dc-end-${pension.id}`}
								type="number"
								min="16"
								max="120"
								step="1"
								bind:value={pension.endAge}
							/>
						</div>
						<div>
							<Label for={`dc-pay-${pension.id}`}>Current pensionable salary (£)</Label>
							<Input
								id={`dc-pay-${pension.id}`}
								type="number"
								min="0"
								step="1"
								bind:value={pension.pensionablePay}
							/>
						</div>
						<div>
							<Label for={`dc-employee-${pension.id}`}>Employee contribution (%)</Label>
							<Input
								id={`dc-employee-${pension.id}`}
								type="number"
								min="0"
								max="100"
								step="0.1"
								bind:value={pension.employeeRate}
							/>
						</div>
						<div>
							<Label for={`dc-employer-${pension.id}`}>Employer contribution (%)</Label>
							<Input
								id={`dc-employer-${pension.id}`}
								type="number"
								min="0"
								max="100"
								step="0.1"
								bind:value={pension.employerRate}
							/>
						</div>
					</div>
					<details class="pension-advanced-settings">
						<summary>Advanced settings</summary>
						<div class="pension-fields pension-extra-fields">
							<div>
								<Label for={`dc-growth-${pension.id}`}>Annual pay growth (%)</Label>
								<Input
									id={`dc-growth-${pension.id}`}
									type="number"
									min="-99.99"
									step="0.1"
									bind:value={pension.payGrowthRate}
								/>
							</div>
							<div>
								<Label for={`dc-return-${pension.id}`}>Expected annual return</Label>
								<Select
									id={`dc-return-${pension.id}`}
									items={returnModes}
									bind:value={pension.returnMode}
								/>
							</div>
							<div>
								<Label for={`dc-fee-${pension.id}`}>Annual fee (% of pot)</Label>
								<Input
									id={`dc-fee-${pension.id}`}
									type="number"
									min="0"
									max="100"
									step="0.01"
									bind:value={pension.annualFeeRate}
								/>
							</div>
							{#if pension.returnMode === "custom"}
								<div>
									<Label for={`dc-custom-${pension.id}`}>Custom annual return (%)</Label>
									<Input
										id={`dc-custom-${pension.id}`}
										type="number"
										min="-100"
										max="100"
										step="0.1"
										bind:value={pension.customReturnRate}
									/>
								</div>
							{/if}
							{#if pension.startAge !== "" && Number(pension.startAge) < Number(draft.currentAge)}
								<div>
									<Label for={`dc-past-${pension.id}`}>Existing pension pot</Label>
									<Select
										id={`dc-past-${pension.id}`}
										items={pastPotMethods}
										bind:value={pension.pastPotMethod}
									/>
								</div>
								{#if pension.pastPotMethod === "known"}
									<div>
										<Label for={`dc-pot-${pension.id}`}>Current pension pot (£)</Label>
										<Input
											id={`dc-pot-${pension.id}`}
											type="number"
											min="0"
											step="1"
											bind:value={pension.existingPot}
										/>
									</div>
								{/if}
							{/if}
						</div>
						{#if pension.startAge !== "" && Number(pension.startAge) < Number(draft.currentAge) && pension.pastPotMethod === "yearly"}
							<div class="pension-earnings">
								<h4>Pensionable salary by completed contribution year</h4>
								{#each pension.earnings as row, index}
									<div class="pension-earnings-row">
										<div>
											<Label for={`dc-year-${pension.id}-${index}`}>Year</Label><Input
												id={`dc-year-${pension.id}-${index}`}
												type="number"
												min="1900"
												step="1"
												bind:value={row.year}
											/>
										</div>
										<div>
											<Label for={`dc-earnings-${pension.id}-${index}`}
												>Pensionable salary (£)</Label
											><Input
												id={`dc-earnings-${pension.id}-${index}`}
												type="number"
												min="0"
												step="1"
												bind:value={row.pay}
											/>
										</div>
										<Button
											color="light"
											size="sm"
											onclick={() => pension.earnings.splice(index, 1)}>Remove year</Button
										>
									</div>
								{/each}
								<Button
									color="light"
									size="sm"
									onclick={() => pension.earnings.push({ year: "", pay: "" })}>Add year</Button
								>
							</div>
						{/if}
					</details>
					{#if (pension.startYear !== "" || pension.endYear !== "") && (pension.startAge === "" || pension.endAge === "")}
						<p class="pension-note">
							This previous draft recorded contribution years {pension.startYear} to {pension.endYear}.
							Enter the ages to calculate a new projection.
						</p>
					{/if}
					<p class="pension-note">
						Returns and fees apply annually to the invested pot before each year's contribution
						arrives. Estimates exclude tax and inflation and are not guaranteed.
					</p>
					{@const projection = dcResultFor(pension)}
					<div class="pension-result" aria-live="polite">
						{#if projection.result}
							<strong
								>Projected pension pot at age {draft.retirementAge}: {pounds.format(
									amountInSelectedTerms(projection.result.projectedPot, Number(draft.retirementAge))
								)}</strong
							>
							<p>Pension pot today: {pounds.format(projection.result.existingPot)}</p>
							<p>
								Future contributions: {pounds.format(
									futureFlowTotal(projection.result, "contributions", "futureContributions")
								)}
							</p>
							<p>
								{priceDisplay.realTerms
									? "Real investment growth after inflation"
									: "Future investment growth"}: {pounds.format(
									futureFlowTotal(projection.result, "growth", "futureInvestmentGrowth")
								)}
							</p>
							<p>
								Future fees: {pounds.format(
									-futureFlowTotal(projection.result, "fees", "futureFeesPaid")
								)}
							</p>
						{:else}<p>{projection.error}</p>{/if}
					</div>
				{:else if pension.kind === "propertyEquity"}
					<div class="pension-fields">
						<div>
							<Label for={`property-equity-${pension.id}`}>Current equity (£)</Label>
							<Input
								id={`property-equity-${pension.id}`}
								type="number"
								min="0"
								step="1"
								bind:value={pension.currentEquity}
							/>
						</div>
						<div>
							<Label for={`property-mortgage-${pension.id}`}>Remaining mortgage (£)</Label>
							<Input
								id={`property-mortgage-${pension.id}`}
								type="number"
								min="0"
								step="1"
								bind:value={pension.remainingMortgage}
							/>
						</div>
						<div>
							<Label for={`property-payment-${pension.id}`}
								>Monthly mortgage equity payment (£)</Label
							>
							<Input
								id={`property-payment-${pension.id}`}
								type="number"
								min="0"
								step="1"
								bind:value={pension.monthlyEquityPayment}
							/>
						</div>
					</div>
					<p class="pension-note">
						Annual house-price change is set in Settings ({draft.settings
							.annualHousePriceIncreaseRate}% per year). Mortgage payments reduce the balance
						monthly until it is repaid or you reach retirement. Mortgage interest is not included.
					</p>
					{@const property = propertyEquityResultFor(pension)}
					<div class="pension-result" aria-live="polite">
						{#if property.result}
							<strong
								>Estimated property equity at age {draft.retirementAge}: {pounds.format(
									amountInSelectedTerms(
										property.result.estimatedEquity,
										Number(draft.retirementAge)
									)
								)}</strong
							>
						{:else}<p>{property.error}</p>{/if}
					</div>
				{:else if pension.kind === "personalSavings"}
					<div class="pension-fields pension-standard-fields">
						<div>
							<Label for={`savings-balance-${pension.id}`}>Current balance (£)</Label>
							<Input
								id={`savings-balance-${pension.id}`}
								type="number"
								min="0"
								step="1"
								bind:value={pension.currentBalance}
							/>
						</div>
						<div>
							<Label for={`savings-frequency-${pension.id}`}>Contribution frequency</Label>
							<Select
								id={`savings-frequency-${pension.id}`}
								items={contributionFrequencies}
								bind:value={pension.contributionFrequency}
							/>
						</div>
						<div>
							<Label for={`savings-contribution-${pension.id}`}>Contribution amount (£)</Label>
							<Input
								id={`savings-contribution-${pension.id}`}
								type="number"
								min="0"
								step="1"
								bind:value={pension.contributionAmount}
							/>
						</div>
					</div>
					<details class="pension-advanced-settings">
						<summary>Advanced settings</summary>
						<div class="pension-fields pension-extra-fields">
							<div>
								<Label for={`savings-end-${pension.id}`}>Age contributions will end</Label>
								<Input
									id={`savings-end-${pension.id}`}
									type="number"
									min="18"
									max="120"
									step="1"
									value={pension.endAge === "" ? draft.retirementAge : pension.endAge}
									oninput={(event) => (pension.endAge = event.currentTarget.value)}
								/>
							</div>
							<div>
								<Label for={`savings-increase-${pension.id}`}
									>Annual contribution increase (%)</Label
								>
								<Input
									id={`savings-increase-${pension.id}`}
									type="number"
									min="-99.99"
									max="100"
									step="0.1"
									bind:value={pension.contributionIncreaseRate}
								/>
							</div>
							<div>
								<Label for={`savings-return-${pension.id}`}>Expected annual return</Label>
								<Select
									id={`savings-return-${pension.id}`}
									items={returnModes}
									bind:value={pension.returnMode}
								/>
							</div>
							{#if pension.returnMode === "custom"}
								<div>
									<Label for={`savings-custom-${pension.id}`}>Custom annual return (%)</Label>
									<Input
										id={`savings-custom-${pension.id}`}
										type="number"
										min="-100"
										max="100"
										step="0.1"
										bind:value={pension.customReturnRate}
									/>
								</div>
							{/if}
							<div>
								<Label for={`savings-fee-${pension.id}`}>Annual fee (% of balance)</Label>
								<Input
									id={`savings-fee-${pension.id}`}
									type="number"
									min="0"
									max="100"
									step="0.01"
									bind:value={pension.annualFeeRate}
								/>
							</div>
							<div>
								<Label for={`savings-bonus-${pension.id}`}
									>Additional bonus (% of contributions)</Label
								>
								<Input
									id={`savings-bonus-${pension.id}`}
									type="number"
									min="0"
									max="100"
									step="0.1"
									placeholder="e.g., 25% for LISA"
									bind:value={pension.bonusRate}
								/>
							</div>
						</div>
					</details>
					<p class="pension-note">
						Contributions and any bonus arrive at the end of each period. Returns and fees compound
						during the period. The bonus is illustrative; eligibility and annual limits are not
						applied. Estimates exclude tax and inflation.
					</p>
					{@const savings = savingsResultFor(pension)}
					<div class="pension-result" aria-live="polite">
						{#if savings.result}
							<strong
								>Projected savings at age {draft.retirementAge}: {pounds.format(
									amountInSelectedTerms(
										savings.result.projectedBalance,
										Number(draft.retirementAge)
									)
								)}</strong
							>
							<p>
								Future contributions: {pounds.format(
									futureFlowTotal(savings.result, "contributions", "futureContributions")
								)}
							</p>
							<p>
								Additional bonus: {pounds.format(
									futureFlowTotal(savings.result, "bonus", "futureBonus")
								)}
							</p>
							<p>
								{priceDisplay.realTerms
									? "Real investment growth after inflation"
									: "Future investment growth"}: {pounds.format(
									futureFlowTotal(
										savings.result,
										"growth",
										"futureInvestmentGrowth",
										pension.currentBalance
									)
								)}
							</p>
							<p>
								Future fees: {pounds.format(
									-futureFlowTotal(savings.result, "fees", "futureFeesPaid")
								)}
							</p>
						{:else}<p>{savings.error}</p>{/if}
					</div>
				{:else if pension.kind !== "unselected"}
					<div class="pension-fields">
						<div>
							<Label for={`name-${pension.id}`}>{names[pension.kind]}</Label>
							<Input id={`name-${pension.id}`} bind:value={pension.name} />
						</div>
						<div>
							<Label for={`amount-${pension.id}`}>{amounts[pension.kind]}</Label>
							<Input
								id={`amount-${pension.id}`}
								type="number"
								min="0"
								step="1"
								bind:value={pension.amount}
							/>
						</div>
					</div>
					{#if pension.kind === "propertyEquity"}
						<p class="pension-note">
							This current value is recorded for planning toward retirement at age {draft.retirementAge ||
								"—"}. No future change is estimated. Property equity is not treated as income until
							you choose how to release it.
						</p>
					{/if}
				{/if}
			</Card>
		{:else}
			<p class="pension-empty">No pension sources added yet.</p>
		{/each}
		<div class="pension-add-bottom">
			<Button color="green" onclick={addPension}>Add pension</Button>
		</div>
	</section>

	<aside class="pension-aside pension-pensions-aside">
		<div class="pension-pensions-aside-full">
			<p class="pension-aside-label">NEXT STEP</p>
			<h2>Plan your withdrawals</h2>
			<p>Set a retirement date and an annual income target on the next page.</p>
			<Button tag="a" href={resolve("/withdrawals/")} color="green" class="pension-action"
				>Go to withdrawals</Button
			>
		</div>
		<div class="pension-pensions-aside-mobile">
			<h2>Planning your pensions</h2>
			<Button tag="a" href={resolve("/withdrawals/")} color="green" class="pension-action"
				>Go to withdrawals</Button
			>
		</div>
	</aside>
</div>
