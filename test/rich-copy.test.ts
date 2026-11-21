import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildCfHtml, buildHtmlDocument, renderMarkdown } from "../src/index.ts";

describe("safe Markdown rendering", () => {
	test("renders useful formatting", () => {
		const html = renderMarkdown("# Heading\n\n- **bold**\n- `code`");
		assert.match(html, /<h1>Heading<\/h1>/);
		assert.match(html, /<strong>bold<\/strong>/);
		assert.match(html, /<code>code<\/code>/);
	});

	test("does not emit raw HTML, active links, or remote images", () => {
		const html = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![pixel](https://tracker.invalid/pixel)');
		assert.doesNotMatch(html, /<script>/);
		assert.doesNotMatch(html, /javascript:/);
		assert.doesNotMatch(html, /<img/);
		assert.doesNotMatch(html, /tracker\.invalid/);
		assert.match(html, /\[Image: pixel\]/);
	});
});

describe("clipboard formats", () => {
	test("builds an HTML document with fragment markers", () => {
		const html = buildHtmlDocument("**hello**");
		assert.match(html, /<!--StartFragment-->/);
		assert.match(html, /<strong>hello<\/strong>/);
		assert.match(html, /<!--EndFragment-->/);
	});

	test("builds byte-correct CF_HTML offsets for Unicode", () => {
		const html = buildHtmlDocument("Hello 👋");
		const cfHtml = buildCfHtml(html);
		const bytes = new TextEncoder().encode(cfHtml);
		const value = (name: string) => Number(new RegExp(`${name}:(\\d{10})`).exec(cfHtml)?.[1]);
		const startHtml = value("StartHTML");
		const endHtml = value("EndHTML");
		const startFragment = value("StartFragment");
		const endFragment = value("EndFragment");
		assert.equal(new TextDecoder().decode(bytes.slice(startHtml, endHtml)), html);
		assert.match(new TextDecoder().decode(bytes.slice(startFragment, endFragment)), /Hello 👋/);
	});
});
