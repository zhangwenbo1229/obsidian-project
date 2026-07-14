export interface WeatherCondition {
	label: string;
	icon: string;
}

export interface WeatherSnapshot {
	current: {
		temperature: number;
		apparentTemperature: number;
		windSpeed: number;
		weatherCode: number;
		label: string;
		icon: string;
	};
	forecast: Array<{
		date: string;
		minimum: number;
		maximum: number;
		weatherCode: number;
		label: string;
		icon: string;
	}>;
}

type WeatherRequest = (url: string) => Promise<unknown>;

interface OpenMeteoResponse {
	current?: Record<string, unknown>;
	daily?: Record<string, unknown>;
}

const CONDITIONS: Array<{ codes: number[]; condition: WeatherCondition }> = [
	{ codes: [0], condition: { label: '晴', icon: 'sun' } },
	{ codes: [1], condition: { label: '晴间多云', icon: 'cloud-sun' } },
	{ codes: [2], condition: { label: '多云', icon: 'cloud-sun' } },
	{ codes: [3], condition: { label: '阴', icon: 'cloud' } },
	{ codes: [45, 48], condition: { label: '雾', icon: 'cloud-fog' } },
	{ codes: [51, 53, 55, 56, 57], condition: { label: '毛毛雨', icon: 'cloud-drizzle' } },
	{ codes: [61, 63, 65, 66, 67, 80, 81, 82], condition: { label: '雨', icon: 'cloud-rain' } },
	{ codes: [71, 73, 75, 77, 85, 86], condition: { label: '雪', icon: 'cloud-snow' } },
	{ codes: [95, 96, 99], condition: { label: '雷雨', icon: 'cloud-lightning' } },
];

export function mapWeatherCode(code: number): WeatherCondition {
	return CONDITIONS.find((item) => item.codes.includes(code))?.condition ?? { label: '未知', icon: 'cloud' };
}

export function buildOpenMeteoUrl(latitude: number, longitude: number, forecastDays = 3): string {
	const url = new URL('https://api.open-meteo.com/v1/forecast');
	url.searchParams.set('latitude', String(latitude));
	url.searchParams.set('longitude', String(longitude));
	url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m');
	url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
	url.searchParams.set('forecast_days', String(Math.min(7, Math.max(1, Math.round(forecastDays)))));
	url.searchParams.set('timezone', 'auto');
	return url.toString();
}

function numberValue(value: unknown, name: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`天气数据缺少 ${name}`);
	return value;
}

function arrayValue(value: unknown, name: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`天气数据缺少 ${name}`);
	return value;
}

export function normalizeWeatherResponse(value: unknown, forecastDays = 3): WeatherSnapshot {
	const response = value && typeof value === 'object' ? value as OpenMeteoResponse : {};
	const current = response.current ?? {};
	const daily = response.daily ?? {};
	const weatherCode = numberValue(current.weather_code, 'weather_code');
	const condition = mapWeatherCode(weatherCode);
	const dates = arrayValue(daily.time, 'daily.time');
	const codes = arrayValue(daily.weather_code, 'daily.weather_code');
	const maximums = arrayValue(daily.temperature_2m_max, 'daily.temperature_2m_max');
	const minimums = arrayValue(daily.temperature_2m_min, 'daily.temperature_2m_min');
	return {
		current: {
			temperature: numberValue(current.temperature_2m, 'temperature_2m'),
			apparentTemperature: numberValue(current.apparent_temperature, 'apparent_temperature'),
			windSpeed: numberValue(current.wind_speed_10m, 'wind_speed_10m'),
			weatherCode,
			...condition,
		},
		forecast: dates.slice(0, Math.min(7, Math.max(1, Math.round(forecastDays)))).map((date, index) => {
			if (typeof date !== 'string') throw new Error('天气日期格式无效');
			const code = numberValue(codes[index], 'daily.weather_code');
			return {
				date,
				minimum: numberValue(minimums[index], 'daily.temperature_2m_min'),
				maximum: numberValue(maximums[index], 'daily.temperature_2m_max'),
				weatherCode: code,
				...mapWeatherCode(code),
			};
		}),
	};
}

export class WeatherService {
	private readonly cache = new Map<string, { loadedAt: number; data: WeatherSnapshot }>();

	constructor(
		private readonly request: WeatherRequest,
		private readonly now: () => number = Date.now,
	) {}

	async load(
		latitude: number,
		longitude: number,
		refreshMinutes: number,
		force = false,
		forecastDays = 3,
	): Promise<WeatherSnapshot> {
		const key = `${latitude},${longitude},${forecastDays}`;
		const cached = this.cache.get(key);
		const ttl = Math.max(1, refreshMinutes) * 60_000;
		if (!force && cached && this.now() - cached.loadedAt < ttl) return cached.data;
		const data = normalizeWeatherResponse(await this.request(buildOpenMeteoUrl(latitude, longitude, forecastDays)), forecastDays);
		this.cache.set(key, { loadedAt: this.now(), data });
		return data;
	}
}
