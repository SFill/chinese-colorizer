import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { pinyin } from "pinyin-pro";
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

interface ToneColorSettings {
    tone1: string;
    tone2: string;
    tone3: string;
    tone4: string;
    tone0: string;
}

const DEFAULT_SETTINGS: ToneColorSettings = {
    tone1: "blue",
    tone2: "green",
    tone3: "black",
    tone4: "red",
    tone0: "gray"
};

export default class ChineseColorEditorPlugin extends Plugin {
    settings: ToneColorSettings;

    async onload() {
        console.log("Loading Chinese Color Editor Plugin");
        await this.loadSettings();
        this.addSettingTab(new ChineseColorEditorSettingTab(this.app, this));

        // Register the editor extension
        this.registerEditorExtension(chineseColorViewPlugin(this.settings));
    }

    onunload() {
        console.log("Unloading Chinese Color Editor Plugin");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class ChineseColorEditorSettingTab extends PluginSettingTab {
    plugin: ChineseColorEditorPlugin;

    constructor(app: App, plugin: ChineseColorEditorPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Chinese Color Editor Settings" });

        new Setting(containerEl)
            .setName("Tone 1 Color")
            .setDesc("Color for first tone")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.tone1)
                    .onChange(async (value) => {
                        this.plugin.settings.tone1 = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Tone 2 Color")
            .setDesc("Color for second tone")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.tone2)
                    .onChange(async (value) => {
                        this.plugin.settings.tone2 = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Tone 3 Color")
            .setDesc("Color for third tone")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.tone3)
                    .onChange(async (value) => {
                        this.plugin.settings.tone3 = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Tone 4 Color")
            .setDesc("Color for fourth tone")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.tone4)
                    .onChange(async (value) => {
                        this.plugin.settings.tone4 = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Neutral Tone Color")
            .setDesc("Color for neutral/no tone")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.tone0)
                    .onChange(async (value) => {
                        this.plugin.settings.tone0 = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}

function chineseColorViewPlugin(settings: ToneColorSettings) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.computeDecorations(view, settings);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.computeDecorations(update.view, settings);
            }
        }

        computeDecorations(view: EditorView, settings: ToneColorSettings): DecorationSet {
            const builder = new RangeSetBuilder<Decoration>();
            const text = view.state.doc.toString();
            // Only consider the visible viewport for performance
            const { from, to } = view.viewport;
            
            for (let pos = from; pos < to; ) {
                const char = text[pos];
                const charSize = char.codePointAt(0)! > 0xffff ? 2 : 1; // Handle surrogate pairs if needed
                if (isChineseChar(char)) {
                    const pyArr = pinyin(char, { toneType: 'num', type: 'array' });
                    const numericPinyin = pyArr[0] || "";
                    const { accented, color } = getAccentedColoredPinyin(numericPinyin, settings);

                    const deco = Decoration.mark({
                        attributes: {
                            style: `color:${color};`,
                            title: accented
                        }
                    });
                    builder.add(pos, pos + charSize, deco);
                }
                pos += charSize;
            }

            return builder.finish();
        }
    }, {
        decorations: v => v.decorations
    });
}

function isChineseChar(char: string): boolean {
    return /[\u4E00-\u9FFF]/.test(char);
}

function getAccentedColoredPinyin(numericPinyin: string, settings: ToneColorSettings): {accented: string; color: string} {
    const match = numericPinyin.match(/^([a-züÜ]+)(\d)?$/i);
    if (!match) {
        return { accented: numericPinyin, color: settings.tone0 };
    }

    const [_, base, toneStr] = match;
    const tone = toneStr ? parseInt(toneStr, 10) : 0;

    let color = settings.tone0;
    if (tone === 1) color = settings.tone1;
    else if (tone === 2) color = settings.tone2;
    else if (tone === 3) color = settings.tone3;
    else if (tone === 4) color = settings.tone4;

    const accented = addToneMark(base, tone);
    return { accented, color };
}

function addToneMark(syllable: string, tone: number): string {
    if (tone < 1 || tone > 4) return syllable;

    const toneMap: Record<string, string[]> = {
        a: ["ā", "á", "ǎ", "à"],
        e: ["ē", "é", "ě", "è"],
        i: ["ī", "í", "ǐ", "ì"],
        o: ["ō", "ó", "ǒ", "ò"],
        u: ["ū", "ú", "ǔ", "ù"],
        ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
        A: ["Ā", "Á", "Ǎ", "À"],
        E: ["Ē", "É", "Ě", "È"],
        I: ["Ī", "Í", "Ǐ", "Ì"],
        O: ["Ō", "Ó", "Ǒ", "Ò"],
        U: ["Ū", "Ú", "Ǔ", "Ù"],
        Ü: ["Ǖ", "Ǘ", "Ǚ", "Ǜ"]
    };

    const vowelsOrder = ["a", "A", "o", "O", "e", "E"];
    let targetIdx = -1;
    let chosenVowel = "";

    for (const v of vowelsOrder) {
        targetIdx = syllable.indexOf(v);
        if (targetIdx !== -1) {
            chosenVowel = v;
            break;
        }
    }

    if (targetIdx === -1) {
        const vowelMatch = syllable.match(/[iIuUüÜ]/g);
        if (vowelMatch) {
            const lastVowel = vowelMatch[vowelMatch.length - 1];
            chosenVowel = lastVowel;
            targetIdx = syllable.lastIndexOf(lastVowel);
        }
    }

    if (targetIdx !== -1 && toneMap[chosenVowel]) {
        return syllable.slice(0, targetIdx) + toneMap[chosenVowel][tone - 1] + syllable.slice(targetIdx + 1);
    }

    return syllable;
}
