// Details.js - Detailansicht für Sensor- und Umweltdaten
import m from "mithril";
import Chart from "chart.js/auto";

const Details = {
    data: {}, 
    isLoaded: false, 
    isProcessing: false, 
    selectedView: "Tag", 
    selectedDate: new Date(), 
    displayMode: "charts", 
    chartsRendered: {}, 
    aggregatedData: { daily: {}, weekly: {}, monthly: {} }, 

    initialize: async () => {
        if (Details.isLoaded) return; // damit nicht mehrfach geladen wird
        Details.isProcessing = true;
        try {
            const result = await m.request({
                method: "GET",
                url: "http://localhost:3000/api/data",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            Details.data = result;
            Details.aggregateAllData(); // Daten aggregieren --> dafür copilot verwendet (aggregateAllData())
            Details.isLoaded = true; // Markiere als geladen
        } catch (error) {
            console.error("Fehler beim Laden der Details-Daten:", error);
        } finally {
            Details.isProcessing = false; // Ladezustand deaktivieren
        }
    },

    // GET /api/data
    oninit: () => {
        Details.isProcessing = true;
        m.request({
            method: "GET",
            url: "http://localhost:3000/api/data",
            headers: {
                "Content-Type": "application/json",
            },
        }).then((result) => {
            Details.data = result;
            Details.aggregateAllData();
            Details.isLoaded = true;
            Details.isProcessing = false;
            m.redraw();
        }).catch((error) => {
            console.error("Fehler beim Laden der Details:", error);
            alert("Fehler beim Laden der Daten. Bitte versuchen Sie es später erneut.");
            Details.isProcessing = false;
        });
    },

    changeDate: (direction) => {
        const newDate = new Date(Details.selectedDate);
        newDate.setDate(newDate.getDate() + direction);
        Details.isProcessing = true;
        Details.selectedDate = newDate;

        setTimeout(() => {
            Details.aggregatedData.daily = Details.aggregateData("Tag");
            Details.isProcessing = false;
            m.redraw();
        }, 500);
    },

    formatDate: (dateString) => {
        const date = new Date(dateString);
        return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString().slice(-2)}`;
    },

    formatTime: (dateString) => {
        const date = new Date(dateString);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    },

    formatWeekday: (dateString) => {
        const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
        const date = new Date(dateString);
        return weekdays[date.getDay()];
    },

    // Aggregiere alle Daten vorab --> mit Hilfe von Copilot
    aggregateAllData: () => {
        Details.aggregatedData.daily = Details.aggregateData("Tag");
        Details.aggregatedData.weekly = Details.aggregateData("Woche");
        Details.aggregatedData.monthly = Details.aggregateData("Monat");
    },

    // Funktion zur Aggregation von Daten
    aggregateData: (view) => {
        const data = {};
        const startDate = new Date(view === "Tag" ? Details.selectedDate : new Date());
        if (view === "Woche") startDate.setDate(startDate.getDate() - 7);
        if (view === "Monat") startDate.setDate(startDate.getDate() - 30);

        Object.entries(Details.data).forEach(([dbName, entries]) => {
            const validEntries = entries.filter(entry => entry && entry.timestamp && entry.temperature != null && entry.humidity != null);
            const groupedData = {};

            validEntries.forEach(entry => {
                const date = new Date(entry.timestamp);
                if (date >= startDate) {
                    const key = view === "Tag"
                        ? `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00:00`
                        : `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

                    if (!groupedData[key]) {
                        groupedData[key] = { temperature: 0, humidity: 0, count: 0 };
                    }
                    groupedData[key].temperature += entry.temperature;
                    groupedData[key].humidity += entry.humidity;
                    groupedData[key].count += 1;
                }
            });

            data[dbName] = Object.entries(groupedData).map(([key, values]) => ({
                timestamp: key,
                temperature: values.temperature / values.count,
                humidity: values.humidity / values.count
            }));
        });

        return data;
    },

    renderChart: (dom, data, type, dbName) => {
        if (data.length === 0) return; // Verhindere leere Charts --> funktioniert nicht so gut (vllt CSS)
        const labels = data.map(entry => (type === "Tag" ? Details.formatTime(entry.timestamp) : Details.formatDate(entry.timestamp)));
        const temperatures = data.map(entry => entry.temperature.toFixed(1));
        const humidities = data.map(entry => entry.humidity.toFixed(1));

        if (Details.chartsRendered[dbName]) {
            const chart = Details.chartsRendered[dbName];
            chart.data.labels = labels;
            chart.data.datasets[0].data = temperatures;
            chart.data.datasets[1].data = humidities;
            chart.update();
        } else {
            Details.chartsRendered[dbName] = new Chart(dom, {
                type: "line",
                data: {
                    labels,
                    datasets: [
                        {
                            label: "Temperatur (°C)",
                            data: temperatures,
                            borderColor: "rgba(75,192,192,1)",
                            tension: 0.1,
                        },
                        {
                            label: "Luftfeuchtigkeit (%)",
                            data: humidities,
                            borderColor: "rgba(153,102,255,1)",
                            tension: 0.1,
                        },
                    ],
                },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: `${dbName === "a4_c1_38_fd_30_6d_306d_humidity.db" ? "Außen" : "Gewächshaus"} (${type})`,
                        },
                    },
                },
            });
        }
    },

    view: () => {
        const currentData =
            Details.selectedView === "Tag"
                ? Details.aggregatedData.daily
                : Details.selectedView === "Woche"
                ? Details.aggregatedData.weekly
                : Details.selectedView === "Monat"
                ? Details.aggregatedData.monthly
                : {};

        return m("div", { class: "details" }, [
            m("h2", `Details der letzten Messwerte (${Details.selectedView})`),
            m("div", { class: "menu" }, [
                ["Tag", "Woche", "Monat"].map(view =>
                    m("button", {
                        class: Details.selectedView === view ? "active" : "",
                        onclick: () => {
                            Details.isProcessing = true;
                            setTimeout(() => {
                                Details.selectedView = view;
                                Details.chartsRendered = {}; // Zurücksetzen
                                Details.isProcessing = false;
                                m.redraw();
                            }, 500);
                        }
                    }, view)
                )
            ]),
            Details.selectedView === "Tag" && m("div", { class: "date-navigation" }, [
                m("button", { onclick: () => Details.changeDate(-1) }, "<"),
                m("span", Details.formatDate(Details.selectedDate)),
                m("button", { onclick: () => Details.changeDate(1) }, ">")
            ]),
            m("div", { class: "mode-switch" }, [
                m("button", {
                    class: Details.displayMode === "charts" ? "active" : "",
                    onclick: () => { Details.displayMode = "charts"; m.redraw(); }
                }, "Charts"),
                m("button", {
                    class: Details.displayMode === "tables" ? "active" : "",
                    onclick: () => { Details.displayMode = "tables"; m.redraw(); }
                }, "Tabellen"),
            ]),
            Details.isProcessing
                ? m("p", { class: "loading" }, "Lade Daten...")
                : Object.entries(currentData).map(([dbName, entries]) => {
                      return m("div", { class: "data-section" }, [
                          Details.displayMode === "tables" &&
                          m("table", { class: "data-table" }, [
                              m("thead", [
                                  m("tr", [
                                      m("th", Details.selectedView === "Tag" ? "Zeit" : "Datum"),
                                      Details.selectedView === "Woche" && m("th", "Wochentag"),
                                      m("th", "Temperatur (°C)"),
                                      m("th", "Luftfeuchtigkeit (%)")
                                  ])
                              ]),
                              m("tbody", [
                                  entries.map((entry) => {
                                      return m("tr", [
                                          m("td", Details.selectedView === "Tag" ? Details.formatTime(entry.timestamp) : Details.formatDate(entry.timestamp)),
                                          Details.selectedView === "Woche" && m("td", Details.formatWeekday(entry.timestamp)),
                                          m("td", entry.temperature.toFixed(1)),
                                          m("td", entry.humidity.toFixed(1))
                                      ]);
                                  })
                              ])
                          ]),
                          Details.displayMode === "charts" &&
                          m("canvas", {
                              oncreate: ({ dom }) => Details.renderChart(dom, entries, Details.selectedView, dbName)
                          }),
                      ]);
                  }),
        ]);
    }
};


export const getWeeklyData = () => {
    return Details.aggregatedData.weekly;
};

export default Details;

