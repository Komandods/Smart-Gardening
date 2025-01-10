import m from "mithril";
import { notifyAlert } from "./notification";

const Settings = {
    oninit: (vnode) => {
        vnode.state.settings = {
            plants: [], 
            location: "", 
            holdingConditions: "", 
            wateringFrequency: 3, 
        };

        // Daten aus dem Backend laden
        Settings.loadData(vnode); 
    },
    
    loadData: (vnode) => {
        m.request({
            method: "GET",
            url: "http://localhost:3000/api/settings",
        }).then((data) => {
            vnode.state.settings = {
                ...vnode.state.settings,
                ...data,
            };
        }).catch((error) => {
            console.error("Fehler beim Laden der Einstellungen:", error);
            notifyAlert("Fehler beim Laden der Einstellungen.", "error");
        });
    },

    saveSettings: async (vnode) => {
        const payload = {
            plants: vnode.state.settings.plants.map((plant) => ({
                name: plant.name.trim(),
                number: plant.number || 1,
            })),
            location: vnode.state.settings.location.trim(),
            holdingConditions: vnode.state.settings.holdingConditions.trim(),
            wateringFrequency: vnode.state.settings.wateringFrequency,
        };
    
        try {
            await m.request({
                method: "POST",
                url: "http://localhost:3000/api/settings",
                body: payload,
            });
    
            const savedPlants = payload.plants
                .map((p) => `${p.name} (${p.number} Stück)`)
                .join(", ");

            notifyAlert("GESPEICHERT!");
        } catch (error) {
            console.error("Fehler beim Speichern der Einstellungen:", error);
            notifyAlert("Fehler beim Speichern der Einstellungen. Bitte versuchen Sie es erneut.", "error");
        }
    },
    
    view: (vnode) => {
        return m("div", { class: "settings" }, [
            m("h1", "Information"),

            m("h2", "Gießhäufigkeit (pro Woche)"),
            m("div", { class: "watering-frequency" }, [
                m("button", {
                    onclick: () => {
                        if (vnode.state.settings.wateringFrequency > 0) {
                            vnode.state.settings.wateringFrequency -= 1;
                        }
                    },
                }, "-"),
                m("span", vnode.state.settings.wateringFrequency),
                m("button", {
                    onclick: () => {
                        if (vnode.state.settings.wateringFrequency < 7) {
                            vnode.state.settings.wateringFrequency += 1;
                        }
                    },
                }, "+"),
            ]),

            m("h2", "Pflanzen"),
            m("div", vnode.state.settings.plants.map((plant, index) => 
                m("div", { class: "plant-entry" }, [
                    m("input", {
                        type: "text",
                        placeholder: "Pflanzenname",
                        value: plant.name,
                        oninput: (e) => vnode.state.settings.plants[index].name = e.target.value,
                    }),
                    m("input", {
                        type: "number",
                        placeholder: "Anzahl dieser",
                        min: 1,
                        value: plant.number || 1,
                        oninput: (e) => vnode.state.settings.plants[index].number = parseInt(e.target.value, 10),
                    }),
                    m("button", {
                        onclick: () => vnode.state.settings.plants.splice(index, 1),
                    }, "-"),
                ])
            )),
            m("button", {
                onclick: () => vnode.state.settings.plants.push({ name: "", number: 1 }),
            }, "+ Neue Pflanze"),

            m("h2", "Haltungsform"),
            m("p", "Bitte geben Sie an, wie Sie Ihre Pflanze halten."),
            m("input", {
                type: "text",
                placeholder: "z.B. Gewächshaus",
                value: vnode.state.settings.holdingConditions,
                oninput: (e) => vnode.state.settings.holdingConditions = e.target.value,
            }),

            m("h2", "Wettervorhersage"),
            m("label", { for: "location" }, "Standort:"),
            m("input", {
                id: "location",
                type: "text",
                placeholder: "z.B Berlin",
                value: vnode.state.settings.location,
                oninput: (e) => vnode.state.settings.location = e.target.value,
            }),

            // ! Speichern Button in UI woanders 
            m("button", { onclick: () => Settings.saveSettings(vnode) }, "Speichern"),

            // Zurück zum Dashboard -->braucht man nicht unbedingt...
            m("a", { href: "#/dashboard", oncreate: m.route.link }, "Zurück zum Dashboard"),
        ]);
    },
};

export default Settings;
