function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// IndexedDB helper functions
const DB_NAME = 'WeatherToolDB';
const STORE_NAME = 'preferences';
const DB_VERSION = 1;

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveCity(cityData) {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const request = store.put(cityData, 'lastCity');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to save city to IndexedDB:', error);
  }
}

async function getLastCity() {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.get('lastCity');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error('Failed to get city from IndexedDB:', error);
    return null;
  }
}

function getWeatherIcon(weatherCode, isDay = true) {
  // WMO Weather interpretation codes
  const weatherMap = {
    0: { icon: '☀️', label: 'Clear' },
    1: { icon: '🌤️', label: 'Mostly Clear' },
    2: { icon: '⛅', label: 'Partly Cloudy' },
    3: { icon: '☁️', label: 'Overcast' },
    45: { icon: '🌫️', label: 'Foggy' },
    48: { icon: '🌫️', label: 'Foggy' },
    51: { icon: '🌧️', label: 'Light Drizzle' },
    53: { icon: '🌧️', label: 'Moderate Drizzle' },
    55: { icon: '🌧️', label: 'Heavy Drizzle' },
    61: { icon: '🌧️', label: 'Slight Rain' },
    63: { icon: '🌧️', label: 'Moderate Rain' },
    65: { icon: '⛈️', label: 'Heavy Rain' },
    71: { icon: '❄️', label: 'Slight Snow' },
    73: { icon: '❄️', label: 'Moderate Snow' },
    75: { icon: '❄️', label: 'Heavy Snow' },
    77: { icon: '❄️', label: 'Snow Grains' },
    80: { icon: '🌧️', label: 'Slight Rain Showers' },
    81: { icon: '🌧️', label: 'Moderate Rain Showers' },
    82: { icon: '⛈️', label: 'Violent Rain Showers' },
    85: { icon: '❄️', label: 'Slight Snow Showers' },
    86: { icon: '❄️', label: 'Heavy Snow Showers' },
    95: { icon: '⛈️', label: 'Thunderstorm' },
    96: { icon: '⛈️', label: 'Thunderstorm with Hail' },
    99: { icon: '⛈️', label: 'Thunderstorm with Hail' },
  };

  return weatherMap[weatherCode] || { icon: '🌡️', label: 'Unknown' };
}

function formatTemp(temp) {
  return Math.round(temp) + '°C';
}

function formatWindSpeed(speed) {
  return Math.round(speed) + ' km/h';
}

function formatHumidity(humidity) {
  return humidity + '%';
}

function getWindDirection(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

export function createWeatherToolModal() {
  let weatherState = {
    latitude: null,
    longitude: null,
    cityName: null,
    currentWeather: null,
    hourlyWeather: null,
    dailyWeather: null,
    airQuality: null,
    timezone: null,
    loading: false,
    error: null,
    searchQuery: '',
    searchResults: [],
    showSearchResults: false,
  };

  async function fetchWeather(lat, lon, cityName = null) {
    weatherState.loading = true;
    weatherState.error = null;

    try {
      const response = await fetch(`/api/tools/weather?latitude=${lat}&longitude=${lon}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch weather');
      }

      weatherState.latitude = lat;
      weatherState.longitude = lon;
      weatherState.cityName = cityName || 'Unknown Location';
      weatherState.currentWeather = result.data.current;
      weatherState.hourlyWeather = result.data.hourly;
      weatherState.dailyWeather = result.data.daily;
      weatherState.timezone = result.data.timezone;
      weatherState.airQuality = result.data.air_quality;

      // Debug: Log the air quality data structure
      console.log('Air Quality Data:', weatherState.airQuality);

      // Save to IndexedDB
      await saveCity({
        latitude: lat,
        longitude: lon,
        name: cityName || 'Unknown Location',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      weatherState.error = error.message;
      console.error('Weather fetch error:', error);
    } finally {
      weatherState.loading = false;
    }
  }

  async function searchLocation(query) {
    if (!query || query.trim().length === 0) {
      weatherState.searchResults = [];
      return;
    }

    try {
      const response = await fetch(`/api/tools/weather/geocode?query=${encodeURIComponent(query)}`);
      const result = await response.json();

      if (result.success && result.data.results) {
        weatherState.searchResults = result.data.results.slice(0, 8);
      } else {
        weatherState.searchResults = [];
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      weatherState.searchResults = [];
    }
  }

  function renderCurrentWeather() {
    if (!weatherState.currentWeather) return '';

    const current = weatherState.currentWeather;
    const weather = getWeatherIcon(current.weather_code, current.is_day);
    
    // Access AQI data - Open-Meteo returns it in current object
    const aqiCurrent = weatherState.airQuality?.current;
    const aqi = aqiCurrent?.us_aqi;

    // Get AQI color and label
    const getAQIInfo = (aqiValue) => {
      if (!aqiValue) return null;
      if (aqiValue <= 50) return { label: 'Good', color: 'bg-green-500', textColor: 'text-green-700' };
      if (aqiValue <= 100) return { label: 'Fair', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
      if (aqiValue <= 150) return { label: 'Moderate', color: 'bg-orange-500', textColor: 'text-orange-700' };
      if (aqiValue <= 200) return { label: 'Poor', color: 'bg-red-500', textColor: 'text-red-700' };
      return { label: 'Very Poor', color: 'bg-purple-600', textColor: 'text-purple-700' };
    };

    const aqiInfo = aqi ? getAQIInfo(aqi) : null;

    return `
      <div class="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-lg">
        <div class="flex items-start justify-between mb-6">
          <div>
            <p class="text-sm font-bold opacity-90 uppercase tracking-widest">Current Weather</p>
            <h3 class="text-4xl font-black mt-2">${formatTemp(current.temperature_2m)}</h3>
            <p class="text-lg font-bold opacity-90 mt-1">${weather.label}</p>
          </div>
          <div class="text-6xl">${weather.icon}</div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-blue-500/30">
          <div>
            <p class="text-xs font-bold opacity-75 uppercase tracking-widest">Feels Like</p>
            <p class="text-2xl font-black mt-1">${formatTemp(current.apparent_temperature)}</p>
          </div>
          <div>
            <p class="text-xs font-bold opacity-75 uppercase tracking-widest">Humidity</p>
            <p class="text-2xl font-black mt-1">${formatHumidity(current.relative_humidity_2m)}</p>
          </div>
          <div>
            <p class="text-xs font-bold opacity-75 uppercase tracking-widest">Wind Speed</p>
            <p class="text-2xl font-black mt-1">${formatWindSpeed(current.wind_speed_10m)}</p>
          </div>
          <div>
            <p class="text-xs font-bold opacity-75 uppercase tracking-widest">Wind Direction</p>
            <p class="text-2xl font-black mt-1">${getWindDirection(current.wind_direction_10m)}</p>
          </div>
        </div>

        ${aqiInfo && aqiCurrent ? `
          <div class="mt-6 pt-6 border-t border-blue-500/30">
            <p class="text-xs font-bold opacity-75 uppercase tracking-widest mb-3">Air Quality Index (US)</p>
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-full ${aqiInfo.color} flex items-center justify-center">
                <span class="text-white font-black text-xl">${Math.round(aqi)}</span>
              </div>
              <div>
                <p class="text-lg font-black">${aqiInfo.label}</p>
                <p class="text-sm opacity-90 mt-1">PM2.5: ${aqiCurrent.pm2_5 ? aqiCurrent.pm2_5.toFixed(1) : 'N/A'} µg/m³</p>
                <p class="text-sm opacity-90">PM10: ${aqiCurrent.pm10 ? aqiCurrent.pm10.toFixed(1) : 'N/A'} µg/m³</p>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderHourlyForecast() {
    if (!weatherState.hourlyWeather || !weatherState.hourlyWeather.time) return '';

    const hourly = weatherState.hourlyWeather;
    const now = new Date();
    const currentHourIndex = hourly.time.findIndex(time => {
      const forecastTime = new Date(time);
      return forecastTime > now;
    });

    if (currentHourIndex === -1) return '';

    const nextHours = hourly.time.slice(currentHourIndex, currentHourIndex + 12);

    return `
      <div class="mt-6">
        <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Next 12 Hours</h4>
        <div class="grid grid-cols-6 gap-2">
          ${nextHours.map((time, idx) => {
            const forecastTime = new Date(time);
            const hour = forecastTime.getHours();
            const temp = hourly.temperature_2m[currentHourIndex + idx];
            const weatherCode = hourly.weather_code[currentHourIndex + idx];
            const precipitation = hourly.precipitation_probability[currentHourIndex + idx];
            const weather = getWeatherIcon(weatherCode);

            return `
              <div class="bg-slate-100 rounded-xl p-3 text-center">
                <p class="text-xs font-bold text-slate-600 mb-2">${hour}:00</p>
                <p class="text-2xl mb-2">${weather.icon}</p>
                <p class="text-sm font-black text-slate-900">${formatTemp(temp)}</p>
                <p class="text-xs text-slate-500 mt-1">${precipitation}% rain</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderDailyForecast() {
    if (!weatherState.dailyWeather || !weatherState.dailyWeather.time) return '';

    const daily = weatherState.dailyWeather;

    return `
      <div class="mt-6">
        <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">7-Day Forecast</h4>
        <div class="space-y-2">
          ${daily.time.slice(0, 7).map((time, idx) => {
            const forecastDate = new Date(time);
            const dayName = forecastDate.toLocaleDateString('en-US', { weekday: 'short' });
            const dateStr = forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const maxTemp = daily.temperature_2m_max[idx];
            const minTemp = daily.temperature_2m_min[idx];
            const weatherCode = daily.weather_code[idx];
            const precipitation = daily.precipitation_sum[idx];
            const windSpeed = daily.wind_speed_10m_max[idx];
            const weather = getWeatherIcon(weatherCode);

            return `
              <div class="bg-white border-2 border-slate-200 rounded-xl p-4 hover:border-blue-400 transition">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <p class="text-sm font-black text-slate-900">${dayName}</p>
                    <p class="text-xs text-slate-500">${dateStr}</p>
                  </div>
                  <div class="text-3xl">${weather.icon}</div>
                  <div class="flex-1 text-right">
                    <p class="text-xs font-bold text-slate-600 uppercase tracking-widest">${weather.label}</p>
                    <div class="flex gap-3 justify-end mt-2">
                      <div>
                        <p class="text-xs text-slate-500">High</p>
                        <p class="text-lg font-black text-slate-900">${formatTemp(maxTemp)}</p>
                      </div>
                      <div>
                        <p class="text-xs text-slate-500">Low</p>
                        <p class="text-lg font-black text-slate-900">${formatTemp(minTemp)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="flex gap-4 mt-3 pt-3 border-t border-slate-100 text-xs">
                  <span class="text-slate-600"><strong>Rain:</strong> ${precipitation.toFixed(1)}mm</span>
                  <span class="text-slate-600"><strong>Wind:</strong> ${formatWindSpeed(windSpeed)}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderSearchResults(root) {
    const resultsContainer = root.querySelector('#weather-search-results');
    if (!resultsContainer) return;

    if (!weatherState.showSearchResults || weatherState.searchResults.length === 0) {
      resultsContainer.innerHTML = '';
      return;
    }

    resultsContainer.innerHTML = `
      <div class="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
        ${weatherState.searchResults.map((result, idx) => `
          <button
            type="button"
            class="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition"
            data-location-index="${idx}"
          >
            <p class="font-bold text-slate-900">${escapeHtml(result.name)}</p>
            <p class="text-xs text-slate-500">${escapeHtml(result.admin1 || '')} ${escapeHtml(result.country || '')}</p>
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderContent(root) {
    const contentEl = root.querySelector('#weather-tool-content');
    const titleEl = root.querySelector('#tool-weather-title');
    if (!contentEl) return;

    // Update title with city name
    if (titleEl && weatherState.cityName) {
      titleEl.textContent = escapeHtml(weatherState.cityName);
    }

    if (weatherState.loading) {
      contentEl.innerHTML = `
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <div class="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p class="text-slate-600 font-bold">Loading weather data...</p>
          </div>
        </div>
      `;
      return;
    }

    if (weatherState.error) {
      contentEl.innerHTML = `
        <div class="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
          <p class="text-red-700 font-bold">⚠️ ${escapeHtml(weatherState.error)}</p>
        </div>
      `;
      return;
    }

    if (!weatherState.currentWeather) {
      contentEl.innerHTML = `
        <div class="text-center py-8 text-slate-600">
          <p class="font-bold">Search for a location to see weather</p>
        </div>
      `;
      return;
    }

    contentEl.innerHTML = `
      ${renderCurrentWeather()}
      ${renderHourlyForecast()}
      ${renderDailyForecast()}
    `;
  }

  function initWeather(root) {
    const searchInput = root.querySelector('#weather-search-input');
    const searchBtn = root.querySelector('#weather-search-btn');
    const resultsContainer = root.querySelector('#weather-search-results');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        weatherState.searchQuery = e.target.value;
        if (weatherState.searchQuery.length > 2) {
          searchLocation(weatherState.searchQuery);
          weatherState.showSearchResults = true;
        } else {
          weatherState.searchResults = [];
          weatherState.showSearchResults = false;
        }
        renderSearchResults(root);
      });

      searchInput.addEventListener('focus', () => {
        if (weatherState.searchResults.length > 0) {
          weatherState.showSearchResults = true;
          renderSearchResults(root);
        }
      });

      searchInput.addEventListener('blur', () => {
        setTimeout(() => {
          weatherState.showSearchResults = false;
          renderSearchResults(root);
        }, 200);
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', async () => {
        if (weatherState.searchResults.length > 0) {
          const result = weatherState.searchResults[0];
          await fetchWeather(result.latitude, result.longitude, result.name);
          weatherState.searchQuery = '';
          weatherState.searchResults = [];
          weatherState.showSearchResults = false;
          renderContent(root);
        }
      });
    }

    if (resultsContainer) {
      resultsContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-location-index]');
        if (!btn) return;

        const idx = parseInt(btn.dataset.locationIndex, 10);
        const result = weatherState.searchResults[idx];

        if (result) {
          await fetchWeather(result.latitude, result.longitude, result.name);
          weatherState.searchQuery = '';
          weatherState.searchResults = [];
          weatherState.showSearchResults = false;
          renderContent(root);
        }
      });
    }

    // Load last saved city or default
    (async () => {
      const lastCity = await getLastCity();
      if (lastCity && lastCity.latitude && lastCity.longitude) {
        await fetchWeather(lastCity.latitude, lastCity.longitude, lastCity.name);
      } else {
        // Default to New Delhi
        await fetchWeather(28.6139, 77.2090, 'New Delhi');
      }
      renderContent(root);
    })();
  }

  return {
    id: 'weather',
    title: 'Weather',
    subtitle: 'Real-time forecasts',
    description: 'Check current weather and 7-day forecast for any location.',
    badge: '🌤️',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-tool-modal="weather" role="dialog" aria-modal="true" aria-labelledby="tool-weather-title">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-white border-2 border-slate-200 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
            <div class="border-b border-slate-200 p-6 bg-gradient-to-r from-blue-50 to-slate-50">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <p class="text-xs font-black text-blue-600 uppercase tracking-widest">Weather</p>
                  <h2 id="tool-weather-title" class="text-2xl font-black text-slate-900 mt-1 tracking-tighter">Global Forecast</h2>
                </div>
                <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 transition" data-close-utility aria-label="Close dialog">✕</button>
              </div>
              
              <div class="relative">
                <div class="flex gap-2">
                  <input
                    id="weather-search-input"
                    type="text"
                    placeholder="Search location..."
                    class="flex-1 px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    autocomplete="off"
                  />
                  <button
                    id="weather-search-btn"
                    type="button"
                    class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
                  >
                    Search
                  </button>
                </div>
                <div id="weather-search-results"></div>
              </div>
            </div>
            
            <div id="weather-tool-content" class="flex-1 overflow-y-auto p-6">
              <div class="flex items-center justify-center py-12">
                <div class="text-center">
                  <div class="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  <p class="text-slate-600 font-bold">Loading weather data...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      initWeather(root);
    },
    onOpen(root) {
      renderContent(root);
    },
  };
}
