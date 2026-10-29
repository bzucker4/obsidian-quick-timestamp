import {
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
				const url = (this.manifest as { fundingUrl?: string }).fundingUrl || 'https://github.com/sponsors/bzucker4';
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
		// Ensure formats array always exists
		if (!this.settings.formats || this.settings.formats.length === 0) {
			this.settings.formats = DEFAULT_SETTINGS.formats;
		}
		if (!this.settings.aiPrefixes || this.settings.aiPrefixes.length === 0) {
			this.settings.aiPrefixes = DEFAULT_SETTINGS.aiPrefixes;
		} else if (typeof this.settings.aiPrefixes[0] === 'string') {
			// Migrate old string[] format
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

		// Use moment if available for richer formatting, fall back to simple tokens
		try {
			if (typeof moment !== 'undefined') {
				return moment().format(format);
			}
		} catch {
			// fall through
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
		return this.settings.formats[idx] ?? this.settings.formats[0] ?? DEFAULT_SETTINGS.formats[0]!;
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
		// Daily Notes is a core plugin; read its settings via the internal plugin registry.
		const internal = (this.app as unknown as {
			internalPlugins?: { getPluginById(id: string): { enabled: boolean; instance?: { options?: { format?: string; folder?: string; template?: string } } } | null };
		}).internalPlugins?.getPluginById('daily-notes');
		if (!internal || !internal.enabled) {
			new Notice('Daily Notes core plugin is not enabled');
			return;
		}
		const opts = internal.instance?.options ?? {};
		const fileName = moment().format(opts.format || 'YYYY-MM-DD');
		const folder = (opts.folder || '').replace(/^\/+|\/+$/g, '');
		const path = (folder ? folder + '/' : '') + fileName + '.md';
		let todayFile: TFile | null = null;
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			todayFile = existing;
		} else {
			try {
				if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
					await this.app.vault.createFolder(folder);
				}
				let initial = '';
				const tplPath = opts.template ? opts.template.replace(/\.md$/, '') + '.md' : '';
				const tpl = tplPath ? this.app.vault.getAbstractFileByPath(tplPath) : null;
				if (tpl instanceof TFile) initial = await this.app.vault.read(tpl);
				todayFile = await this.app.vault.create(path, initial);
			} catch (e) {
				console.error('Quick Timestamp: failed to create daily note', e);
			}
		}

		if (!todayFile) {
			new Notice('Could not open or create today’s daily note');
			return;
		}

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(todayFile as TFile);

		// Wait a tick for the editor to be ready
		await new Promise((r) => setTimeout(r, 100));

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

	constructor(app: any, plugin: QuickTimestampPlugin, editor: Editor) {
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
			btn.style.display = 'block';
			btn.style.margin = '6px 0';
			btn.style.width = '100%';
			btn.style.textAlign = 'left';
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

	constructor(app: any, plugin: QuickTimestampPlugin, editor: Editor) {
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
			btn.style.display = 'block';
			btn.style.margin = '6px 0';
			btn.style.width = '100%';
			btn.style.textAlign = 'left';
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