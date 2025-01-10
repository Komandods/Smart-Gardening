const OpenAI = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const config = require("../config");

// OpenAI-API
const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
});


function getPlantData() {
    try {
      const filePath = path.join(__dirname, '../plant.json');
  
      const rawData = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(rawData);
  
      if (!data.plants || !Array.isArray(data.plants)) {
        throw new Error('Die JSON-Datei enthält kein gültiges "plants"-Array.');
      }
  
      const plantSummary = data.plants.map(plant => `${plant.number} ${plant.name}`).join(', ');
  
      const holdingConditions = data.holdingConditions || 'Keine Angaben zu den Bedingungen';
  
      return { plantSummary, holdingConditions };
    } catch (error) {
      console.error('Fehler beim Verarbeiten der JSON-Datei:', error.message);
      return {
        plantSummary: 'noch keine Pflanzen',
        holdingConditions: 'keine Angabe'
      };
    }
  }
//mit copilot und Fabian G. -->Copilot hat nicht funktioniert aber struktur kommt davon...
async function processWeeklyData(weeklyData) {
    try {
        const { plantSummary, holdingConditions } = getPlantData();
        // Zuordnung von Datenbanken zu Orten
        const dbToLocation = {
            "a4_c1_38_fd_30_6d_306d_humidity.db": "außen",
            "a4_c1_38_fd_d8_dd_d8dd_humidity.db": "gh",
        };

        // Daten formatieren und Orte zuweisen
        const formattedData = Object.entries(weeklyData)
            .map(([dbName, entries]) => {
                const location = dbToLocation[dbName] || "unbekannt";
                const formattedEntries = entries.map(
                    (entry) =>
                        `Datum: ${entry.timestamp}, Temperatur: ${entry.temperature.toFixed(
                            1
                        )}°C, Luftfeuchtigkeit: ${entry.humidity.toFixed(1)}%`
                );
                return `Sensor (${location}): ${dbName}\n${formattedEntries.join("\n")}`;
            })
            .join("\n\n");

        const prompt = `
Die folgenden Sensordaten repräsentieren eine Woche. Analysiere die Daten und liefere eine strukturierte JSON-Antwort mit folgenden Inhalten:
- Durchschnittstemperatur und -luftfeuchtigkeit für 'außen' und 'gh'.
- Bemerkenswerte Trends (1-2 Sätze, die alle Daten berücksichtigen).
- Empfehlungen zur Verbesserung der Bedingungen, oder 'keine', falls keine Maßnahmen notwendig sind.
- Eine Bewertung, wie es der Pflanze geht (Skala von 1-5).

Datenbanken zu Orten:
${JSON.stringify(dbToLocation)}

Daten:
${formattedData}
`;

        console.log("Sende folgende Anfrage an OpenAI:\n", prompt);

        // JSON-Schema definieren
        const SummarySchema = z.object({
            average_temperature_außen: z.number(),
            average_humidity_außen: z.number(),
            average_temperature_gh: z.number(),
            average_humidity_gh: z.number(),
            trends: z.string(),
            evaluation: z.number(),
            recommendations: z.string(),
        });

        // Anfrage an die API senden
        const response = await openai.beta.chat.completions.parse({
            model: "gpt-4o-2024-08-06",
            messages: [
                { role: "system", content: `Du bist ein hilfreicher Assistent für die Analyse von Sensordaten für folgende Pflanzen: ${plantSummary}. Die Pflanze/n befinden sich in folgender Einrichtung: ${holdingConditions}. Die antwort in die gegebene Struktur ausgeben.` },
                { role: "user", content: prompt },
            ],
            response_format: zodResponseFormat(SummarySchema, "sensor_analysis"),
        });

        const structuredResponse = response.choices[0].message.parsed;
        console.log("Strukturierte Antwort von OpenAI:\n", JSON.stringify(structuredResponse, null, 2));

        // JSON-Antwort formatieren
        const jsonResponse = {
            average_temperature_außen: structuredResponse.average_temperature_außen,
            average_humidity_außen: structuredResponse.average_humidity_außen,
            average_temperature_gh: structuredResponse.average_temperature_gh,
            average_humidity_gh: structuredResponse.average_humidity_gh,
            trends: structuredResponse.trends,
            evaluation: structuredResponse.evaluation,
            recommendations: structuredResponse.recommendations,
        };

        console.log("Strukturierte JSON-Antwort von OpenAI:\n", JSON.stringify(jsonResponse, null, 2));

        return jsonResponse;
    } catch (error) {
        console.error("Fehler bei der Verarbeitung der Wochendaten mit OpenAI:", error);
        throw new Error("Fehler bei der Verarbeitung der Wochendaten mit OpenAI.");
    }
}





async function handleOpenaiRequest(req, res) {
    try {
        const weeklyData = req.body.weeklyData;

        if (!weeklyData || Object.keys(weeklyData).length === 0) {
            console.error("Keine Wochendaten erhalten.");
            return res.status(400).json({ error: "Keine Wochendaten erhalten." });
        }

        console.log("Wochendaten erhalten:\n", JSON.stringify(weeklyData, null, 2));

        // an OpenAI
        const aiResponse = await processWeeklyData(weeklyData);

        res.status(200).json({ aiResponse });
    } catch (error) {
        console.error("Fehler bei der Verarbeitung der Anfrage:", error);
        res.status(500).json({ error: "Interner Serverfehler. Bitte später erneut versuchen." });
    }
}

module.exports = {
    handleOpenaiRequest,
    processWeeklyData,
};
