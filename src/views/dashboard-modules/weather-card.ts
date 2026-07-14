import { requestUrl, setIcon } from 'obsidian';
import type { WeatherDashboardModuleConfig } from '../../domain/types';
import { createHeadingButton, createModuleBody, renderModuleMessage } from './card-ui';
import { renderWeatherSettings } from './module-settings';
import type { DashboardModuleDefinition, DashboardModuleRenderContext } from './types';
import { WeatherService, type WeatherSnapshot } from './weather-service';

const weatherService = new WeatherService(async (url) => {
	const response = await requestUrl({ url });
	return response.json as unknown;
});

function roundedTemperature(value: number): string {
	return `${Math.round(value)}°`;
}

function forecastDay(date: string): string {
	return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(`${date}T00:00:00`));
}

function renderSnapshot(body: HTMLElement, snapshot: WeatherSnapshot): void {
	body.empty();
	const hero = body.createDiv({ cls: 'op-weather-current' });
	const icon = hero.createSpan({ cls: 'op-weather-current-icon' });
	setIcon(icon, snapshot.current.icon);
	const temperature = hero.createDiv({ cls: 'op-weather-temperature' });
	temperature.createEl('strong', { text: roundedTemperature(snapshot.current.temperature) });
	temperature.createSpan({ text: snapshot.current.label });
	const details = hero.createDiv({ cls: 'op-weather-details' });
	details.createSpan({ text: `体感 ${roundedTemperature(snapshot.current.apparentTemperature)}` });
	details.createSpan({ text: `风速 ${Math.round(snapshot.current.windSpeed)} km/h` });
	const forecast = body.createDiv({ cls: 'op-weather-forecast' });
	for (const day of snapshot.forecast) {
		const item = forecast.createDiv({ cls: 'op-weather-forecast-day' });
		item.createSpan({ text: forecastDay(day.date) });
		const dayIcon = item.createSpan({ cls: 'op-weather-forecast-icon', attr: { title: day.label } });
		setIcon(dayIcon, day.icon);
		item.createEl('strong', { text: `${roundedTemperature(day.maximum)} / ${roundedTemperature(day.minimum)}` });
	}
}

async function renderWeather(context: DashboardModuleRenderContext): Promise<void> {
	const config = context.card.moduleConfig as WeatherDashboardModuleConfig;
	context.heading.createSpan({ cls: 'op-dashboard-module-subtitle', text: config.locationName });
	const body = createModuleBody(context.container, 'op-weather-card');
	if (!config.networkEnabled) {
		renderModuleMessage(body, 'cloud-off', '未启用联网', '右键打开卡片设置，确认地点并允许获取天气。');
		return;
	}
	let loadGeneration = 0;
	const load = async (force = false) => {
		const currentLoad = ++loadGeneration;
		body.empty();
		renderModuleMessage(body, 'loader-circle', '正在更新天气', '正在连接 Open-Meteo。', 'op-dashboard-module-loading');
		try {
			const snapshot = await weatherService.load(config.latitude, config.longitude, config.refreshMinutes, force);
			if (!context.isCurrent() || currentLoad !== loadGeneration) return;
			renderSnapshot(body, snapshot);
		} catch (error) {
			if (!context.isCurrent() || currentLoad !== loadGeneration) return;
			body.empty();
			renderModuleMessage(body, 'cloud-alert', '天气暂不可用', error instanceof Error ? error.message : String(error), 'op-dashboard-module-error');
		}
	};
	createHeadingButton(context.heading, 'refresh-cw', '刷新天气', () => void load(true));
	await load();
}

export const weatherDefinition: DashboardModuleDefinition = {
	kind: 'weather',
	label: '天气',
	icon: 'cloud-sun',
	render: renderWeather,
	renderSettings: renderWeatherSettings,
};
