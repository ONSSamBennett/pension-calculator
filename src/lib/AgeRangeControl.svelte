<script>
	import { Input, Label } from "flowbite-svelte";
	import RangeSlider from "svelte-range-slider-pips";

	let {
		firstValue = $bindable(""),
		secondValue = $bindable(""),
		firstId,
		secondId,
		firstLabel,
		secondLabel,
		min = 18,
		max = 120,
		minGap = 0,
		firstError = "",
		secondError = "",
		disabled = false,
		onSecondInput,
		onRangeChange,
		className = ""
	} = $props();

	function ageValue(value, fallback) {
		if (value === "" || value === null || value === undefined) return fallback;
		const age = Number(value);
		return Number.isInteger(age) ? age : fallback;
	}

	const safeGap = $derived(Math.max(0, ageValue(minGap, 0)));
	const sliderMin = $derived(Math.min(ageValue(min, 18), ageValue(max, 120) - safeGap));
	const sliderValues = $derived.by(() => {
		const lowerLimit = sliderMin;
		const upperLimit = ageValue(max, 120);
		const minimumGap = safeGap;
		const lowerMaximum = Math.max(lowerLimit, upperLimit - minimumGap);
		const lower = Math.max(lowerLimit, Math.min(lowerMaximum, ageValue(firstValue, lowerLimit)));
		const upper = Math.max(
			lower + minimumGap,
			Math.min(upperLimit, ageValue(secondValue, lower + minimumGap))
		);
		return [lower, upper];
	});

	const secondInputMinimum = $derived(
		Math.max(ageValue(min, 18) + safeGap, ageValue(firstValue, ageValue(min, 18)) + safeGap)
	);

	function updateFromSlider(event) {
		const [firstAge, secondAge] = event.detail.values;
		firstValue = firstAge;
		secondValue = secondAge;
		onRangeChange?.(firstAge, secondAge);
	}

	function updateSecondInput(event) {
		onSecondInput?.(event.currentTarget.value);
	}
</script>

<div class={`pension-age-control-row ${className}`.trim()}>
	<div class="pension-age-field">
		<Label for={firstId}>{firstLabel}</Label>
		<Input
			id={firstId}
			type="number"
			min={sliderMin}
			max={max - safeGap}
			step="1"
			bind:value={firstValue}
		/>
		{#if firstError}
			<p class="pension-error">{firstError}</p>
		{/if}
	</div>
	<div class="pension-age-range">
		<RangeSlider
			class="pension-age-range-slider"
			values={sliderValues}
			min={sliderMin}
			{max}
			step={1}
			range={true}
			rangeGapMin={safeGap}
			ariaLabels={[firstLabel, secondLabel]}
			{disabled}
			on:change={updateFromSlider}
		/>
	</div>
	<div class="pension-age-field">
		<Label for={secondId}>{secondLabel}</Label>
		<Input
			id={secondId}
			type="number"
			min={secondInputMinimum}
			{max}
			step="1"
			bind:value={secondValue}
			oninput={updateSecondInput}
		/>
		{#if secondError}
			<p class="pension-error">{secondError}</p>
		{/if}
	</div>
</div>
