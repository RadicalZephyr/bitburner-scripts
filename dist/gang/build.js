export async function main(ns) {
    const currentNames = new Set(ns.gang.getMemberNames());
    const unusedNames = new Array(...(difference(names, currentNames).keys()));
    let nameIndex = 0;
    while (ns.gang.canRecruitMember()) {
        const name = unusedNames[nameIndex++];
        if (ns.gang.recruitMember(name)) {
            ns.gang.setMemberTask(name, "Train Hacking");
        }
        await ns.sleep(10);
    }
}
function difference(setA, setB) {
    let _difference = new Set(setA);
    for (let elem of setB) {
        _difference.delete(elem);
    }
    return _difference;
}
const names = new Set([
    "Freya",
    "Frigg",
    "Gefion",
    "Idun",
    "Sif",
    "Sigyn",
    "Eir",
    "Fulla",
    "Gna",
    "Hlin",
    "Ilmrxs",
    "Hel",
    "Achelois",
    "Alcyone",
    "Alectrona",
    "Amphitrite",
    "Antheia",
    "Apate",
    "Aphaea",
    "Aphrodite",
    "Artemis",
    "Astraea",
    "Até",
    "Athena",
    "Atropos",
    "Bia",
    "Brizo",
    "Calliope",
    "Calypso",
    "Celaeno",
    "Ceto",
    "Circe",
    "Clio",
    "Clotho",
    "Cybele",
    "Demeter",
    "Doris",
    "Eileithyia",
    "Electra",
    "Elpis",
    "Enyo",
    "Eos",
    "Erato",
    "Eris",
    "Euterpe",
    "Gaia",
    "Harmonia",
    "Hebe",
    "Hecate",
    "Hemera",
    "Hera",
    "Hestia",
    "Hygea",
    "Iris",
    "Keres",
    "Kotys",
    "Lachesis",
    "Maia",
    "Mania",
    "Melpomene",
    "Merope",
    "Metis",
    "Nemesis",
    "Nike",
    "Nyx",
    "Peitho",
    "Persephone",
    "Pheme",
    "Polyhymnia",
    "Rhea",
    "Selene",
    "Sterope",
    "Styx",
    "Taygete",
    "Terpsichore",
    "Thalia"
]);
