// apiHandler.js
const axios = require('axios');
const { AUTH_TOKEN, HA_Adress } = require("./config");


const sensorIds = [
    'sensor.a4_c1_38_fd_30_6d_306d_temperature',//Außen
    'sensor.a4_c1_38_fd_30_6d_306d_humidity',//Außen
    'sensor.a4_c1_38_fd_d8_dd_d8dd_temperature',//GH
    'sensor.a4_c1_38_fd_d8_dd_d8dd_humidity'//GH
];
// für jede id wird der state geholt
async function fetchSensorState(sensorId) {
    const sensorUrl = `${HA_Adress}/api/states/${sensorId}`;// url für den state --> siehe Postman beispiel 
    const headers = {
        Authorization: `Bearer ${AUTH_TOKEN}`,
    };

    try {
        const response = await axios.get(sensorUrl, { headers });
        const state = response.data?.state;

        if (state === undefined) {
            throw new Error('State not found in the response.');
        }

        return state;
    } catch (error) {
        console.error(`Error fetching sensor state for ${sensorId}:`, error);
        throw error;
    }
}

async function fetchAllSensorStates(sensorIds) {
    const results = [];

    for (let i = 0; i < sensorIds.length; i++) {
        const sensorId = sensorIds[i];
        try {
            const state = await fetchSensorState(sensorId);
            results.push(`${i + 1}:${state}`);
        } catch (error) {
            console.error(`Failed to fetch state for sensor ${sensorId}:`, error);
            results.push(`${i + 1}:null`);
        }
    }

    return results.join(';');
}

module.exports = { fetchAllSensorStates, sensorIds };
