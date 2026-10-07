<script>
	import { getContext } from "svelte";
	import { Button, Input, Label, Select } from "flowbite-svelte";
	import { resolve } from "$app/paths";

	const draft = getContext("pension-draft");
	const strategies = [
		{ name: "Fixed annual amount", value: "steady" },
		{ name: "Percentage of remaining pot", value: "percentage" }
	];
</script>

<svelte:head>
	<title>Withdrawals | Pension planner</title>
	<meta name="description" content="Set up a pension withdrawal plan." />
</svelte:head>

<div class="pension-page-heading">
	<p class="pension-step">02 / 02 &nbsp; WITHDRAWALS</p>
	<h1>Plan your withdrawals</h1>
	<p>Set the assumptions for how you would like to take income in retirement.</p>
</div>

<div class="pension-workspace">
	<section aria-labelledby="withdrawals-heading" class="pension-content">
		<div class="pension-section-heading">
			<div>
				<h2 id="withdrawals-heading">Drawdown assumptions</h2>
				<p>Choose a time horizon and an income approach.</p>
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
			<div>
				<Label for="strategy">Withdrawal approach</Label>
				<Select id="strategy" items={strategies} bind:value={draft.strategy} />
			</div>
			{#if draft.strategy === "percentage"}
				<div>
					<Label for="withdrawal-rate">Annual withdrawal rate (%)</Label>
					<Input
						id="withdrawal-rate"
						type="number"
						min="0"
						max="100"
						step="0.1"
						bind:value={draft.withdrawalRate}
					/>
				</div>
			{/if}
		</div>
	</section>

	<aside class="pension-aside">
		<p class="pension-aside-label">PROJECTION</p>
		<h2>Your drawdown plan</h2>
		<p class="pension-muted">
			No projection yet. Withdrawal calculations and charts will be added after the pension model is
			defined.
		</p>
		<Button tag="a" href={resolve("/")} color="green" class="pension-action"
			>Back to pensions</Button
		>
	</aside>
</div>
