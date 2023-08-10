const moduleID = 'skill-initiative';

const lg = x => console.log(x);

const proficiencyBonusMap = {
    1: 2,
    0.5: 1,
    2: 4,
    3: 6,
    4: 8,
    5: 10,
    6: 12,
    7: 14
};


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
    const defaultMod = (this.system.details.level || Math.max(1, this.system.details.cr)) + this.system.abilities.dex.mod;
    const sign = defaultMod > -1 ? '+' : '';
    let skillOptions = `<option value="">No Skill (${sign}${defaultMod})</option>`;
    const skillBonusMap = {};
    for (const [skl, skill] of Object.entries(CONFIG.DND5E.skills)) {
        const actorSkillTotal = (this.system.skills[skl].mod || 0) + getBonus(this, this.flags['proficiency-levels']?.system?.skills?.[skl]?.value || this.system.skills[skl].value);
        skillBonusMap[skl] = actorSkillTotal;
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

    const formula = skill ? `1d20 + ${skillBonusMap[skill]}` : `1d20 + ${this.system.details.level || Math.max(1, this.system.details.cr)} + @abilities.dex.mod`;
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

function getBonus(actor, proficiencyLevel) {
    const level = (actor.system.details.level || Math.max(1, actor.system.details.cr));

    if (!proficiencyLevel) return 0;
    if (proficiencyLevel === 0.5) return Math.floor(level / 2) + 1;
    return level + proficiencyBonusMap[proficiencyLevel];
}
