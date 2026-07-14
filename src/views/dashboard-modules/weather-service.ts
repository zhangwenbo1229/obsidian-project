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

export type WeatherProviderId = 'open-meteo' | 'qweather' | 'openweathermap';

export interface WeatherProviderRequest {
	provider: WeatherProviderId;
	latitude: number;
	longitude: number;
	forecastDays: number;
	refreshMinutes: number;
	apiKey: string;
	apiHost: string;
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

export function buildQWeatherUrls(
	apiHost: string,
	latitude: number,
	longitude: number,
	apiKey: string,
): { current: string; forecast: string } {
	const host = (apiHost.trim() || 'https://devapi.qweather.com').replace(/\/+$/gu, '');
	let origin: string;
	try {
		const parsed = new URL(host);
		if (parsed.protocol !== 'https:') throw new Error('protocol');
		origin = parsed.origin;
	} catch {
		throw new Error('和风天气 API Host 必须是有效的 HTTPS 地址。');
	}
	const create = (path: string) => {
		const url = new URL(path, `${origin}/`);
		url.searchParams.set('location', `${longitude},${latitude}`);
		url.searchParams.set('key', apiKey);
		return url.toString();
	};
	return { current: create('v7/weather/now'), forecast: create('v7/weather/7d') };
}

export function buildOpenWeatherMapUrls(
	latitude: number,
	longitude: number,
	apiKey: string,
): { current: string; forecast: string } {
	const create = (path: string) => {
		const url = new URL(path, 'https://api.openweathermap.org/');
		url.searchParams.set('lat', String(latitude));
		url.searchParams.set('lon', String(longitude));
		url.searchParams.set('appid', apiKey);
		url.searchParams.set('units', 'metric');
		url.searchParams.set('lang', 'zh_cn');
		return url.toString();
	};
	return { current: create('data/2.5/weather'), forecast: create('data/2.5/forecast') };
}

function numberValue(value: unknown, name: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`天气数据缺少 ${name}`);
	return value;
}

function numericValue(value: unknown, name: string): number {
	const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	if (!Number.isFinite(number)) throw new Error(`天气数据缺少 ${name}`);
	return number;
}

function recordValue(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function qWeatherCondition(iconValue: unknown, textValue: unknown): WeatherCondition & { weatherCode: number } {
	const icon = Number(iconValue);
	const text = stringValue(textValue, '未知');
	let lucide = 'cloud';
	if (icon === 100 || icon === 150) lucide = 'sun';
	else if ([101, 102, 103, 151, 152, 153].includes(icon)) lucide = 'cloud-sun';
	else if (icon >= 300 && icon < 400) lucide = icon >= 302 && icon <= 304 ? 'cloud-lightning' : 'cloud-rain';
	else if (icon >= 400 && icon < 500) lucide = 'cloud-snow';
	else if (icon >= 500) lucide = 'cloud-fog';
	return { label: text, icon: lucide, weatherCode: Number.isFinite(icon) ? icon : -1 };
}

export function normalizeQWeatherResponses(currentValue: unknown, forecastValue: unknown, forecastDays = 3): WeatherSnapshot {
	const currentResponse = recordValue(currentValue);
	const forecastResponse = recordValue(forecastValue);
	if (currentResponse.code !== '200' || forecastResponse.code !== '200') throw new Error('和风天气返回错误状态。');
	const now = recordValue(currentResponse.now);
	const currentCondition = qWeatherCondition(now.icon, now.text);
	const daily = arrayValue(forecastResponse.daily, 'daily');
	return {
		current: {
			temperature: numericValue(now.temp, 'now.temp'),
			apparentTemperature: numericValue(now.feelsLike, 'now.feelsLike'),
			windSpeed: numericValue(now.windSpeed, 'now.windSpeed'),
			...currentCondition,
		},
		forecast: daily.slice(0, Math.min(7, Math.max(1, Math.round(forecastDays)))).map((item) => {
			const day = recordValue(item);
			const condition = qWeatherCondition(day.iconDay, day.textDay);
			return {
				date: stringValue(day.fxDate),
				minimum: numericValue(day.tempMin, 'daily.tempMin'),
				maximum: numericValue(day.tempMax, 'daily.tempMax'),
				...condition,
			};
		}),
	};
}

function openWeatherCondition(value: unknown): WeatherCondition & { weatherCode: number } {
	const record = recordValue(value);
	const weatherCode = numericValue(record.id, 'weather.id');
	let icon = 'cloud';
	if (weatherCode >= 200 && weatherCode < 300) icon = 'cloud-lightning';
	else if (weatherCode >= 300 && weatherCode < 600) icon = weatherCode < 500 ? 'cloud-drizzle' : 'cloud-rain';
	else if (weatherCode >= 600 && weatherCode < 700) icon = 'cloud-snow';
	else if (weatherCode >= 700 && weatherCode < 800) icon = 'cloud-fog';
	else if (weatherCode === 800) icon = 'sun';
	else if (weatherCode < 803) icon = 'cloud-sun';
	return { weatherCode, label: stringValue(record.description, '未知'), icon };
}

export function normalizeOpenWeatherMapResponses(currentValue: unknown, forecastValue: unknown, forecastDays = 3): WeatherSnapshot {
	const current = recordValue(currentValue);
	const currentMain = recordValue(current.main);
	const currentWind = recordValue(current.wind);
	const currentWeather = arrayValue(current.weather, 'weather')[0];
	const grouped = new Map<string, Array<Record<string, unknown>>>();
	for (const raw of arrayValue(recordValue(forecastValue).list, 'forecast.list')) {
		const item = recordValue(raw);
		const date = stringValue(item.dt_txt).slice(0, 10);
		if (!date) continue;
		const entries = grouped.get(date) ?? [];
		entries.push(item);
		grouped.set(date, entries);
	}
	const forecast = [...grouped.entries()].slice(0, Math.min(5, Math.max(1, Math.round(forecastDays)))).map(([date, entries]) => {
		const representative = entries.find((entry) => stringValue(entry.dt_txt).includes('12:00:00')) ?? entries[0]!;
		const mainValues = entries.map((entry) => recordValue(entry.main));
		const condition = openWeatherCondition(arrayValue(representative.weather, 'forecast.weather')[0]);
		return {
			date,
			minimum: Math.min(...mainValues.map((main) => numericValue(main.temp_min, 'forecast.temp_min'))),
			maximum: Math.max(...mainValues.map((main) => numericValue(main.temp_max, 'forecast.temp_max'))),
			...condition,
		};
	});
	return {
		current: {
			temperature: numericValue(currentMain.temp, 'main.temp'),
			apparentTemperature: numericValue(currentMain.feels_like, 'main.feels_like'),
			windSpeed: Math.round(numericValue(currentWind.speed, 'wind.speed') * 3.6 * 10) / 10,
			...openWeatherCondition(currentWeather),
		},
		forecast,
	};
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

	async loadProvider(options: WeatherProviderRequest, force = false): Promise<WeatherSnapshot> {
		if (options.provider === 'open-meteo') {
			return this.load(
				options.latitude,
				options.longitude,
				options.refreshMinutes,
				force,
				options.forecastDays,
			);
		}
		if (!options.apiKey.trim()) throw new Error('所选天气数据源需要 API Key。');
		if (options.provider === 'qweather' && !options.apiHost.trim()) throw new Error('和风天气需要 API Host。');
		const key = `${options.provider},${options.apiHost},${options.latitude},${options.longitude},${options.forecastDays}`;
		const cached = this.cache.get(key);
		const ttl = Math.max(1, options.refreshMinutes) * 60_000;
		if (!force && cached && this.now() - cached.loadedAt < ttl) return cached.data;
		let data: WeatherSnapshot;
		try {
			if (options.provider === 'qweather') {
				const urls = buildQWeatherUrls(options.apiHost, options.latitude, options.longitude, options.apiKey);
				const [current, forecast] = await Promise.all([this.request(urls.current), this.request(urls.forecast)]);
				data = normalizeQWeatherResponses(current, forecast, options.forecastDays);
			} else {
				const urls = buildOpenWeatherMapUrls(options.latitude, options.longitude, options.apiKey);
				const [current, forecast] = await Promise.all([this.request(urls.current), this.request(urls.forecast)]);
				data = normalizeOpenWeatherMapResponses(current, forecast, options.forecastDays);
			}
		} catch (error) {
			const providerName = options.provider === 'qweather' ? '和风天气' : 'OpenWeatherMap';
			const reason = error instanceof Error && !error.message.includes(options.apiKey)
				? `：${error.message}`
				: '';
			throw new Error(`${providerName}天气数据源请求失败${reason}。`);
		}
		this.cache.set(key, { loadedAt: this.now(), data });
		return data;
	}
}
