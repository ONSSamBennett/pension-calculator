<script>
	import { getContext } from "svelte";
	import { Button } from "flowbite-svelte";
	import { resolve } from "$app/paths";
	import DraftFileActions from "$lib/DraftFileActions.svelte";
	import RetirementIncomeProjection from "$lib/RetirementIncomeProjection.svelte";

	const draft = getContext("pension-draft");
	const priceDisplay = getContext("price-display");
</script>

<svelte:head>
	<title>Income projection | Pension planner</title>
	<meta name="description" content="Review your projected retirement income." />
</svelte:head>

<div class="pension-page-heading">
	<p class="pension-step">INCOME PROJECTION</p>
	<h1>See your income projection</h1>
	<DraftFileActions />
</div>

<div class="pension-projection-page">
	<Button tag="a" href={resolve("/withdrawals/")} color="green" class="pension-action">
		Back to withdrawals
	</Button>
	<section class="pension-aside pension-projection-panel">
		<RetirementIncomeProjection />
	</section>
</div>
