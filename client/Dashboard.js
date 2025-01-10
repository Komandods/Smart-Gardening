import m from "mithril";
import { getWeeklyData } from "./Details.js";


const Dashboard = {
    data: {},
    settings: {}, 
    location: "", 
    remainingWatering: 3, 
    canReload: true, 
    aiResponse: "",

    // auf eine kommastelle
    roundValue: (value, decimals = 1) => {
        if (!value || isNaN(value)) return "lädt...";
        return parseFloat(value).toFixed(decimals);
    },

    loadData: async () => {
        try {
            const result = await m.request({
                method: "GET",
                url: "http://localhost:3000/api/dashboard",
            });
            Dashboard.data = result.states.split(";").reduce((acc, entry) => {
                const [key, value] = entry.split(":");
                acc[key] = value;
                return acc;
            }, {});
        } catch (err) {
            console.error("Fehler beim Laden der Dashboard-Daten:", err);
        }
    },


    
    // plant.json laden und nach 'location' suchen
    loadSettings: async () => {
        try {
            const data = await m.request({
                method: "GET",
                url: "http://localhost:3000/api/settings",
            });
            Dashboard.settings = data;
            Dashboard.location = data.location;
            Dashboard.remainingWatering = data.wateringFrequency || 3;
            Dashboard.alreadyWatered = data.alreadyWatered || 0;
        } catch (err) {
            console.error("Fehler beim Laden der Einstellungen:", err);
        }
    },

    saveSettings: async () => {
        const payload = {
            ...Dashboard.settings,
            alreadyWatered: Dashboard.alreadyWatered, // neuer Wert
        };
    
        try {
            await m.request({
                method: "POST",
                url: "http://localhost:3000/api/settings",
                body: payload,
            });
            console.log("Einstellungen erfolgreich gespeichert:", payload);
        } catch (error) {
            console.error("Fehler beim Speichern der Einstellungen:", error);
        }
    },
    

// POST chatgptDashboard
sendWeeklyDataToServer: async () => {
    const weeklyData = getWeeklyData();

    if (!weeklyData || Object.keys(weeklyData).length === 0) {
        console.error("Keine Wochendaten verfügbar.");
        Dashboard.error = "Wochendaten nicht verfügbar.";
        return;
    }

    try {
        const response = await m.request({
            method: "POST",
            url: "http://localhost:3000/api/chatgptDashboard", 
            body: { weeklyData },
            headers: {
                "Content-Type": "application/json",
            },
        });

        console.log("Serverantwort erhalten:", response);

        // speichern
        Dashboard.averageTemperatureAußen = response.average_temperature_außen;
        Dashboard.averageHumidityAußen = response.average_humidity_außen;
        Dashboard.averageTemperatureGH = response.average_temperature_gh;
        Dashboard.averageHumidityGH = response.average_humidity_gh;
        Dashboard.trends = response.trends;
        Dashboard.evaluation = response.evaluation;
        Dashboard.recommendations = response.recommendations;

        Dashboard.error = null; 
        m.redraw();
    } catch (error) {
        console.error("Fehler beim Senden der Wochendaten:", error);
        Dashboard.error = "Fehler beim Abrufen der AI-Antwort.";
    }
},


    oninit: async () => {
        await Dashboard.loadData(); 
        await Dashboard.loadSettings(); 
        await Dashboard.sendWeeklyDataToServer();
    },

    reloadWithTimer: async () => {
        if (!Dashboard.canReload) return;

        await Dashboard.loadData(); 
        await Dashboard.sendWeeklyDataToServer(); 
        Dashboard.canReload = false;

        //für den button
        setTimeout(() => {
            Dashboard.canReload = true;
            m.redraw(); 
        }, 60000); 
    },

    view: () => {
        return m("div.dashboard-container", [
            m("div.dashboard-grid", [
                m("div.dashboard-card", [
                    m("h2", "Luftfeuchtigkeit"),
                    m(
                        "p",
                        `GH: ${Dashboard.roundValue(Dashboard.data["4"])}% | Außen: ${Dashboard.roundValue(Dashboard.data["2"])}%`
                    ),
                ]),
                m("div.dashboard-card", [
                    m("h2", "Temperatur"),
                    m(
                        "p",
                        `GH: ${Dashboard.roundValue(Dashboard.data["3"])}°C | Außen: ${Dashboard.roundValue(Dashboard.data["1"])}°C`
                    ),
                ]),
                m("div.dashboard-card watering-card", [
                    m("h2", "Gießen"),
                    m("h5", "Die Woche..."),
                    m("div", { class: "watering-status" }, [
                        m("span", { class: "watering-count" }, `${Dashboard.alreadyWatered}`),
                        m("span", { class: "watering-total" }, `/ ${Dashboard.settings.wateringFrequency}`),
                        m("span", " "),
                        m("span", { class: "watering-label" }, "Gegossen"),
                    ]),
                    m("div.button-group", { class: "watering-buttons" }, [
                        m("button", {
                            class: "small-button add-button",
                            onclick: async () => {
                                if (Dashboard.alreadyWatered < Dashboard.settings.wateringFrequency) {
                                    Dashboard.alreadyWatered += 1;
                                    await Dashboard.saveSettings(); 
                                    m.redraw(); 
                                }
                            },
                        }, "+1"),
                        m("button", {
                            class: "small-button undo-button",
                            onclick: async () => {
                                if (Dashboard.alreadyWatered > 0) {
                                    Dashboard.alreadyWatered -= 1;
                                    await Dashboard.saveSettings(); 
                                    m.redraw(); //muss gemacht werden
                                }
                            },
                        }, "↺"), // https://www.compart.com/de/unicode/U+21BA
                    ]),
                ]),
                
                m("div.dashboard-card.weather-card", [
                    m("h2", "Wettervorhersage"),
                    Dashboard.settings.gid
                        ? m("iframe", {
                            src: `https://api.wetteronline.de/wetterwidget?gid=${Dashboard.settings.gid}&modeid=FC2&seourl=${Dashboard.location.toLowerCase()}&locationname=${Dashboard.location}&lang=de`,
                        })
                        : m("p", "Keine Wetterdaten verfügbar. Bitte überprüfen Sie den Standort."),
                ]),
                
                m("div.dashboard-card.chatgpt-card", {
                    class: Dashboard.hover === "chatgpt" ? "expanded" : "",
                    onmouseover: () => { Dashboard.hover = "chatgpt"; m.redraw(); },
                    onmouseout: () => { Dashboard.hover = null; m.redraw(); },
                }, [
                    m("h2", "Diese Woche"),
                    m("h5", "Gewächshaus"),
                    Dashboard.error
                        ? m("p", { class: "error-message" }, Dashboard.error)
                        : Dashboard.hover === "chatgpt"
                            ? [
                                m("p", `Temp.: ~${(Dashboard.averageTemperatureGH || 0).toFixed(1)}°C`),
                                m("p", `Luftfeuchtigkeit: ~${(Dashboard.averageHumidityGH || 0).toFixed(1)}%`),
                                m("h5", "Außen"),
                                m("p", `Temp.: ~${(Dashboard.averageTemperatureAußen || 0).toFixed(1)}°C`),
                                m("p", `Luftfeuchtigkeit: ~${(Dashboard.averageHumidityAußen || 0).toFixed(1)}%`),
                                m("h3", "Trends"),
                                m("p", Dashboard.trends || "Keine Trends verfügbar"),
                                m("h3", "Bewertung"),
                                m("p", [
                                    `Gesamtbewertung: ${Dashboard.evaluation}/5 `,
                                    m("span.stars", Array.from({ length: 5 }, (_, i) =>
                                        i < Dashboard.evaluation ? "★" : "☆" // https://www.compart.com/de/unicode/U+2605 und https://www.compart.com/de/unicode/U+2606
                                    ).join("")),
                                ]),
                                m("h3", "Empfehlung"),
                                m("p", Dashboard.recommendations || "Keine Empfehlungen"),
                            ]
                            : [
                                m("p", `Temp.: ~${(Dashboard.averageTemperatureGH || 0).toFixed(1)}°C`),
                                m("p", `Luftfeuchtigkeit: ~${(Dashboard.averageHumidityGH || 0).toFixed(1)}%`),
                                m("span.stars", Array.from({ length: 5 }, (_, i) =>
                                    i < Dashboard.evaluation ? "★" : "☆"
                                ).join("")),
                            ],
                ]),
                
                             
                
                
            ]),

            // neuladen Button --> CSS muss hier sein, sodnst funktioniert es nicht 
            m(
                "button.reload-button",
                {
                    onclick: Dashboard.reloadWithTimer,
                    disabled: !Dashboard.canReload,
                    style: {
                        borderRadius: "50%",
                        width: "50px",
                        height: "50px",
                        backgroundColor: Dashboard.canReload ? "#4CAF50" : "#ccc",
                        color: "white",
                        fontSize: "16px",
                        border: "none",
                        cursor: Dashboard.canReload ? "pointer" : "not-allowed",
                        position: "fixed",
                        bottom: "20px",
                        right: "20px",
                        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                    },
                },
                "⟳"
            ),
        ]);
    },
};

export default Dashboard;
