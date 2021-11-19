Hooks.on("init", () => {
    game.settings.register("the-expanse-salvage-op", "initialized", {
        name: "Initialization",
        scope: "world",
        config: false,
        default: false,
        type: Boolean
    });

    game.settings.registerMenu("the-expanse-salvage-op", "init-dialogue", {
        name: "The Expanse Salvage-Op Setup",
        label: "Setup",
        hint: "Import or update the content from The Expanse Salvage-Op Module",
        type: TheExpanseSOInitWrapper,
        restricted: true
    })
})

Hooks.on("ready", () => {
    if (!game.settings.get("the-expanse-salvage-op", "initialized") && game.user.isGM) {
        new TheExpanseSOInitialization().render(true)
    }
})

class TheExpanseSOInitWrapper extends FormApplication {
    render() {
        new TheExpanseSOInitialization().render(true);
    }
}
 
class TheExpanseSOInitialization extends Dialog {
    constructor() {
        super({
            title: "The Expanse Salvage-Op Initialization",
            content: `<p>Initializing Module for The Expanse Salvage-Op.</p>`,
            module: game.modules.get("the-expanse-salvage-op"),
            buttons: {
                initialize: {
                    label: "Initialize",
                    callback: async () => {
                        game.settings.set("the-expanse-salvage-op", "initialized", true)
                        await new TheExpanseSOInitialization().initialize()
                        ui.notifications.notify("Initialization Complete")
                    }
                },
                update: {
                    label: "Update",
                    callback: async () => {
                        let updater = await game.the - TheExpanseSOInitialization.apps.ModuleUpdater.create(game.modules.get("the-expanse-salvage-op"), this)
                        updater.render(true)
                    }
                },
                no: {
                    label: "No",
                    callback: () => {
                        game.settings.set("the-expanse-salvage-op", "initialized", true)
                        ui.notifications.notify("Skipped Initialization.")
                    }
                }
            }
        })

        this.folders = {
            "Scene": {},
            "Item": {},
            "Actor": {},
            "JournalEntry": {}
        }

        this.journals = {};
        this.actors = {};
        this.items = {};
        this.scenes = {};
        this.moduleKey = "the-expanse-salvage-op";
    }

    async initialize() {
        return new Promise((resolve) => {
            fetch(`modules/${this.moduleKey}/initialization.json`).then(async r => r.json()).then(async json => {
                let createdFolders = await Folder.create(json)
                for (let folder of createdFolders)
                    this.folders[folder.data.type][folder.data.name] = folder;

                for (let folderType in this.folders) {
                    for (let folder in this.folders[folderType]) {

                        let parent = this.folders[folderType][folder].getFlag(this.moduleKey, "initialization-parent")
                        if (parent) {
                            let parentId = this.folders[folderType][parent].id
                            await this.folders[folderType][folder].update({ parent: parentId })
                        }
                    }
                }

                await this.initializeEntities()
                /* This need's to be turned on when scenes are present */
                await this.initializeScenes()
                resolve()

            })
        })
    }

    async initializeEntities() {

        let packList = this.data.module.data.flags.initializationPacks
        console.log(packList);
        for (let pack of packList) {
            console.log(pack);
                    if (game.packs.get(pack).metadata.entity == "Scene")
                continue
            let documents = await game.packs.get(pack).getDocuments();
            console.log(documents);
            for (let document of documents) {
                console.log(document);
                let folder = document.getFlag(this.moduleKey, "initialization-folder")
                console.log(folder);
                if (folder)
                    document.data.update({ "folder": this.folders[document.documentName][folder].id })
                if (document.data.flags[this.moduleKey].sort)
                    document.data.update({ "sort": document.data.flags[this.moduleKey].sort })
            }
            switch (documents[0].documentName) {
                case "Actor":
                    ui.notifications.notify("Initializing Actors")
                    await Actor.create(documents.map(c => c.data))
                    break;
                case "Item":
                    ui.notifications.notify("Initializing Items")
                    await Item.create(documents.map(c => c.data))
                    break;
                case "JournalEntry":
                    ui.notifications.notify("Initializing Journals")
                    let createdEntries = await JournalEntry.create(documents.map(c => c.data))
                    for (let entry of createdEntries)
                        this.journals[entry.data.name] = entry
                    break;
            }
        }
    }


     /*This need's to be turned one when there are scenes to import */
    async initializeScenes() {
        ui.notifications.notify("Initializing Scenes")
        let m = game.packs.get(`${this.moduleKey}.scenes-salvage-op`)
        let maps = await m.getDocuments()
        for (let map of maps) {
            let folder = map.getFlag(this.moduleKey, "initialization-folder")
            if (folder)
                map.data.update({ "folder": this.folders["Scene"][folder].id })
        }
        await Scene.create(maps.map(m => m.data)).then(sceneArray => {
            sceneArray.forEach(async s => {
                let thumb = await s.createThumbnail();
                s.update({ "thumb": thumb.thumb })
            })
        })
    }
}
/* run TheExpanseSOInitializationSetup.setup() in the console of the browser to setup folders */
class TheExpanseSOInitializationSetup {
    static async setup () {
        TheExpanseSOInitializationSetup.displayFolders();
        TheExpanseSOInitializationSetup.setFolderFlags();
        TheExpanseSOInitializationSetup.setSceneNotes();
        TheExpanseSOInitializationSetup.setEmbeddedEntities();
    }

    static async displayFolders() {
        let array = [];
        game.folders.entities.forEach(async f => {
            if (f.data.parent)
                await f.setFlag("the-expanse-salvage-op", "initialization-parent", game.folders.get(f.data.parent).data.name)
        })
        game.folders.entities.forEach(f => {
            array.push(f.data);
        })
        console.log(JSON.stringify(array))
    }

    static async setFolderFlags() {
        console.log(game.scenes.entities)
        for (let scene of game.scenes.entities)
            await scene.update({ "flags.the-expanse-salvage-op": { "initialization-folder": game.folders.get(scene.data.folder).data.name, sort: scene.data.sort } })
        for (let actor of game.actors.entities)
            await actor.update({ "flags.the-expanse-salvage-op": { "initialization-folder": game.folders.get(actor.data.folder).data.name, sort: actor.data.sort } })
        for (let item of game.items.entities)
            await item.update({ "flags.the-expanse-salvage-op": { "initialization-folder": game.folders.get(item.data.folder).data.name, sort: item.data.sort } })
        for (let journal of game.journal.entities)
            await journal.update({ "flags.the-expanse-salvage-op": { "initialization-folder": game.folders.get(journal.data.folder)?.data?.name, sort: journal.data.sort } })
    }

    static async setSceneNotes() {
        for (let scene of game.scenes.entities)
            if (scene.data.journal)
                await scene.setFlag("the-expanse-salvage-op", "scene-notes", game.journal.get(scene.data.journal).data.name)
    }

    static async setEmbeddedEntities() {
        for (let scene of game.scenes.entities) {
            let notes = duplicate(scene.data.notes)
            for (let note of notes) {
                setProperty(note, "flags.the-expanse-salvage-op.initialization-entryname", game.journal.get(note.entryId).data.name)
            }
            await scene.update({ notes: notes })
        }
    }
}