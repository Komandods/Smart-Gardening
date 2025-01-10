// erstes mithril Demo --> mit copilot
import m from "mithril";
import Chart from "chart.js/auto";

// Tabelle für Daten
const wochendaten = {
    tage: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
    gewaechshausTemp: [20, 22, 21, 23, 22, 24, 23],
    aussenTemp: [15, 16, 14, 15, 16, 17, -6],
    luftfeuchtigkeit: [70, 68, 72, 71, 69, 73, 74],
    solarLeistung: [3, 8, 12, 5, 9, 44, 7]
};

// kw in sonneneinstrahlung anzeigen
function interpretSonneneinstrahlung(kw) {
    if (kw <= 4) return `schwach (${kw} kW)`;
    if (kw <= 8) return `mäßig (${kw} kW)`;
    if (kw <= 10) return `gut (${kw} kW)`;
    if (kw <= 12) return `sehr gut (${kw} kW)`;
    return `extrem (${kw} kW)`;
}

// Wochenübersicht
const Wochenuebersicht = {
    view: () =>
        m("div.section", [
            m("h2", "Wochenübersicht der Daten"),
            m("table", [
                m("tr", [
                    m("th", "Tag"),
                    m("th", "Gewächshaus Temp (°C)"),
                    m("th", "Außentemperatur (°C)"),
                    m("th", "Luftfeuchtigkeit (%)"),
                    m("th", "Sonneneinstrahlung")
                ]),
                ...wochendaten.tage.map((tag, i) =>
                    m("tr", [
                        m("td", tag),
                        m("td", wochendaten.gewaechshausTemp[i]),
                        m("td", wochendaten.aussenTemp[i]),
                        m("td", wochendaten.luftfeuchtigkeit[i]),
                        m("td", interpretSonneneinstrahlung(wochendaten.solarLeistung[i])) // Solarleistung als Stufe
                    ])
                )
            ])
        ])
};

// Chat GPT API in dem Baustein, evtl. in einer anderen Datei(openai.js wie bei Tutory)
const Empfehlungen = {
    oninit: (vnode) => {
        vnode.state.empfehlungen = "Empfehlungen werden geladen...";
        setTimeout(() => {
            vnode.state.empfehlungen = `
                - Die Temperatur im Gewächshaus ist stabil.
                - Luftfeuchtigkeit schwankt, überprüfen Sie die Belüftung.
                - Die Sonneneinstrahlung ist an den meisten Tagen ausreichend für das Pflanzenwachstum.
            `;
            m.redraw();
        }, 1500);
    },
    view: (vnode) =>
        m("div.section", [
            m("h2", "KI-Empfehlungen"),
            m("p", vnode.state.empfehlungen)
        ])
};

let chartInstance;
//diagram(erstmal mit einer fremden bib, mb später ander?)
const DiagrammKomponente = {
    oncreate: (vnode) => {
        console.log("DiagrammKomponente erstellt");

        const ctx = vnode.dom.querySelector("canvas").getContext("2d");

        if (!ctx) {
            console.error("Graph konnte nicht abgerufen werden.");
            return;
        }

        //diagram einmal erstellen und speichern... später dynamisch(kann sich nach input anpassen...)
        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: wochendaten.tage,
                datasets: [
                    {
                        label: "Gewächshaus Temperatur (°C)",
                        data: wochendaten.gewaechshausTemp,
                        borderColor: "#00796b",
                        backgroundColor: "rgba(0, 150, 136, 0.2)",
                        tension: 0.4
                    },
                    {
                        label: "Außentemperatur (°C)",
                        data: wochendaten.aussenTemp,
                        borderColor: "#ffb74d",
                        backgroundColor: "rgba(255, 183, 77, 0.2)",
                        tension: 0.4
                    },
                    {
                        label: "Luftfeuchtigkeit (%)",
                        data: wochendaten.luftfeuchtigkeit,
                        borderColor: "#8e24aa",
                        backgroundColor: "rgba(142, 36, 170, 0.2)",
                        tension: 0.4
                    },
                    {
                        label: "Sonneneinstrahlung (kW)",
                        data: wochendaten.solarLeistung,
                        borderColor: "#0288d1",
                        backgroundColor: "rgba(2, 136, 209, 0.2)",
                        tension: 0.4,
                        yAxisID: "y-sunlight"  
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Temperatur / Luftfeuchtigkeit"
                        }
                    },
                    "y-sunlight": { 
                        beginAtZero: true,
                        max: Math.max(...wochendaten.solarLeistung) + 2,  // Dynamisch maximaler Wert
                        position: "right",
                        title: {
                            display: true,
                            text: "Sonneneinstrahlung (kW)"
                        },
                        grid: {
                            drawOnChartArea: false 
                        }
                    }
                }
            }
        });
        console.log("Diagramm erfolgreich erstellt.");
    },
    onbeforeupdate: () => {
        return false;
    },
    onremove: () => {
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
    },
    view: () => 
        m("div.chart-container", [
            m("canvas"),
            m("div.placeholder", "")
        ])
};

// Haupt Dashboard mit den modulen
const Dashboard = {
    view: () =>
        m("div.container", [
            m("div.header", [
                m("h1", "Smart Gardening Dashboard"),
                m("p", "Eine wöchentliche Übersicht über Ihr Gewächshaus-Umfeld")
            ]),
            m(Wochenuebersicht),
            m(Empfehlungen),
            m("div.section", [
                m("h2", "Wöchentliche Daten-Trends"),
                m(DiagrammKomponente)
            ])
        ])
};

m.mount(document.getElementById("app"), Dashboard);
