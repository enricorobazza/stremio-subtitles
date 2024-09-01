
import { parse } from 'node-html-parser';
import { Subtitle } from 'stremio-addon-sdk';

import pino from 'pino';
const logger = pino();

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1';
const PORT = process.env.PORT ?? 3010;

const getHtmlFromUrl = async (url: string) => {
	const res = await fetch(url)
	const data = await res.text();

	if (!data) throw new Error('failed to get data')

	return parse(data);
}

const getDownloadLink = async (url: string) => {
	logger.info(`Getting download link for ${url}`);
	const res = await fetch(url)
	const data = await res.text();

	logger.info(data);

	if (!data) {
		throw new Error('failed to get data');
	}

	const regex = new RegExp(/(https:\/\/[^']*)/);
	const downloadUrl = regex.exec(data)?.[1];

	return downloadUrl;
}

const getSubtitlesFromLangMovie = async (lang: string, movieId: string) => {
	const url = `https://www.opensubtitles.com/en/${lang}/search-movie/q-osdb:${movieId}/hearing_impaired-hearing_impaired-1/machine_translated-machine_translated-1/trusted_sources-trusted_sources-1`;
	return await getSubtitles(url, 'movie');
}

const getSubtitlesFromLangShow = async (lang: string, movieId: string, season: number, episode: number) => {
	const url = `https://www.opensubtitles.com/en/${lang}/search-tvshows/q-osdb:${movieId}/hearing_impaired-hearing_impaired-1/machine_translated-machine_translated-1/trusted_sources-trusted_sources-1/season-${season}/episode-${episode}`;
	return await getSubtitles(url, 'show');
}

const getLinks = (subtitles: Subtitle[]) => {
	return subtitles.map(subtitle => {

		const link = subtitle.url;

		const apiUrl = PORT !== "80" ? `${BASE_URL}:${PORT}` : BASE_URL;

		const url = `${apiUrl}/sub.vtt?from=${encodeURIComponent(link)}&source=com`;

		return {
			...subtitle,
			url
		}

	});
}

const getSubtitles = async (url: string, type: 'show' | 'movie') => {
	logger.info(`Reading subtitle information from ${url}`);
	const html = await getHtmlFromUrl(url);

	const rows = html.querySelectorAll('.table tr');

	const subs: {
		id: string,
		lang: string,
		url: string,
		downloads: number,
	}[] = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];

		const idPlus = type === 'movie' ? 0 : 2;

		const url = row.querySelectorAll('td')[8 + idPlus]?.querySelector('a[data-remote="true"]')?.getAttribute('href');

		if (!url) continue;

		const fullUrl = `https://www.opensubtitles.com/${url}`;
		// const downloadLink = await getDownloadLink(fullUrl);

		// if (!downloadLink) continue;

		const downloads = parseInt(row.querySelectorAll('td')[7 + idPlus]?.textContent)

		// hardcoded for portuguese
		subs.push({
			id: `por-${i}`,
			lang: 'por',
			url: fullUrl,
			downloads: downloads
		})
	};

	return getLinks(subs.sort((a, b) => b.downloads - a.downloads).map(a => {
		const { downloads, ...rest } = a;
		return rest
	}));
}

const getMovieIdfromImdbId = async (imdbId: string) => {
	logger.info(`Getting movie id for imdbId: ${imdbId}`);
	const url = `https://www.opensubtitles.com/pt-PT/en/search-all/q-${imdbId}/hearing_impaired-include/machine_translated-/trusted_sources-`;
	const html = await getHtmlFromUrl(url);

	const openSubtitlesOrgUrl = [...html.querySelectorAll('.box-sub-button-list a[rel="external"]')].map(a => a.getAttribute('href')).filter(link => link?.includes('www.opensubtitles.org'))[0];

	const parts = openSubtitlesOrgUrl?.split('/');
	const movieId = parts ? parts[parts.length - 1].replace('idmovie-', '') : undefined;

	return movieId;
}

const getMovieSubtitles = async (imdbId: string) => {

	const movieId = await getMovieIdfromImdbId(imdbId);

	if (!movieId) return;

	return await getSubtitlesFromLangMovie('pt-BR', movieId);
}

const getSeriesSubtitles = async (imdbId: string, season: string, episode: string) => {
	const movieId = await getMovieIdfromImdbId(imdbId);

	if (!movieId) return;

	return await getSubtitlesFromLangShow('pt-BR', movieId, parseInt(season), parseInt(episode));
}

// getMovieSubtitles('tt24169886');
// getSeriesSubtitles('tt0903747', 5, 3);

export default { getMovieSubtitles, getSeriesSubtitles, getDownloadLink }