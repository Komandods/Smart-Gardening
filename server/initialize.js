const axios = require("axios");
const { insertSensorData, clearDatabase } = require("./database");
const { AUTH_TOKEN, HA_Adress } = require("./config");
const SENSOR_IDS = [
    "sensor.a4_c1_38_fd_d8_dd_d8dd_humidity,sensor.a4_c1_38_fd_d8_dd_d8dd_temperature",
    "sensor.a4_c1_38_fd_30_6d_306d_humidity,sensor.a4_c1_38_fd_30_6d_306d_temperature" // Weitere Sensor-IDs hier
];


async function fetchData(periodStart, periodEnd, sensorId) {
    const url = `${HA_Adress}/api/history/period/${periodStart}?end_time=${periodEnd}&filter_entity_id=${sensorId}`;
    const headers = {
        Authorization: `Bearer ${AUTH_TOKEN}`,
    };

    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        console.error(`Fehler beim Abrufen der Daten für Sensor ${sensorId}:`, error);
        throw error;
    }
}

async function initializeData() {
    const now = new Date();
    const periodEnd = now.toISOString();
    //const periodStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1h
    //const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // 24 Stunden
    const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 Tage

    try {
        console.log("Datenbank leeren...");
        await clearDatabase();
        console.log("Datenbank erfolgreich geleert.");

        for (const sensorId of SENSOR_IDS) {
            console.log(`Lade Daten für Sensor: ${sensorId}`);
            const data = await fetchData(periodStart, periodEnd, sensorId);
            const formattedData = data.flat().map((entry) => ({
                entity_id: entry.entity_id,
                state: entry.state,
                last_changed: entry.last_changed,
                last_updated: entry.last_updated,
            }));

            console.log(`Speichere Daten für Sensor: ${sensorId}`);
            //console.log(formattedData);
            for (const entry of formattedData) {
                await insertSensorData(entry);
            }
        }

        console.log("Initialisierung abgeschlossen.");
    } catch (error) {
        console.error("Fehler bei der Initialisierung der Daten:", error);
    }
}

function scheduleDataFetch() {
    setInterval(async () => {
        const now = new Date();
        const periodStart = new Date(now.getTime() - 60 * 1000).toISOString(); // 1min
        const periodEnd = now.toISOString();
        //console.log("Sensor Ids on scheduleDataFetch: ", SENSOR_IDS);
        for (const sensorId of SENSOR_IDS) {
            try {
                //console.log(`Lade aktuelle Daten für Sensor: ${sensorId}`);
                const data = await fetchData(periodStart, periodEnd, sensorId);
                const formattedData = data.flat().map((entry) => ({
                    entity_id: entry.entity_id,
                    state: entry.state,
                    last_changed: entry.last_changed,
                    last_updated: entry.last_updated,
                }));

                console.log(`Speichere aktuelle Daten für Sensor: ${sensorId}`);
                for (const entry of formattedData) {
                    await insertSensorData(entry);
                }
            } catch (error) {
                console.error(`Fehler beim Abrufen aktueller Daten für Sensor ${sensorId}:`, error);
            }
        }
    }, 60 * 1000);
}

module.exports = { initializeData, scheduleDataFetch, SENSOR_IDS };
