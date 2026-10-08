<script>
	import { setContext } from "svelte";
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import { createDefaultDraft } from "$lib/pension-draft.js";
	import "@onsvisual/svelte-components/css/main.css";
	import "maplibre-gl/dist/maplibre-gl.css";
	import "../app.css";

	let { children } = $props();
	const draft = $state(createDefaultDraft());
	setContext("pension-draft", draft);
	setContext("price-display", draft.settings);
</script>

{#if page.route.id === "/" || page.route.id === "/withdrawals" || page.route.id === "/projection"}
	<div class="pension-app">
		<header class="pension-header">
			<div class="pension-container pension-header-inner">
				<a class="pension-brand" href={resolve("/")}
					>Pension planner<span aria-hidden="true">.</span></a
				>
				<nav aria-label="Calculator pages" class="pension-navigation">
					<a href={resolve("/")} aria-current={page.route.id === "/" ? "page" : undefined}
						>Pensions</a
					>
					<a
						href={resolve("/withdrawals/")}
						aria-current={page.route.id === "/withdrawals" || page.route.id === "/projection"
							? "page"
							: undefined}>Withdrawals</a
					>
				</nav>
			</div>
		</header>
		<main class="pension-container pension-main">{@render children()}</main>
	</div>
{:else}
	{@render children()}
{/if}
