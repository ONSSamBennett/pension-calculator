<script>
	let { realTerms = $bindable(true) } = $props();
</script>

<div class="pension-resource-display">
	<span>Price display</span>
	<div class="pension-price-toggle" role="group" aria-label="Price display">
		<button type="button" aria-pressed={realTerms} onclick={() => (realTerms = true)}>
			Real terms
		</button>
		<button type="button" aria-pressed={!realTerms} onclick={() => (realTerms = false)}>
			Actual prices
		</button>
	</div>
</div>
