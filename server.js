
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const API_KEY = process.env.API_KEY;

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
      const weather = await axios.get('https://api.openweathermap.org/data/3.0/onecall', {
        params: {
          lat: park.lat,
          lon: park.lon,
          appid: API_KEY,
          units: 'imperial',
          exclude: 'minutely,alerts'
        }
      });

      const hourly = weather.data.hourly;
      const daily = weather.data.daily;

      let totalWeeklyRain = 0;
      let daysSinceRain = 0;
      if (daily) {
        for (let i = 0; i < 7; i++) {
          const day = daily[i];
          totalWeeklyRain += day.rain || 0;
          if ((day.rain || 0) === 0) daysSinceRain++;
          else daysSinceRain = 0;
        }
      }

      let recentRain = 0;
      let lastRainHoursAgo = 'Over 48 hours ago';
      if (hourly && hourly.length > 0) {
        for (let i = 0; i < Math.min(6, hourly.length); i++) {
          recentRain += hourly[i].rain?.['1h'] || 0;
        }

        for (let i = 0; i < hourly.length; i++) {
          if (hourly[i].rain && hourly[i].rain['1h'] > 0) {
            lastRainHoursAgo = i + ' hours ago';
            break;
          }
        }
      }

      const todayHigh = daily?.[0]?.temp?.max || 'Unknown';
      const todayLow = daily?.[0]?.temp?.min || 'Unknown';

      const mudLevel = Math.min(Math.round((totalWeeklyRain / 7) * 10), 10);

      const windSpeed = hourly[0].wind_speed;
      const dustFactor = ((daysSinceRain / 7) * 0.7) + ((windSpeed / 30) * 0.3);
      const dustLevel = Math.min(Math.round(dustFactor * 5), 10);

      conditions[park.name] = {
        totalWeeklyRain: totalWeeklyRain.toFixed(2) + ' in',
        recentRain: recentRain.toFixed(2) + ' in (last 6h)',
        todayHigh: todayHigh + '°F',
        todayLow: todayLow + '°F',
        mudLevel,
        dustLevel,
        lastRainHoursAgo,
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
setInterval(updateConditions, 12 * 60 * 60 * 1000);

app.get('/current-conditions', (req, res) => {
  res.json(conditions);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
