import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	TFile,
	moment,
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	NamedFormat,
	AIPrefix,
	QuickTimestampSettings,
	QuickTimestampSettingTab,
} from './settings';

// Fields Obsidian supports at runtime but does not declare in its public types.
type ManifestWithFunding = { fundingUrl?: string };
type AppWithPlugins = App & {
	plugins: {
		getPlugin(id: string): { createDailyNote?: (date: moment.Moment) => Promise<unknown> } | null;
	};
};

export default class QuickTimestampPlugin extends Plugin {
	settings!: QuickTimestampSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('clock', 'Insert Timestamp', async (_evt: MouseEvent) => {
			await this.insertTimestamp();
		});

		this.addCommand({
			id: 'insert-timestamp',
			name: 'Insert timestamp (default)',
			editorCallback: async (editor: Editor) => {
				await this.insertTimestamp(editor);
			},
		});

		this.addCommand({
			id: 'insert-timestamp-choose',
			name: 'Insert timestamp (choose format)',
			editorCallback: (editor: Editor) => {
				new TimestampModal(this.app, this, editor).open();
			},
		});

		this.addCommand({
			id: 'insert-timestamp-daily',
			name: 'Insert timestamp in daily note',
			callback: async () => {
				await this.insertInDailyNote();
			},
		});

		this.addCommand({
			id: 'insert-ai-stamp',
			name: 'Insert AI conversation stamp',
			editorCallback: (editor: Editor) => {
				new AIStampModal(this.app, this, editor).open();
			},
		});

		this.addCommand({
			id: 'insert-ai-stamp-default',
			name: 'Insert AI stamp (default prefix)',
			editorCallback: async (editor: Editor) => {
				const prefixObj = this.settings.aiPrefixes.find(p => p.prefix === this.settings.aiDefaultPrefix)
					|| this.settings.aiPrefixes[0];
				if (prefixObj) {
					await this.insertAIStamp(editor, prefixObj);
				}
			},
		});

		this.addCommand({
			id: 'support-developer',
			name: 'Support the developer',
			callback: () => {
				const url = (this.manifest as ManifestWithFunding).fundingUrl || 'https://github.com/sponsors/bzucker4';
				window.open(url, '_blank');
			},
		});

		this.addSettingTab(new QuickTimestampSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<QuickTimestampSettings>,
		);
		if (!this.settings.formats || this.settings.formats.length === 0) {
			this.settings.formats = DEFAULT_SETTINGS.formats;
		}
		if (!this.settings.aiPrefixes || this.settings.aiPrefixes.length === 0) {
			this.settings.aiPrefixes = DEFAULT_SETTINGS.aiPrefixes;
		} else if (typeof this.settings.aiPrefixes[0] === 'string') {
			this.settings.aiPrefixes = (this.settings.aiPrefixes as unknown as string[]).map(p => ({ prefix: p }));
		}
		if (!this.settings.aiDefaultPrefix) {
			this.settings.aiDefaultPrefix = DEFAULT_SETTINGS.aiDefaultPrefix;
		}
		if (this.settings.aiSeparator === undefined) {
			this.settings.aiSeparator = DEFAULT_SETTINGS.aiSeparator;
		}
		if (this.settings.aiUseCustomFormat === undefined) {
			this.settings.aiUseCustomFormat = DEFAULT_SETTINGS.aiUseCustomFormat;
		}
		if (!this.settings.aiFormat) {
			this.settings.aiFormat = DEFAULT_SETTINGS.aiFormat;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	formatTimestamp(format: string): string {
		const now = new Date();
		if (format === 'locale') {
			return now.toLocaleString();
		}
		try {
			if (typeof moment !== 'undefined') {
				return moment().format(format);
			}
		} catch {
			// Fall back to the built-in token formatter if Moment rejects the format.
		}
		const pad = (n: number) => n.toString().padStart(2, '0');
		const tokens: Record<string, string> = {
			YYYY: now.getFullYear().toString(),
			MM: pad(now.getMonth() + 1),
			DD: pad(now.getDate()),
			HH: pad(now.getHours()),
			mm: pad(now.getMinutes()),
			ss: pad(now.getSeconds()),
		};
		let result = format;
		for (const [token, value] of Object.entries(tokens)) {
			result = result.replaceAll(token, value);
		}
		return result;
	}

	applyStyling(timestamp: string): string {
		let result = timestamp;
		if (this.settings.wrapInCode) {
			result = '`' + result + '`';
		}
		if (this.settings.wrapInBold) {
			result = '**' + result + '**';
		}
		return this.settings.prefix + result + this.settings.suffix;
	}

	getDefaultFormat(): NamedFormat {
		const idx = Math.min(
			this.settings.defaultFormatIndex,
			this.settings.formats.length - 1,
		);
		return this.settings.formats[idx] ?? this.settings.formats[0] ?? { name: 'ISO DateTime', format: 'YYYY-MM-DD HH:mm' };
	}

	async insertTimestamp(editor?: Editor, formatOverride?: string) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const activeEditor = editor ?? view?.editor;
		if (!activeEditor) {
			new Notice('No active editor');
			return;
		}
		const fmt = formatOverride ?? this.getDefaultFormat().format;
		const raw = this.formatTimestamp(fmt);
		const finalText = this.applyStyling(raw);
		activeEditor.replaceSelection(finalText);
	}

	async insertInDailyNote() {
		const dailyNotes = (this.app as AppWithPlugins).plugins.getPlugin('daily-notes');
		if (!dailyNotes) {
			new Notice('Daily Notes core plugin is not enabled');
			return;
		}
		const todayFile = await dailyNotes.createDailyNote?.(moment()) ?? null;
		if (!todayFile) {
			new Notice('Could not open or create today’s daily note');
			return;
		}
		const leaf = this.app.workspace.getLeaf(false);
		if (todayFile instanceof TFile) {
			await leaf.openFile(todayFile);
		}
		await new Promise((r) => window.setTimeout(r, 100));
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;
		const editor = view.editor;
		const heading = this.settings.dailyNoteHeading.trim();
		if (heading) {
			const content = editor.getValue();
			const headingLine = content.split('\n').findIndex((line) =>
				line.trim().startsWith(heading),
			);
			if (headingLine >= 0) {
				editor.setCursor(headingLine + 1, 0);
			} else {
				editor.setCursor(editor.lineCount(), 0);
				editor.replaceSelection('\n' + heading + '\n');
			}
		} else {
			editor.setCursor(editor.lineCount(), 0);
		}
		await this.insertTimestamp(editor);
	}

	async insertAIStamp(editor: Editor, prefixObj: AIPrefix) {
		const fmt = prefixObj.format
			|| (this.settings.aiUseCustomFormat ? this.settings.aiFormat : this.getDefaultFormat().format);
		const raw = this.formatTimestamp(fmt);
		const separator = prefixObj.separator ?? this.settings.aiSeparator ?? ' ';
		const stamp = `${prefixObj.prefix}${separator}${raw}`;
		const finalText = this.applyStyling(stamp);
		editor.replaceSelection(finalText);
	}
}

class TimestampModal extends Modal {
	plugin: QuickTimestampPlugin;
	editor: Editor;
	constructor(app: App, plugin: QuickTimestampPlugin, editor: Editor) {
		super(app);
		this.plugin = plugin;
		this.editor = editor;
	}
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Choose format' });
		for (const fmt of this.plugin.settings.formats) {
			const btn = contentEl.createEl('button', { text: fmt.name || fmt.format });
			btn.addClass('quick-timestamp-modal-button');
			btn.onclick = async () => {
				await this.plugin.insertTimestamp(this.editor, fmt.format);
				this.close();
			};
		}
	}
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class AIStampModal extends Modal {
	plugin: QuickTimestampPlugin;
	editor: Editor;
	constructor(app: App, plugin: QuickTimestampPlugin, editor: Editor) {
		super(app);
		this.plugin = plugin;
		this.editor = editor;
	}
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'AI conversation stamp' });
		for (const prefixObj of this.plugin.settings.aiPrefixes) {
			const btn = contentEl.createEl('button', { text: prefixObj.prefix });
			btn.addClass('quick-timestamp-modal-button');
			btn.onclick = async () => {
				await this.plugin.insertAIStamp(this.editor, prefixObj);
				this.close();
			};
		}
	}
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
