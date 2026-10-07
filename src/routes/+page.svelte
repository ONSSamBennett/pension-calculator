<script>
	import { getContext } from "svelte";
	import { resolve } from "$app/paths";
	import { Button, Input, Label, Select } from "flowbite-svelte";
	import { createDefinedBenefit } from "$lib/pension-draft.js";
	import { definedBenefitResult } from "$lib/defined-benefit.js";

	const draft = getContext("pension-draft");
	const kinds = [
		{ name: "Defined benefit", value: "definedBenefit" },
		{ name: "Defined contribution", value: "definedContribution" },
		{ name: "Personal savings", value: "personalSavings" },
		{ name: "State pension", value: "statePension" },
		{ name: "Property equity", value: "propertyEquity" }
	];
	const legacyKinds = [
		{ name: "Pension pot (previous entry)", value: "pot" },
		{ name: "Projected annual pension (previous entry)", value: "income" }
	];
	const amounts = {
		definedContribution: "Current pension pot (£)",
		personalSavings: "Current savings balance (£)",
		statePension: "Projected annual state pension (£)",
		propertyEquity: "Estimated available property equity (£)",
		pot: "Current pot value (£)",
		income: "Annual income (£)"
	};
	const names = {
		definedContribution: "Scheme or provider",
		personalSavings: "Account name",
		statePension: "Name",
		propertyEquity: "Property name",
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
	const pounds = new Intl.NumberFormat("en-GB", {
		style: "currency",
		currency: "GBP",
		maximumFractionDigits: 0
	});

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
				? { ...createDefinedBenefit(pension.id), name: pension.name }
				: { id: pension.id, kind, name: pension.name, amount: "" };
	}

	function resultFor(pension) {
		try {
			return { result: definedBenefitResult(pension, draft.currentAge) };
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
</div>

<div class="pension-workspace">
	<section aria-labelledby="pensions-heading" class="pension-content">
		<div class="pension-age-field">
			<Label for="current-age">Current age</Label>
			<Input
				id="current-age"
				type="number"
				min="18"
				max="120"
				step="1"
				bind:value={draft.currentAge}
			/>
			{#if draft.currentAge === "" || !Number.isInteger(Number(draft.currentAge)) || Number(draft.currentAge) < 18 || Number(draft.currentAge) > 120}
				<p class="pension-error">Enter your current age between 18 and 120.</p>
			{/if}
		</div>
		<div class="pension-section-heading">
			<div>
				<h2 id="pensions-heading">Pension sources</h2>
				<p>{draft.pensions.length} {draft.pensions.length === 1 ? "source" : "sources"}</p>
			</div>
			<Button color="green" onclick={addPension}>Add pension</Button>
		</div>

		{#each draft.pensions as pension (pension.id)}
			<div class="pension-entry">
				<div class="pension-entry-heading">
					{#if pension.kind === "definedBenefit"}
						<h3 class="pension-entry-name">
							<label for={`name-${pension.id}`}>Scheme name</label>
							<input
								id={`name-${pension.id}`}
								type="text"
								class="pension-name-input"
								bind:value={pension.name}
							/>
						</h3>
					{:else}
						<h3>
							Source {draft.pensions.indexOf(pension) + 1}{pension.kind !== "unselected"
								? ` - ${[...kinds, ...legacyKinds].find((type) => type.value === pension.kind)?.name}`
								: ""}
						</h3>
					{/if}
					<Button
						color="light"
						size="sm"
						onclick={() =>
							(draft.pensions = draft.pensions.filter((entry) => entry.id !== pension.id))}
						>Remove</Button
					>
				</div>
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
							...(["pot", "income"].includes(pension.kind) ? legacyKinds : [])
						]}
						value={pension.kind}
						onchange={(event) => selectKind(pension, event)}
					/>
				</div>
				{#if pension.kind === "definedBenefit"}
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
					<div class="pension-fields pension-extra-fields">
						<div>
							<Label for={`scheme-${pension.id}`}>Scheme type</Label>
							<Select id={`scheme-${pension.id}`} items={schemes} bind:value={pension.scheme} />
						</div>
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
						{#if (!hasCompletedService(pension) || pension.accrualMethod !== "yearly") && (!hasCompletedService(pension) || pension.accrualMethod !== "known" || Number(pension.leaveAge) > Math.max(Number(draft.currentAge), Number(pension.serviceStartAge)))}
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
						{/if}
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
						{#if !hasCompletedService(pension) || pension.accrualMethod !== "known" || Number(pension.leaveAge) > Math.max(Number(draft.currentAge), Number(pension.serviceStartAge))}
							<div>
								<Label for={`accrual-${pension.id}`}>Accrual denominator (for 1/60, enter 60)</Label
								>
								<Input
									id={`accrual-${pension.id}`}
									type="number"
									min="1"
									step="1"
									bind:value={pension.accrualDenominator}
								/>
							</div>
						{/if}
						{#if pension.leaveAge !== "" && Number(pension.leaveAge) > Number(draft.currentAge)}
							<div>
								<Label for={`growth-${pension.id}`}>Annual pay growth (%)</Label>
								<Input
									id={`growth-${pension.id}`}
									type="number"
									min="-100"
									step="0.1"
									bind:value={pension.payGrowthRate}
								/>
							</div>
						{/if}
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
								<Label for={`accrued-${pension.id}`}>Current accrued gross annual pension (£)</Label
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
										<Label for={`earnings-${pension.id}-${index}`}>Pensionable pay (£)</Label><Input
											id={`earnings-${pension.id}-${index}`}
											type="number"
											min="0"
											step="1"
											bind:value={row.pay}
										/>
									</div>
									<Button color="light" size="sm" onclick={() => pension.earnings.splice(index, 1)}
										>Remove year</Button
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
					<p class="pension-note">
						New accrual and final-salary pay growth stop when you leave this scheme. CARE
						revaluation continues to normal scheme age, or later leave age. Payment timing and
						scheme adjustments will be handled in withdrawals.
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
									calculation.result.annualIncome
								)}</strong
							>
						{:else}
							<p>{calculation.error}</p>
						{/if}
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
					{#if pension.kind === "propertyEquity"}<p class="pension-note">
							This is not treated as available income until you choose how to release it.
						</p>{/if}
				{/if}
			</div>
		{:else}
			<p class="pension-empty">No pension sources added yet.</p>
		{/each}
	</section>

	<aside class="pension-aside">
		<p class="pension-aside-label">NEXT STEP</p>
		<h2>Plan your withdrawals</h2>
		<p>Set a retirement date and an annual income target on the next page.</p>
		<Button tag="a" href={resolve("/withdrawals/")} color="green" class="pension-action"
			>Go to withdrawals</Button
		>
	</aside>
</div>
