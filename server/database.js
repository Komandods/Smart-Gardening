const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const DB_FOLDER = path.resolve(__dirname, "./db");

if (!fs.existsSync(DB_FOLDER)) {
    fs.mkdirSync(DB_FOLDER, { recursive: true });
}

function createDbFilename(inputString) {
    const parts = inputString.split('.');
    let mainPart = parts.length > 1 ? parts.slice(1).join('.') : parts[0];
    mainPart = mainPart.replace(/_temperature$/i, '_humidity');
    return `${mainPart}.db`;
}

// SQL-Query
function runQuery(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// SQL-Abfrage
function getQuery(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Datenbank für eine Sensorguppe --> Copilot
function createSensorDatabase(sensorGroup) {
    console.log("Check Sensorgroup createSensorDatabase: ", sensorGroup);
    const dbFileName = `${sensorGroup.split(',')[0].split(".")[1]}.db`;
    console.log("Check dbFilename createSensorDatabase: ", dbFileName);
    const dbPath = path.resolve(DB_FOLDER, dbFileName);
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("Error opening database:", err);
        } else {
            console.log("Connected to the SQLite database.");
        }
    });

    db.serialize(() => {
        // Create table for temperature sensors
        db.run(`CREATE TABLE IF NOT EXISTS temperature (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            value REAL NOT NULL
        )`);

        // Create table for humidity sensors
        db.run(`CREATE TABLE IF NOT EXISTS humidity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            value REAL NOT NULL
        )`);

        // Create linkage table using timestamps with a unique constraint on timestamp
        db.run(`CREATE TABLE IF NOT EXISTS linkage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL UNIQUE,
            FOREIGN KEY (timestamp) REFERENCES temperature(timestamp),
            FOREIGN KEY (timestamp) REFERENCES humidity(timestamp)
        )`);

        console.log("Tables created successfully.");
    });

    db.close((err) => {
        if (err) {
            console.error("Error closing database:", err);
        } else {
            console.log("Database connection closed.");
        }
    });
}
// Dkumentation MySQL website https://www.mysqltutorial.org/mysql-nodejs/querying-data/
async function fetchSensorData() {
    const databases = fs.readdirSync(DB_FOLDER).filter(file => file.endsWith(".db"));
    const result = {};

    for (const dbFile of databases) {
        const dbPath = path.resolve(DB_FOLDER, dbFile);
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

        const temperatureQuery = `
            SELECT
                timestamp,
                value AS temperature_value
            FROM
                temperature
            ORDER BY
                timestamp;
        `;

        const humidityQuery = `
            SELECT
                timestamp,
                value AS humidity_value
            FROM
                humidity
            ORDER BY
                timestamp;
        `;

        const temperatureData = await new Promise((resolve, reject) => {
            db.all(temperatureQuery, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        const humidityData = await new Promise((resolve, reject) => {
            db.all(humidityQuery, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        const calculateAverages = (data, type) => {
            const averages = {};

            data.forEach(row => {
                const date = new Date(row.timestamp);
                const roundedTimestamp = new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate(),
                    date.getHours(),
                    date.getMinutes()
                ).toISOString().slice(0, 16);

                if (!averages[roundedTimestamp]) {
                    averages[roundedTimestamp] = { sum: 0, count: 0 };
                }

                averages[roundedTimestamp].sum += row[`${type}_value`];
                averages[roundedTimestamp].count += 1;
            });

            return Object.entries(averages).map(([timestamp, { sum, count }]) => ({
                timestamp,
                average: sum / count
            }));
        };

        const temperatureAverages = calculateAverages(temperatureData, "temperature");
        const humidityAverages = calculateAverages(humidityData, "humidity");

        const combinedData = {};

        temperatureAverages.forEach(({ timestamp, average }) => {
            if (!combinedData[timestamp]) {
                combinedData[timestamp] = { timestamp, temperature: null, humidity: null };
            }

            combinedData[timestamp].temperature = average;
        });

        humidityAverages.forEach(({ timestamp, average }) => {
            if (!combinedData[timestamp]) {
                combinedData[timestamp] = { timestamp, temperature: null, humidity: null };
            }

            combinedData[timestamp].humidity = average;
        });

        const orderedData = Object.keys(combinedData)
            .sort()
            .map((key, index) => ({
                id: index + 1,
                timestamp: combinedData[key].timestamp.replace('T', ' '),
                temperature: combinedData[key].temperature,
                humidity: combinedData[key].humidity
            }));

        result[dbFile] = orderedData;

        db.close();
    }

    console.log("Datenbank-Ergebnisse:", result);
    return result;
}

// Erstellt und initialisiert Datenbanken für alle Sensoren
function initDatabase() {
    const { SENSOR_IDS } = require("./initialize");
    sensorIds =  SENSOR_IDS;
    //console.log("Sensoren check initDatabase", sensorIds);
    for (const sensorGroup of sensorIds) {
        if (!sensorGroup) continue;
        const dbFileName = `${sensorGroup.split(',')[0].split(".")[1]}.db`;
        //console.log("dbFilename check initDatabase", dbFileName);
        const dbPath = path.resolve(DB_FOLDER, dbFileName);

        if (!fs.existsSync(dbPath)) {
            console.log(`Erstelle Datenbank für Sensorgruppe: ${sensorGroup}`);
            createSensorDatabase(sensorGroup);
        } else {
            console.log(`Datenbank für Sensorgruppe ${sensorGroup} existiert bereits.`);
        }
    }

    console.log("Alle Sensorgruppen-Datenbanken erfolgreich initialisiert.");
}

async function insertSensorData(entry) {
    const extractText = (sensorArray) => {
        return sensorArray
            .filter(entry => entry.trim() !== "") 
            .flatMap(entry => entry.split(",")) 
            .map(sensor => sensor.match(/sensor\.(.+?)_humidity/)) 
            .filter(match => match) 
            .map(match => `${match[1]}_humidity.db`) 
            .join(","); 
    }
    const { entity_id, state, last_changed } = entry;

    const type = entity_id.includes("humidity") ? "humidity" : "temperature";
    const { SENSOR_IDS } = require("./initialize");
    const sensorId = SENSOR_IDS;
    const value = parseFloat(state);
    const timestamp = last_changed;
    const sensorGroup = entity_id; // Beispielhaft, anpassen je nach Struktur
    const dbFileName = createDbFilename(sensorGroup);
    const testtext = extractText(sensorId);
    //console.log("TESTTEXT: ", testtext);
    //const dbFileName = extractText(sensorId);
    //console.log("DBFILENAME insertSensorData: ", dbFileName);
    const dbPath = path.resolve(DB_FOLDER, dbFileName);
    const db = new sqlite3.Database(dbPath);
    //console.log("AAAAAAAAA: ", dbFileName);
    //console.log("BBBBBBBBB: ", sensorGroup);

    try {
        // Tabellentyp
        const tableName = type === "humidity" ? "humidity" : "temperature";

        await runQuery(
            db,
            `INSERT OR IGNORE INTO ${tableName} (timestamp, value) VALUES (?, ?)`,
            [timestamp, value]
        );

        await runQuery(
            db,
            `INSERT OR IGNORE INTO linkage (timestamp) VALUES (?)`,
            [timestamp]
        );
        //console.log(`Daten für Sensor ${sensorId} erfolgreich eingefügt.`);
    } catch (error) {
        //console.error(`Fehler beim Einfügen der Daten für Sensor ${sensorId}:`, error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error("Fehler beim Schließen der Datenbank:", err);
            }
        });
    }
}

// Löscht alle Tabellen in der Datenbank
async function clearDatabase() {
    const dbFiles = fs.readdirSync(DB_FOLDER).filter(file => file.endsWith(".db"));
    for (const file of dbFiles) {
        const dbPath = path.resolve(DB_FOLDER, file);
        const db = new sqlite3.Database(dbPath);

        try {
            const tables = await getQuery(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
            for (const table of tables) {
                await runQuery(db, `DELETE FROM ${table.name};`);
            }
            console.log(`Alle Daten in der Datenbank ${file} wurden gelöscht.`);
        } catch (error) {
            console.error(`Fehler beim Löschen der Daten in der Datenbank ${file}:`, error);
        } finally {
            db.close((err) => {
                if (err) {
                    console.error("Fehler beim Schließen der Datenbank:", err);
                }
            });
        }
    }
}

module.exports = {
    createSensorDatabase,
    initDatabase,
    insertSensorData,
    clearDatabase,
    fetchSensorData
};
