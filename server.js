const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const API_KEY = process.env.OPENWEATHER_API_KEY; 
console.log("Loaded API Key: ", API_KEY);

const parks = [
  { name: "Hawk Pride Mountain Offroad Park", lat: 34.6727, lon: -87.8203 },
  { name: "Adventure Offroad Park", lat: 35.0191, lon: -85.7303 },
  { name: "Stony Lonesome OHV Park", lat: 33.9643, lon: -86.9936 },
  { name: "Windrock Offroad Park", lat: 36.0455, lon: -84.4057 },
  { name: "Coalmont OHV Park", lat: 35.2605, lon: -85.7435 },
  { name: "Hot Springs Off-Road Park", lat: 34.5136, lon: -93.0935 },
  { name: "Moab, Utah", lat: 38.5725, lon: -109.5497 },
  { name: "Johnson Valley, California", lat: 34.4033, lon: -116.5925 }
];

let conditions = {};

async function updateConditions() {
  for (const park of parks) {
    try {
      const response = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
        params: {
          lat: park.lat,
          lon: park.lon,
          appid: API_KEY,
          units: 'imperial'
        }
      });

      const forecastList = response.data?.list;
      if (!forecastList || !Array.isArray(forecastList)) {
        throw new Error(`Invalid response from OpenWeather API for ${park.name}`);
      }

      let totalRain = 0;
      let recentRain = 0;
      let lastRainHoursAgo = 'Over 48 hours ago';

      for (let i = 0; i < forecastList.length; i++) {
        const entry = forecastList[i];
        const rain = entry.rain?.['3h'] || 0;
        totalRain += rain;

        if (i < 2) recentRain += rain;

        if (rain > 0 && lastRainHoursAgo === 'Over 48 hours ago') {
          lastRainHoursAgo = `${i * 3} hours from now`;
        }
      }

      const todayTemps = forecastList.slice(0, 8);
      const temps = todayTemps.map(e => e.main.temp);
      const todayHigh = Math.max(...temps).toFixed(1);
      const todayLow = Math.min(...temps).toFixed(1);

      const mudFactor = Math.min(totalRain + (recentRain * 2), 5);
      const dryFactor = 0;
      const trailConditionScore = Math.round(mudFactor - dryFactor + 5);

      const trailConditionText =
        trailConditionScore >= 8 ? "Very Muddy" :
        trailConditionScore >= 6 ? "Muddy" :
        trailConditionScore >= 4 ? "Moderate" :
        trailConditionScore >= 2 ? "Dry" :
        "Very Dusty";

      conditions[park.name] = {
        totalRain: totalRain.toFixed(2) + ' in (5-day)',
        recentRain: recentRain.toFixed(2) + ' in (last ~6h)',
        todayHigh: todayHigh + '°F',
        todayLow: todayLow + '°F',
        lastRainForecast: lastRainHoursAgo,
        trailConditionScore,
        trailConditionText,
        lastUpdated: new Date().toISOString()
      };

    } catch (err) {
      console.error(`Error for ${park.name}:`, err.message);
      conditions[park.name] = {
        status: 'Fallback - using last known data',
        lastUpdated: new Date().toISOString()
      };
    }
  }
}

updateConditions();
setInterval(updateConditions, 5 * 60 * 60 * 1000); // every 5 hours

app.get('/current-conditions', (req, res) => {
  res.json(conditions);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
