import { App, PluginSettingTab, Setting } from 'obsidian';
import QuickTimestampPlugin from './main';

export interface NamedFormat {
	name: string;
	format: string;
}

export interface AIPrefix {
	prefix: string;
	format?: string;
	separator?: string;
}

export interface QuickTimestampSettings {
	formats: NamedFormat[];
	defaultFormatIndex: number;
	prefix: string;
	suffix: string;
	wrapInBold: boolean;
	wrapInCode: boolean;
	preferDailyNote: boolean;
	dailyNoteHeading: string;
	aiPrefixes: AIPrefix[];
	aiDefaultPrefix: string;
	aiSeparator: string;
	aiUseCustomFormat: boolean;
	aiFormat: string;
}

export const DEFAULT_FORMATS: NamedFormat[] = [
	{ name: 'ISO DateTime', format: 'YYYY-MM-DD HH:mm' },
	{ name: 'Time Only', format: 'HH:mm' },
	{ name: 'Locale', format: 'locale' },
	{ name: 'Full', format: 'YYYY-MM-DD HH:mm:ss' },
	{ name: 'AI Short', format: 'HH:mm' },
];

export const DEFAULT_AI_PREFIXES: AIPrefix[] = [
	{ prefix: 'Grok:', format: 'HH:mm' },
	{ prefix: 'Claude:', format: 'HH:mm' },
	{ prefix: 'ChatGPT:', format: 'HH:mm' },
	{ prefix: 'Gemini:', format: 'HH:mm' },
	{ prefix: 'User:', format: 'HH:mm' },
];

export const DEFAULT_SETTINGS: QuickTimestampSettings = {
	formats: DEFAULT_FORMATS,
	defaultFormatIndex: 0,
	prefix: '',
	suffix: '',
	wrapInBold: false,
	wrapInCode: false,
	preferDailyNote: false,
	dailyNoteHeading: '',
	aiPrefixes: DEFAULT_AI_PREFIXES,
	aiDefaultPrefix: 'Grok:',
	aiSeparator: ' ',
	aiUseCustomFormat: false,
	aiFormat: 'HH:mm',
};

export class QuickTimestampSettingTab extends PluginSettingTab {
	plugin: QuickTimestampPlugin;

	constructor(app: App, plugin: QuickTimestampPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Quick Timestamp' });

		// Named formats
		containerEl.createEl('h3', { text: 'Named formats' });
		containerEl.createEl('p', {
			text: 'Define multiple formats. The ribbon and default command use the selected default. Use the choose command to pick any of them.',
			cls: 'setting-item-description',
		});

		this.plugin.settings.formats.forEach((fmt, index) => {
			const setting = new Setting(containerEl)
				.setName(fmt.name || `Format ${index + 1}`)
				.addText((text) =>
					text
						.setPlaceholder('Name')
						.setValue(fmt.name)
						.onChange(async (value) => {
							fmt.name = value;
							await this.plugin.saveSettings();
							this.display();
						}),
				)
				.addText((text) =>
					text
						.setPlaceholder('YYYY-MM-DD HH:mm')
						.setValue(fmt.format)
						.onChange(async (value) => {
							fmt.format = value;
							await this.plugin.saveSettings();
						}),
				);

			if (this.plugin.settings.formats.length > 1) {
				setting.addExtraButton((btn) =>
					btn
						.setIcon('trash')
						.setTooltip('Remove format')
						.onClick(async () => {
							this.plugin.settings.formats.splice(index, 1);
							if (this.plugin.settings.defaultFormatIndex >= this.plugin.settings.formats.length) {
								this.plugin.settings.defaultFormatIndex = 0;
							}
							await this.plugin.saveSettings();
							this.display();
						}),
				);
			}
		});

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText('Add format')
				.onClick(async () => {
					this.plugin.settings.formats.push({ name: 'New format', format: 'YYYY-MM-DD' });
					await this.plugin.saveSettings();
					this.display();
				}),
		);

		// Default format selector
		new Setting(containerEl)
			.setName('Default format')
			.setDesc('Used by the ribbon icon and the main Insert timestamp command.')
			.addDropdown((dropdown) => {
				this.plugin.settings.formats.forEach((fmt, i) => {
					dropdown.addOption(i.toString(), fmt.name || `Format ${i + 1}`);
				});
				dropdown.setValue(this.plugin.settings.defaultFormatIndex.toString());
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultFormatIndex = parseInt(value, 10);
					await this.plugin.saveSettings();
				});
			});

		// Prefix / Suffix / Styling
		containerEl.createEl('h3', { text: 'Prefix, suffix & styling' });

		new Setting(containerEl)
			.setName('Prefix')
			.setDesc('Text inserted before the timestamp (e.g. "- " or "**")')
			.addText((text) =>
				text
					.setPlaceholder('')
					.setValue(this.plugin.settings.prefix)
					.onChange(async (value) => {
						this.plugin.settings.prefix = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Suffix')
			.setDesc('Text inserted after the timestamp')
			.addText((text) =>
				text
					.setPlaceholder('')
					.setValue(this.plugin.settings.suffix)
					.onChange(async (value) => {
						this.plugin.settings.suffix = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Wrap in bold')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.wrapInBold)
					.onChange(async (value) => {
						this.plugin.settings.wrapInBold = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Wrap in code')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.wrapInCode)
					.onChange(async (value) => {
						this.plugin.settings.wrapInCode = value;
						await this.plugin.saveSettings();
					}),
			);

		// Daily note integration
		containerEl.createEl('h3', { text: 'Daily note behavior' });

		new Setting(containerEl)
			.setName('Prefer daily note')
			.setDesc('When inserting, open or create today’s daily note if you are not already in it.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.preferDailyNote)
					.onChange(async (value) => {
						this.plugin.settings.preferDailyNote = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Insert under heading')
			.setDesc('Optional heading to insert under (creates the heading if missing). Leave blank to insert at cursor or end.')
			.addText((text) =>
				text
					.setPlaceholder('## Log')
					.setValue(this.plugin.settings.dailyNoteHeading)
					.onChange(async (value) => {
						this.plugin.settings.dailyNoteHeading = value;
						await this.plugin.saveSettings();
					}),
			);

		// AI conversation stamps
		containerEl.createEl('h3', { text: 'AI conversation stamps' });
		containerEl.createEl('p', {
			text: 'Quick prefixes for logging AI chats (e.g. “Grok: 15:37”). Used by the AI stamp command.',
			cls: 'setting-item-description',
		});

		new Setting(containerEl)
			.setName('Default AI prefix')
			.setDesc('Used by the “Insert AI stamp” command.')
			.addDropdown((dropdown) => {
				this.plugin.settings.aiPrefixes.forEach((p) => {
					dropdown.addOption(p.prefix, p.prefix);
				});
				dropdown.setValue(this.plugin.settings.aiDefaultPrefix);
				dropdown.onChange(async (value) => {
					this.plugin.settings.aiDefaultPrefix = value;
					await this.plugin.saveSettings();
				});
			});

		containerEl.createEl('p', {
			text: 'Each prefix can optionally override the format and separator. Leave blank to use the global AI settings.',
			cls: 'setting-item-description',
		});

		this.plugin.settings.aiPrefixes.forEach((item, index) => {
			const setting = new Setting(containerEl)
				.setName(item.prefix || `Prefix ${index + 1}`)
				.addText((text) =>
					text
						.setPlaceholder('Prefix (e.g. Grok:)')
						.setValue(item.prefix)
						.onChange(async (value) => {
							item.prefix = value;
							await this.plugin.saveSettings();
							this.display();
						}),
				)
				.addText((text) =>
					text
						.setPlaceholder('Format (optional)')
						.setValue(item.format || '')
						.onChange(async (value) => {
							item.format = value || undefined;
							await this.plugin.saveSettings();
						}),
				)
				.addText((text) =>
					text
						.setPlaceholder('Sep (optional)')
						.setValue(item.separator || '')
						.onChange(async (value) => {
							item.separator = value || undefined;
							await this.plugin.saveSettings();
						}),
				);

			if (this.plugin.settings.aiPrefixes.length > 1) {
				setting.addExtraButton((btn) =>
					btn
						.setIcon('trash')
						.setTooltip('Remove prefix')
						.onClick(async () => {
							this.plugin.settings.aiPrefixes.splice(index, 1);
							if (!this.plugin.settings.aiPrefixes.some(p => p.prefix === this.plugin.settings.aiDefaultPrefix)) {
								this.plugin.settings.aiDefaultPrefix = this.plugin.settings.aiPrefixes[0]?.prefix || 'Grok:';
							}
							await this.plugin.saveSettings();
							this.display();
						}),
				);
			}
		});

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText('Add AI prefix')
				.onClick(async () => {
					this.plugin.settings.aiPrefixes.push({ prefix: 'New:' });
					await this.plugin.saveSettings();
					this.display();
				}),
		);

		new Setting(containerEl)
			.setName('Separator')
			.setDesc('Text between the prefix and the timestamp (default is a single space).')
			.addText((text) =>
				text
					.setPlaceholder(' ')
					.setValue(this.plugin.settings.aiSeparator)
					.onChange(async (value) => {
						this.plugin.settings.aiSeparator = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Use custom format for AI stamps')
			.setDesc('When off, AI stamps use the global default format.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.aiUseCustomFormat)
					.onChange(async (value) => {
						this.plugin.settings.aiUseCustomFormat = value;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.aiUseCustomFormat) {
			new Setting(containerEl)
				.setName('AI stamp format')
				.setDesc('Format string used only for AI stamps.')
				.addText((text) =>
					text
						.setPlaceholder('HH:mm')
						.setValue(this.plugin.settings.aiFormat)
						.onChange(async (value) => {
							this.plugin.settings.aiFormat = value;
							await this.plugin.saveSettings();
						}),
				);
		}

		// Support / funding
		containerEl.createEl('h3', { text: 'Support' });
		containerEl.createEl('p', {
			text: 'This plugin is free. If it saves you time, consider supporting continued development.',
			cls: 'setting-item-description',
		});

		new Setting(containerEl)
			.setName('Support the developer')
			.setDesc('Opens the funding page (GitHub Sponsors, Ko-fi, etc.).')
			.addButton((btn) =>
				btn
					.setButtonText('Support')
					.setCta()
					.onClick(() => {
						const url = (this.plugin.manifest as { fundingUrl?: string }).fundingUrl || 'https://github.com/sponsors/atlas_relics';
						window.open(url, '_blank');
					}),
			);
	}
}