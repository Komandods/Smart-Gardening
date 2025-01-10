//konzept für die notizen (später erweitern) -->mit copilot
import m from "mithril";

const Notizen = {
    notizen: "", // Aktuelle Notiz
    gießplan: [], // Gießplan Daten

    // Initialisierung der Gießplan-Daten
    oninit: () => {
        Notizen.gießplan = generateGießplan(); // Testdaten generieren
    },

    // Ansicht der Notizen-Komponente
    view: () => {
        return m("div.notizen", [
            m("h1", "Notizen"),
            m("textarea", {
                placeholder: "Neue Notiz eingeben...",
                oninput: (e) => (Notizen.notizen = e.target.value),
                value: Notizen.notizen,
            }),
            m(
                "button",
                {
                    onclick: () => saveNotiz(Notizen.notizen),
                },
                "Speichern"
            ),

            m("h2", "Gießplan"),
            renderGießplan(Notizen.gießplan),

            m(
                "button",
                {
                    onclick: () => (Notizen.gießplan = generateGießplan()),
                },
                "Neuen Gießplan generieren"
            ),
        ]);
    },
};

// Funktion: Gießplan generieren
function generateGießplan() {
    const days = [];
    const today = new Date();

    // Letzte 3 Tage und kommende 4 Tage generieren
    for (let i = -3; i <= 4; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        days.push({
            date: date.toISOString().split("T")[0],
            shouldWater: Math.random() > 0.5, // Zufällig ob gegossen werden soll
            completed: false, // Status ob bereits gegossen
        });
    }
    return days;
}

// Funktion: Gießplan anzeigen
function renderGießplan(gießplan) {
    return m("div.calendar-wrapper", 
        gießplan.map((day) =>
            m("div.calendar-day", {
                class: day.date < new Date().toISOString().split("T")[0] ? "past" : "future",
            }, [
                m("span", day.date),
                m("input", {
                    type: "checkbox",
                    checked: day.completed,
                    disabled: !day.shouldWater,
                    onclick: () => (day.completed = !day.completed),
                }),
                m("label", day.shouldWater ? "Gießen" : "Kein Bedarf"),
            ])
        )
    );
}

// Funktion: Notiz speichern
function saveNotiz(notiz) {
    if (!notiz.trim()) {
        alert("Notiz darf nicht leer sein.");
        return;
    }
    // Hier könnte die Notiz über das Backend gespeichert werden
    console.log("Notiz gespeichert:", notiz);
    Notizen.notizen = ""; // Textarea leeren
}

//export default Notizen;
