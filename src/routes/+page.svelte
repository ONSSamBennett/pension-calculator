<script>
	import { getContext } from "svelte";
	import { resolve } from "$app/paths";
	import { Button, Input, Label, Select } from "flowbite-svelte";

	const draft = getContext("pension-draft");
	const kinds = [
		{ name: "Pension pot", value: "pot" },
		{ name: "Projected annual pension", value: "income" }
	];

	function addPension() {
		draft.pensions.push({ id: draft.nextId++, kind: "pot", name: "", amount: "" });
	}
</script>

<svelte:head>
	<title>Your pensions | Pension planner</title>
	<meta name="description" content="Add your pension pots and projected pension income." />
</svelte:head>

<div class="pension-page-heading">
	<p class="pension-step">01 / 02 &nbsp; PENSIONS</p>
	<h1>Your pensions</h1>
	<p>List the pension savings and annual income you expect to draw from in retirement.</p>
</div>

<div class="pension-workspace">
	<section aria-labelledby="pensions-heading" class="pension-content">
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
					<h3>Source {draft.pensions.indexOf(pension) + 1}</h3>
					<Button
						color="light"
						size="sm"
						onclick={() =>
							(draft.pensions = draft.pensions.filter((entry) => entry.id !== pension.id))}
						>Remove</Button
					>
				</div>
				<div class="pension-fields">
					<div>
						<Label for={`kind-${pension.id}`}>Type</Label>
						<Select id={`kind-${pension.id}`} items={kinds} bind:value={pension.kind} />
					</div>
					<div>
						<Label for={`name-${pension.id}`}>Name</Label>
						<Input
							id={`name-${pension.id}`}
							placeholder="e.g. Workplace pension"
							bind:value={pension.name}
						/>
					</div>
					<div>
						<Label for={`amount-${pension.id}`}
							>{pension.kind === "pot" ? "Current pot value (£)" : "Annual income (£)"}</Label
						>
						<Input
							id={`amount-${pension.id}`}
							type="number"
							min="0"
							step="1"
							placeholder="0"
							bind:value={pension.amount}
						/>
					</div>
				</div>
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
