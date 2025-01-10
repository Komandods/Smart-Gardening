//für später wenn wir die daten aus der datenbank holen weeklyData ...
const { fetchSensorData } = require("./database");
const transformSensorData = async (fetchSensorData) => {
    try {
        const rawData = await fetchSensorData(); 
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7); 

        const weekdays = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1)
                .toString()
                .padStart(2, "0")}.${date.getFullYear().toString().slice(-2)}`;
        };

        const formatWeekday = (dateString) => {
            const date = new Date(dateString);
            return weekdays[date.getDay()];
        };

        const transformedData = Object.entries(rawData).map(([dbName, entries]) => {
            const validEntries = entries.filter(
                (entry) =>
                    entry &&
                    entry.timestamp &&
                    entry.temperature != null &&
                    entry.humidity != null &&
                    new Date(entry.timestamp) >= startDate
            );

            const groupedData = {};

            validEntries.forEach((entry) => {
                const date = new Date(entry.timestamp);
                const key = `${date.getFullYear()}-${(date.getMonth() + 1)
                    .toString()
                    .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;

                if (!groupedData[key]) {
                    groupedData[key] = { temperature: 0, humidity: 0, count: 0 };
                }

                groupedData[key].temperature += entry.temperature;
                groupedData[key].humidity += entry.humidity;
                groupedData[key].count += 1;
            });

            const rows = Object.entries(groupedData).map(([key, values]) => ({
                datum: formatDate(key),
                wochentag: formatWeekday(key),
                temperatur: (values.temperature / values.count).toFixed(1),
                luftfeuchtigkeit: (values.humidity / values.count).toFixed(1),
            }));

            return {
                dbName,
                rows,
            };
        });

        return transformedData;
    } catch (error) {
        console.error("Fehler bei der Transformation der Sensordaten:", error);
        throw new Error("Sensordaten konnten nicht transformiert werden.");
    }
};

module.exports = {
    transformSensorData,
};
