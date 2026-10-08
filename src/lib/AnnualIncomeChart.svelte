<script>
	import { onMount } from "svelte";

	let { ages, series, targetValues } = $props();
	let chartElement = $state();
	let chart = $state.raw(null);
	const currency = new Intl.NumberFormat("en-GB", {
		style: "currency",
		currency: "GBP",
		maximumFractionDigits: 0
	});

	function escapeHtml(value) {
		return String(value).replace(/[&<>"']/g, (character) => {
			const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
			return entities[character];
		});
	}

	onMount(() => {
		let instance;
		let observer;
		let disposed = false;
		Promise.all([
			import("echarts/core"),
			import("echarts/charts"),
			import("echarts/components"),
			import("echarts/renderers")
		]).then(([echarts, charts, components, renderers]) => {
			if (disposed || !chartElement) return;
			echarts.use([
				charts.BarChart,
				charts.LineChart,
				components.GridComponent,
				components.TooltipComponent,
				components.LegendComponent,
				renderers.CanvasRenderer
			]);
			instance = echarts.init(chartElement);
			chart = instance;
			observer = new ResizeObserver(() => instance.resize());
			observer.observe(chartElement);
		});
		return () => {
			disposed = true;
			observer?.disconnect();
			instance?.dispose();
		};
	});

	$effect(() => {
		const instance = chart;
		const chartAges = ages;
		const chartSeries = series;
		const chartTarget = targetValues;
		if (!instance) return;

		const configuredSeries = chartSeries.map((item) => ({
			name: item.name,
			type: "bar",
			stack: "annual-income",
			barMaxWidth: 20,
			emphasis: { focus: "series" },
			data: item.values
		}));
		if (chartTarget) {
			configuredSeries.push({
				name: "Target annual income",
				type: "line",
				symbol: "none",
				z: 10,
				lineStyle: { type: "dashed", width: 2 },
				data: chartTarget
			});
		}

		instance.setOption({
			color: ["#176b4d", "#4c6eaa", "#d67a3b", "#8c5795", "#16818a", "#a54848", "#777d28"],
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow" },
				formatter: (items) => {
					const age = escapeHtml(items[0]?.axisValue ?? "");
					const values = items
						.filter((item) => Number(item.value) !== 0)
						.map(
							(item) =>
								`${item.marker} ${escapeHtml(item.seriesName)}: ${currency.format(Number(item.value))}`
						);
					return [`Age ${age}`, ...values].join("<br>");
				}
			},
			legend: { type: "scroll", bottom: 0, textStyle: { fontSize: 11 } },
			grid: { top: 12, right: 12, bottom: 48, left: 8, containLabel: true },
			xAxis: {
				type: "category",
				data: chartAges.map(String),
				axisLabel: { interval: Math.max(0, Math.floor(chartAges.length / 8) - 1) }
			},
			yAxis: {
				type: "value",
				name: "Annual income",
				nameTextStyle: { fontSize: 11 },
				axisLabel: {
					formatter: (value) =>
						new Intl.NumberFormat("en-GB", {
							style: "currency",
							currency: "GBP",
							notation: "compact",
							maximumFractionDigits: 0
						}).format(value)
				}
			},
			series: configuredSeries
		});
	});
</script>

{#if ages.length && series.length}
	<div
		class="pension-income-chart"
		bind:this={chartElement}
		role="img"
		aria-label="Stacked column chart of annual retirement income by pension source"
	></div>
{:else if !ages.length}
	<p class="pension-income-chart-empty">Set valid retirement and plan ages to show the chart.</p>
{:else}
	<p class="pension-income-chart-empty">Add valid retirement income sources to show the chart.</p>
{/if}
