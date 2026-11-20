import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { Marked } from "@oh-my-pi/pi-utils/marked";
import { fileURLToPath } from "node:url";

const START_FRAGMENT = "<!--StartFragment-->";
const END_FRAGMENT = "<!--EndFragment-->";

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function safeHref(href: string): string | null {
	const trimmed = href.trim();
	try {
		const { protocol } = new URL(trimmed, "https://relative.invalid/");
		return protocol === "https:" || protocol === "http:" || protocol === "mailto:" ? trimmed : null;
	} catch {
		return null;
	}
}

const markdown = new Marked({
	gfm: true,
	breaks: true,
	renderer: {
		html({ text }) {
			return escapeHtml(text);
		},
		link({ href, title, tokens }) {
			const inner = this.parser.parseInline(tokens);
			const url = safeHref(href);
			if (url === null) return inner;
			const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
			return `<a href="${escapeHtml(url)}"${titleAttribute}>${inner}</a>`;
		},
		image({ text }) {
			return text ? `<span>[Image: ${escapeHtml(text)}]</span>` : "<span>[Image]</span>";
		},
	},
});

export function renderMarkdown(markdownText: string): string {
	try {
		const rendered = markdown.parse(markdownText, { async: false });
		return typeof rendered === "string" ? rendered : escapeHtml(markdownText);
	} catch {
		return escapeHtml(markdownText);
	}
}

export function buildHtmlDocument(markdownText: string): string {
	const body = renderMarkdown(markdownText);
	return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:11pt;line-height:1.45;color:#1f2328}
p{margin:0 0 10px}h1,h2,h3,h4,h5,h6{margin:16px 0 8px;line-height:1.25}
ul,ol{margin:0 0 10px;padding-left:24px}li{margin:2px 0}
pre{margin:0 0 10px;padding:10px;background:#f6f8fa;border:1px solid #d0d7de;border-radius:4px;white-space:pre-wrap}
code{font-family:Menlo,Consolas,monospace;background:#f6f8fa;padding:1px 3px;border-radius:3px}pre code{padding:0;background:transparent}
blockquote{margin:0 0 10px;padding-left:12px;border-left:3px solid #d0d7de;color:#59636e}
table{border-collapse:collapse;margin:0 0 10px}th,td{border:1px solid #d0d7de;padding:5px 8px;text-align:left}
a{color:#0969da;text-decoration:underline}
</style></head><body>${START_FRAGMENT}<div>${body}</div>${END_FRAGMENT}</body></html>`;
}

function utf8Length(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function offset(value: number): string {
	const formatted = String(value).padStart(10, "0");
	if (formatted.length !== 10) throw new Error("Clipboard HTML is too large for CF_HTML offsets");
	return formatted;
}

export function buildCfHtml(html: string): string {
	const fragmentStartIndex = html.indexOf(START_FRAGMENT);
	const fragmentEndIndex = html.indexOf(END_FRAGMENT);
	if (fragmentStartIndex < 0 || fragmentEndIndex < fragmentStartIndex) {
		throw new Error("HTML document is missing clipboard fragment markers");
	}

	const headerTemplate =
		"Version:0.9\r\nStartHTML:0000000000\r\nEndHTML:0000000000\r\nStartFragment:0000000000\r\nEndFragment:0000000000\r\n";
	const startHtml = utf8Length(headerTemplate);
	const endHtml = startHtml + utf8Length(html);
	const startFragment = startHtml + utf8Length(html.slice(0, fragmentStartIndex + START_FRAGMENT.length));
	const endFragment = startHtml + utf8Length(html.slice(0, fragmentEndIndex));
	const header =
		`Version:0.9\r\nStartHTML:${offset(startHtml)}\r\nEndHTML:${offset(endHtml)}\r\n` +
		`StartFragment:${offset(startFragment)}\r\nEndFragment:${offset(endFragment)}\r\n`;
	return header + html;
}

function latestAssistantMarkdown(branch: readonly unknown[]): string | undefined {
	for (let index = branch.length - 1; index >= 0; index--) {
		const entry = branch[index] as {
			type?: string;
			message?: { role?: string; content?: string | Array<{ type?: string; text?: string }> };
		};
		if (entry.type !== "message" || entry.message?.role !== "assistant") continue;
		const { content } = entry.message;
		const text =
			typeof content === "string"
				? content
				: Array.isArray(content)
					? content
							.filter((block): block is { type: string; text: string } => block.type === "text" && typeof block.text === "string")
							.map(block => block.text)
							.join("\n\n")
					: "";
		if (text.trim()) return text;
	}
	return undefined;
}

async function runHelper(command: string[], payload: unknown): Promise<void> {
	const child = Bun.spawn(command, {
		stdin: new TextEncoder().encode(JSON.stringify(payload)),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
	if (exitCode !== 0) throw new Error(stderr.trim() || `${command[0]} exited with code ${exitCode}`);
}

export async function writeRichClipboard(plainText: string, html: string): Promise<void> {
	if (process.platform === "darwin") {
		const helper = fileURLToPath(new URL("./helpers/write-macos.swift", import.meta.url));
		await runHelper(["/usr/bin/swift", helper], { plainText, html });
		return;
	}
	if (process.platform === "win32") {
		const helper = fileURLToPath(new URL("./helpers/write-windows.ps1", import.meta.url));
		const powershell = Bun.which("powershell.exe") ?? Bun.which("pwsh.exe") ?? Bun.which("pwsh");
		if (!powershell) throw new Error("PowerShell is required to write rich clipboard data on Windows");
		await runHelper([powershell, "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", helper], {
			plainText,
			cfHtml: buildCfHtml(html),
		});
		return;
	}
	throw new Error(`Rich clipboard copying is not supported on ${process.platform}`);
}

export default function richCopyExtension(pi: ExtensionAPI): void {
	pi.setLabel("Rich Copy");
	pi.registerCommand("copy-rich", {
		description: "Copy the latest assistant reply as rich HTML and plain text",
		handler: async (args, ctx) => {
			if (args.trim()) {
				ctx.ui.notify("Usage: /copy-rich", "warning");
				return;
			}
			const plainText = latestAssistantMarkdown(ctx.sessionManager.getBranch());
			if (!plainText) {
				ctx.ui.notify("No assistant reply to copy", "warning");
				return;
			}
			try {
				await writeRichClipboard(plainText, buildHtmlDocument(plainText));
				ctx.ui.notify("Copied latest assistant reply as rich text", "info");
			} catch (error) {
				ctx.ui.notify(`Rich copy failed: ${error instanceof Error ? error.message : String(error)}`, "error");
			}
		},
	});
}
