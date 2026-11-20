import { describe, expect, test } from "bun:test";
import { buildCfHtml, buildHtmlDocument, renderMarkdown } from "../src/index";

describe("safe Markdown rendering", () => {
	test("renders useful formatting", () => {
		const html = renderMarkdown("# Heading\n\n- **bold**\n- `code`");
		expect(html).toContain("<h1>Heading</h1>");
		expect(html).toContain("<strong>bold</strong>");
		expect(html).toContain("<code>code</code>");
	});

	test("does not emit raw HTML, active links, or remote images", () => {
		const html = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![pixel](https://tracker.invalid/pixel)');
		expect(html).not.toContain("<script>");
		expect(html).not.toContain("javascript:");
		expect(html).not.toContain("<img");
		expect(html).not.toContain("tracker.invalid");
		expect(html).toContain("[Image: pixel]");
	});
});

describe("clipboard formats", () => {
	test("builds an HTML document with fragment markers", () => {
		const html = buildHtmlDocument("**hello**");
		expect(html).toContain("<!--StartFragment-->");
		expect(html).toContain("<strong>hello</strong>");
		expect(html).toContain("<!--EndFragment-->");
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
		expect(new TextDecoder().decode(bytes.slice(startHtml, endHtml))).toBe(html);
		expect(new TextDecoder().decode(bytes.slice(startFragment, endFragment))).toContain("Hello 👋");
	});
});
