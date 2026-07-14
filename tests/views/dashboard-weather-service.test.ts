import { describe, expect, it, vi } from 'vitest';
import { buildOpenMeteoUrl, mapWeatherCode, WeatherService } from '../../src/views/dashboard-modules/weather-service';

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
});
