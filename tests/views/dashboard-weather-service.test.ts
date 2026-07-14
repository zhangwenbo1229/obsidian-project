import { describe, expect, it, vi } from 'vitest';
import {
	buildOpenMeteoUrl,
	buildOpenWeatherMapUrls,
	buildQWeatherUrls,
	mapWeatherCode,
	normalizeOpenWeatherMapResponses,
	normalizeQWeatherResponses,
	WeatherService,
} from '../../src/views/dashboard-modules/weather-service';

const response = {
	current: {
		temperature_2m: 31.2,
		apparent_temperature: 34.5,
		weather_code: 2,
		wind_speed_10m: 12.4,
	},
	daily: {
		time: ['2026-07-14', '2026-07-15', '2026-07-16'],
		weather_code: [2, 61, 0],
		temperature_2m_max: [34, 31, 35],
		temperature_2m_min: [27, 25, 26],
	},
};

describe('dashboard weather service', () => {
	it('builds a three-day Open-Meteo request without leaking vault data', () => {
		const url = new URL(buildOpenMeteoUrl(31.2304, 121.4737, 6));
		expect(url.origin).toBe('https://api.open-meteo.com');
		expect(url.searchParams.get('latitude')).toBe('31.2304');
		expect(url.searchParams.get('longitude')).toBe('121.4737');
		expect(url.searchParams.get('forecast_days')).toBe('6');
		expect(url.searchParams.get('timezone')).toBe('auto');
	});

	it('normalizes weather codes and caches results until the configured TTL', async () => {
		let now = 1_000;
		const request = vi.fn(() => Promise.resolve(response));
		const service = new WeatherService(request, () => now);
		const first = await service.load(31.2304, 121.4737, 30);
		const cached = await service.load(31.2304, 121.4737, 30);
		expect(request).toHaveBeenCalledTimes(1);
		expect(first.current).toMatchObject({ temperature: 31.2, apparentTemperature: 34.5, label: '多云' });
		expect(first.forecast).toHaveLength(3);
		expect(cached).toBe(first);
		now += 31 * 60_000;
		await service.load(31.2304, 121.4737, 30);
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('supports a forced manual refresh and maps unknown codes safely', async () => {
		const request = vi.fn(() => Promise.resolve(response));
		const service = new WeatherService(request);
		await service.load(31.2304, 121.4737, 30);
		await service.load(31.2304, 121.4737, 30, true);
		expect(request).toHaveBeenCalledTimes(2);
		expect(mapWeatherCode(999)).toEqual({ label: '未知', icon: 'cloud' });
	});

	it('limits normalized forecasts to the configured day count', async () => {
		const service = new WeatherService(() => Promise.resolve(response));
		const result = await service.load(31.2304, 121.4737, 30, false, 2);
		expect(result.forecast).toHaveLength(2);
	});

	it('builds QWeather requests against the configured API host', () => {
		const urls = buildQWeatherUrls('https://abc.re.qweatherapi.com/', 31.2, 121.4, 'key value');
		expect(urls.current).toBe('https://abc.re.qweatherapi.com/v7/weather/now?location=121.4%2C31.2&key=key+value');
		expect(urls.forecast).toContain('/v7/weather/7d?');
	});

	it('normalizes QWeather current and daily responses', () => {
		const snapshot = normalizeQWeatherResponses({
			code: '200', now: { temp: '29', feelsLike: '31', windSpeed: '12', icon: '101', text: '多云' },
		}, {
			code: '200', daily: [
				{ fxDate: '2026-07-14', tempMin: '24', tempMax: '32', iconDay: '101', textDay: '多云' },
				{ fxDate: '2026-07-15', tempMin: '25', tempMax: '33', iconDay: '305', textDay: '小雨' },
			],
		}, 2);
		expect(snapshot.current).toMatchObject({ temperature: 29, apparentTemperature: 31, label: '多云' });
		expect(snapshot.forecast).toHaveLength(2);
		expect(snapshot.forecast[1]).toMatchObject({ date: '2026-07-15', minimum: 25, maximum: 33, label: '小雨' });
	});

	it('builds and normalizes OpenWeatherMap current and grouped forecast responses', () => {
		const urls = buildOpenWeatherMapUrls(31.2, 121.4, 'key value');
		expect(urls.current).toContain('api.openweathermap.org/data/2.5/weather');
		expect(urls.current).toContain('units=metric');
		const snapshot = normalizeOpenWeatherMapResponses({
			main: { temp: 28, feels_like: 30 }, wind: { speed: 3 }, weather: [{ id: 800, description: '晴' }],
		}, {
			list: [
				{ dt_txt: '2026-07-14 03:00:00', main: { temp_min: 24, temp_max: 30 }, weather: [{ id: 801, description: '少云' }] },
				{ dt_txt: '2026-07-14 12:00:00', main: { temp_min: 26, temp_max: 34 }, weather: [{ id: 800, description: '晴' }] },
				{ dt_txt: '2026-07-15 12:00:00', main: { temp_min: 25, temp_max: 32 }, weather: [{ id: 500, description: '小雨' }] },
			],
		}, 2);
		expect(snapshot.current).toMatchObject({ temperature: 28, windSpeed: 10.8, label: '晴' });
		expect(snapshot.forecast).toEqual([
			expect.objectContaining({ date: '2026-07-14', minimum: 24, maximum: 34 }),
			expect.objectContaining({ date: '2026-07-15', minimum: 25, maximum: 32 }),
		]);
	});

	it('requires API keys before requesting authenticated providers', async () => {
		const request = vi.fn(() => Promise.resolve({}));
		const service = new WeatherService(request);
		await expect(service.loadProvider({
			provider: 'qweather', latitude: 31, longitude: 121, forecastDays: 3,
			refreshMinutes: 30, apiKey: '', apiHost: '',
		})).rejects.toThrow('API Key');
		expect(request).not.toHaveBeenCalled();
	});

	it('rejects non-https QWeather hosts', () => {
		expect(() => buildQWeatherUrls('http://example.com', 31, 121, 'key')).toThrow('HTTPS');
		expect(() => buildQWeatherUrls('file:///secret', 31, 121, 'key')).toThrow('HTTPS');
	});

	it('redacts API keys from provider request errors', async () => {
		const service = new WeatherService((url) => Promise.reject(new Error(`request failed: ${url}`)));
		const error = await service.loadProvider({
			provider: 'openweathermap', latitude: 31, longitude: 121, forecastDays: 3,
			refreshMinutes: 30, apiKey: 'private-secret', apiHost: '',
		}).catch((reason: unknown) => reason);
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).not.toContain('private-secret');
		expect((error as Error).message).toContain('天气数据源请求失败');
	});
});
