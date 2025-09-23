import {
    CityName,
    LocationName,
    Multipliers,
    Player as NSPlayer,
    Skills,
} from '@ns';

import { ApiCell } from 'util/sodium-api';

const dummySkills: Skills = {
    hacking: 0,
    strength: 0,
    defense: 0,
    dexterity: 0,
    agility: 0,
    charisma: 0,
    intelligence: 0,
};

const dummyMults: Multipliers = {
    hacking: 1,
    strength: 1,
    defense: 1,
    dexterity: 1,
    agility: 1,
    charisma: 1,
    hacking_exp: 1,
    strength_exp: 1,
    defense_exp: 1,
    dexterity_exp: 1,
    agility_exp: 1,
    charisma_exp: 1,
    hacking_chance: 1,
    hacking_speed: 1,
    hacking_money: 1,
    hacking_grow: 1,
    company_rep: 1,
    faction_rep: 1,
    crime_money: 1,
    crime_success: 1,
    work_money: 1,
    hacknet_node_money: 1,
    hacknet_node_purchase_cost: 1,
    hacknet_node_ram_cost: 1,
    hacknet_node_core_cost: 1,
    hacknet_node_level_cost: 1,
    bladeburner_max_stamina: 1,
    bladeburner_stamina_gain: 1,
    bladeburner_analysis: 1,
    bladeburner_success_chance: 1,
};

const dummyPlayer: NSPlayer = {
    hp: { current: 10, max: 10 },
    skills: dummySkills,
    exp: dummySkills,
    mults: dummyMults,
    city: 'Sector-12' as CityName,
    money: 0,
    numPeopleKilled: 0,
    entropy: 0,
    jobs: {},
    factions: [],
    totalPlaytime: 0,
    location: 'Travel Agency' as LocationName,
    karma: 0,
};

export const Player = new ApiCell<NSPlayer>(dummyPlayer);
