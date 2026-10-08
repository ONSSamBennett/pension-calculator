<script>
	import { getContext } from "svelte";
	import AnnualIncomeChart from "$lib/AnnualIncomeChart.svelte";
	import {
		getRetirementIncomeChartData,
		getRetirementResources
	} from "$lib/retirement-projection.js";

	const draft = getContext("pension-draft");
	const priceDisplay = getContext("price-display");
	const currentYear = new Date().getFullYear();
	const resources = $derived.by(() => getRetirementResources(draft, currentYear));
	const incomeChart = $derived.by(() =>
		getRetirementIncomeChartData(draft, resources, priceDisplay.realTerms, currentYear)
	);
</script>

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
