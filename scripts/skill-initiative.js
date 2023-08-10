const moduleID = 'skill-initiative';

const lg = x => console.log(x);

Hooks.once('init', () => {
    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype.getInitiativeRoll', newGetInitiativeRoll, 'OVERRIDE');
    libWrapper.register(moduleID, 'CONFIG.Actor.documentClass.prototype.rollInitiativeDialog', newRollInitiativeDialog, 'OVERRIDE');
});


function newGetInitiativeRoll(options = {}) {
    if (this._cachedInitiativeRoll) return this._cachedInitiativeRoll;

    const formula = `1d20 + @details.level`;
    const data = this.getRollData();

    return new CONFIG.Dice.D20Roll(formula, data, options);
}

async function newRollInitiativeDialog(rollOptions = {}) {
    // const roll = this.getInitiativeRoll(rollOptions);

    const skillSelect = document.createElement('div');
    skillSelect.classList.add('flexrow');
    skillSelect.style['align-items'] = 'center';
    const defaultMod = this.system.details.level + this.system.abilities.dex.mod;
    const sign = defaultMod > -1 ? '+' : '';
    let skillOptions = `<option value="">No Skill (${sign}${defaultMod})</option>`;
    for (const [skl, skill] of Object.entries(CONFIG.DND5E.skills)) {
        const actorSkillTotal = this.system.skills[skl].total;
        const sign = actorSkillTotal > -1 ? '+' : '';
        skillOptions += `<option value="${skl}">${skill.label} (${sign}${actorSkillTotal})</option>`
    }
    skillSelect.innerHTML = `
        <label>Skill</label>
        <select name="skill-initiative" style="flex: 3;">
            ${skillOptions}
        </select> 
    `;

    const skill = await Dialog.wait({
        title: 'Select Skill for Initiative Roll',
        content: skillSelect.outerHTML,
        buttons: {
            select: {
                label: 'Confirm',
                callback: ([html]) => {
                    return html.querySelector('select').value;
                }
            },
            cancel: {
                label: 'Cancel'
            }
        }
    }, { id: moduleID });

    const formula = skill ? `1d20 + @skills.${skill}.total` : `1d20 + @details.level + @abilities.dex.mod`;
    const data = this.getRollData();
    const flags = this.flags.dnd5e || {};
    const options = foundry.utils.mergeObject({
        flavor: rollOptions.flavor ?? game.i18n.localize("DND5E.Initiative"),
        halflingLucky: flags.halflingLucky ?? false,
        critical: null,
        fumble: null
    }, rollOptions);
    const roll = new CONFIG.Dice.D20Roll(formula, data, options);

    const choice = await roll.configureDialog({
        defaultRollMode: game.settings.get("core", "rollMode"),
        title: `${game.i18n.localize("DND5E.InitiativeRoll")}: ${this.name}`,
        chooseModifier: false,
        defaultAction: rollOptions.advantageMode ?? dnd5e.dice.D20Roll.ADV_MODE.NORMAL
    });
    if (choice === null) return;

    this._cachedInitiativeRoll = roll;
    await this.rollInitiative({ createCombatants: true });
    delete this._cachedInitiativeRoll;
}
