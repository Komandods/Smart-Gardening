const fs = require("fs").promises; 
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const { initDatabase, insertMeasurement, getMeasurements, getSummaries, fetchSensorData } = require("./database");
const { handleOpenaiRequest, processWeeklyData } = require("./handlers/openaiHandler");
const { initializeData, scheduleDataFetch } = require("./initialize");
const { fetchAllSensorStates, sensorIds } = require("./apiHandler");
const SETTINGS_FILE = "./plant.json"; 

const app = express();
const PORT = 3000;

async function getGID(location) {
    try {
        const fetch = (await import('node-fetch')).default;
        const url = `https://www.wetteronline.de/wetter/${location}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${url} - ${response.statusText}`);
        }

        const html = await response.text();
        const gidMatch = html.match(/gid\s*:\s*"([\w\d]+)"/);
        
        if (gidMatch && gidMatch[1]) {
            return gidMatch[1]; // gid ausgeben
        } else {
            throw new Error(`GID not found for location: ${location}`);
        }
    } catch (error) {
        console.error(`Error fetching or parsing data for ${location}:`, error.message);
        return null;
    }
}


const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const clients = [];
wss.on("connection", (ws) => {
    console.log("WebSocket-Client verbunden");
    clients.push(ws);
    ws.on("close", () => {
        const index = clients.indexOf(ws);
        if (index !== -1) clients.splice(index, 1);
        console.log("WebSocket-Client getrennt");
    });
});

function sendeLiveDaten(daten) {
    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(daten));
        }
    });
    console.log("Live-Daten an WebSocket-Clients gesendet:", daten);
}

// Standard-Route
app.get("/", (req, res) => {
    res.send("Willkommen beim Pflanzenüberwachungssystem! Bitte verwenden Sie die API-Endpunkte unter /api/.");
});

// Route: für Statistiken
app.get("/api/data", async (req, res) => {
    try {
        console.log("Abrufen aller Sensordaten");
        const daten = await fetchSensorData(); 
        //console.log("Sensordaten erfolgreich abgerufen:", daten);
        res.json(daten);
    } catch (error) {
        console.error("Fehler beim Abrufen der Sensordaten:", error);
        res.status(500).json({ fehler: "Sensordaten konnten nicht geladen werden." });
    }
});

/*
// Route: Abrufen von Zusammenfassungen
app.get("/api/summaries", async (req, res) => {
    try {
        console.log("Abrufen der Zusammenfassungen");
        const summaries = await getSummaries();
        console.log("Zusammenfassungen abgerufen:", summaries);
        res.json(summaries);
    } catch (error) {
        console.error("Fehler beim Abrufen der Zusammenfassungen:", error);
        res.status(500).json({ fehler: "Zusammenfassungen konnten nicht geladen werden." });
    }
});
*/

// Route: live daten
app.get("/api/dashboard", async (req, res) => {
    try {
        const formattedStates = await fetchAllSensorStates(sensorIds);
        res.json({ states: formattedStates });
    } catch (error) {
        console.error("Fehler beim Abrufen der Sensorzustände:", error);
        res.status(500).json({ fehler: "Sensorzustände konnten nicht abgerufen werden." });
    }
});
// Route: Hinzufügen von Messdaten
app.post("/api/data", async (req, res) => {
    const daten = req.body;
    try {
        console.log("Hinzufügen von Messdaten:", daten);
        await insertMeasurement(daten);
        sendeLiveDaten(daten); // Live-Update senden
        res.status(201).json({ nachricht: "Daten erfolgreich hinzugefügt." });
    } catch (error) {
        console.error("Fehler beim Hinzufügen der Daten:", error);
        res.status(500).json({ fehler: "Daten konnten nicht hinzugefügt werden." });
    }
});

// Route: OpenAI-Analyse
app.post("/api/openai", async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).send({ fehler: "Methode nicht erlaubt" });
    }

    const { daten, openaiPreviousResponse, userResponse } = req.body;
    try {
        console.log("OpenAI-Anfrage gesendet:", daten);
        const antwort = await handleOpenaiRequest(daten, openaiPreviousResponse, userResponse);
        console.log("OpenAI-Antwort erhalten:", antwort);
        res.json(antwort);
    } catch (error) {
        console.error("Fehler bei der OpenAI-Anfrage:", error);
        res.status(500).json({ fehler: "OpenAI-Anfrage fehlgeschlagen." });
    }
});

// Favicon-Route, um Fehler zu vermeiden --> Copilot empfiehlt
app.get("/favicon.ico", (req, res) => res.status(204));

// Initialisierung der Datenbank und speichern durch API
(async function initialisiereServer() {
    try {
        console.log("Initialisiere Datenbank...");
        await initDatabase();
        console.log("Datenbank erfolgreich initialisiert.");

        console.log("Initialisiere Daten...");
        await initializeData();

        console.log("Plane periodische Datenaktualisierungen...");
        scheduleDataFetch(); // führr jede minute aus

        server.listen(PORT, () => {
            console.log(`Server läuft auf http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Fehler bei der Serverinitialisierung:", error);
    }
})();
// Route: Einstellungen abrufen
app.get("/api/settings", async (req, res) => {
    try {
        const data = await fs.readFile(SETTINGS_FILE, "utf-8");
        res.json(JSON.parse(data));
    } catch (error) {
        if (error.code === "ENOENT") {
            // wenn nicht da... es gibt noch ensureSettingsFile()
            const defaultSettings = {
                plants: [],
                location: "",
                holdingConditions: "",
                wateringFrequency: 3,
            };
            res.json(defaultSettings);
        } else {
            console.error("Fehler beim Lesen der Einstellungen:", error);
            res.status(500).json({ fehler: "Einstellungen konnten nicht geladen werden." });
        }
    }
});

// Route: Einstellungen speichern
app.post("/api/settings", async (req, res) => {
    const settings = req.body;
    settings.gid = await getGID(settings.location);

    try {
        const existingSettings = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf-8"));

        settings.alreadyWatered = settings.alreadyWatered ?? existingSettings.alreadyWatered;

        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
        res.status(200).json({ nachricht: "Einstellungen erfolgreich gespeichert." });
    } catch (error) {
        console.error("Fehler beim Speichern der Einstellungen:", error);
        res.status(500).json({ fehler: "Einstellungen konnten nicht gespeichert werden." });
    }
});


//sicher dass plant.json existiert
(async function ensureSettingsFile() {
    try {
        await fs.access(SETTINGS_FILE);
        console.log("Einstellungsdatei vorhanden.");
    } catch (error) {
        if (error.code === "ENOENT") {
            console.log("Einstellungsdatei fehlt. Erstelle Standarddatei...");
            const defaultSettings = {
                plants: [],
                location: "",
                gid: "",
                holdingConditions: "",
                wateringFrequency: 3,
                alreadyWatered: 0,
            };
            await fs.writeFile(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), "utf-8");
            console.log("Standarddatei erstellt.");
        } else {
            console.error("Fehler bei der Überprüfung der Einstellungsdatei:", error);
        }
    }
})();


// Verarbeiten von WeeklyData mit Fabian G.
app.post("/api/chatgptDashboard", async (req, res) => {
    try {
        const weeklyData = req.body.weeklyData;

        // schauen ob daten da sind
        if (!weeklyData || Object.keys(weeklyData).length === 0) {
            console.warn("Keine Wochendaten erhalten.");
            return res.status(400).json({ error: "Keine Wochendaten erhalten." });
        }

        console.log("WeeklyData erhalten:");
        Object.entries(weeklyData).forEach(([dbName, entries]) => {
            console.log(`Datenbank: ${dbName}`);
            entries.forEach((entry, index) => {
                console.log(
                    `  Eintrag ${index + 1}: Timestamp: ${entry.timestamp}, Temperatur: ${entry.temperature}, Luftfeuchtigkeit: ${entry.humidity}`
                );
            });
        });

        // zu openaiHandler.js
        const aiResponse = await processWeeklyData(weeklyData);

        console.log("OpenAI-Antwort server:", aiResponse);

        
        if (typeof aiResponse === "string") {
            return res.status(200).json({ parsedResponse: aiResponse });
        }

        const responsePayload = {
            average_temperature_außen: aiResponse.average_temperature_außen,
            average_humidity_außen: aiResponse.average_humidity_außen,
            average_temperature_gh: aiResponse.average_temperature_gh,
            average_humidity_gh: aiResponse.average_humidity_gh,
            trends: aiResponse.trends, 
            evaluation: aiResponse.evaluation,
            recommendations: aiResponse.recommendations,
        };

        res.status(200).json(responsePayload);
    } catch (error) {
        console.error("Fehler bei der Verarbeitung der Wochendaten:", error);
        res.status(500).json({ error: "Interner Serverfehler. Bitte später erneut versuchen." });
    }
});


