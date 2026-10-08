# sveltekit-starter

Starter page templates using the [ONS svelte-components library](https://github.com/ONSvisual/svelte-components/).

**[→ View live demo](https://onsdigital.github.io/sveltekit-starter/)**

## Using these templates

Create a fork or local copy of this repository ([ZIP download](https://github.com/ONSvisual/sveltekit-starter/archive/refs/heads/main.zip)), and then run the following command to install dependencies:

```bash
npm install
```

With dependencies installed, you should be able to preview the templates locally at [localhost:5173](http://localhost:5173) using the following command:

```bash
npm run dev
```

You will find the code for the starter templates within the /src/routes/ folder. You will probably want to take the **+page.svelte** file for the relevant template folder, overwrite the **/src/routes/+pages.svelte** file, and then delete the templates that you don't intend to use.

To do more with the ONS svelte-components library, you will probably want to refer to the [Storybook pages](https://onsvisual.github.io/svelte-components/).

## Building and Deploying

When you're ready to publish the app (either for preview or for production), you'll need to run the **build** or **build:preview** command. This will build a static version of the app in the **/build** folder, the contents of which can be copied to wherever you want to host the app:

```bash
npm run build
```

There is no automatic GitHub Pages deployment. Build locally and publish the output manually when needed.

### Configuration

The base paths for the preview and production builds are set in the **/src/app.config.js** file:

```javascript
export const base_prod = null; // Directory on the ONS website (null = any path)
export const base_preview = "/sveltekit-starter"; // Directory on datavisweb preview server
```

- **null** (the default for production) builds the app with relative URLs. The contents of the **/build** folder can then be deployed to any path or sub-path.
- **A path** (eg. **/visualisations/my-app**) builds the app for that directory only, with absolute URLs.

The preview build needs a path, because it isn't prerendered and relies on a **404.html** fallback page, which always uses absolute URLs.

For this GitHub Pages deployment at `https://onssambennett.github.io/pension-calculator/calculator/`, use `npm run build`. This prerenders the routes with relative asset URLs, so the contents of **/build** can be published inside the repository's **/calculator** directory. Keep a **.nojekyll** file at the published site's root; GitHub Pages otherwise omits SvelteKit's `_app` asset directory. The **build:preview** command is for the separate SPA preview path, not this deployment.

To build the preview version of the app, which uses the alternate **base_preview** path, you'll need to run this command:

```bash
npm run build:preview
```

## Additional templates

The following semi-automated journalism (AKA "robo-journalism") templates are also available:

- [robo-article](https://github.com/ONSvisual/robo-article)
- [robo-embed](https://github.com/ONSvisual/robo-embed)
