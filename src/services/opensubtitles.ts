import pino from 'pino';
const logger = pino();
import { HTMLElement, parse } from 'node-html-parser';
import { Subtitle } from 'stremio-addon-sdk';

const BaseURL = 'https://www.opensubtitles.org';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1';
const PORT = process.env.PORT ?? 3010;

type Episode = { ep: string, season: number, title?: string, url?: string };
type SerieSeason = Record<string, Episode>;

const getMetaData = async (imdbId: string) => {
	try {
		const url = `${BaseURL}/libs/suggest.php?format=json3&MovieName=${imdbId}`
		logger.info(`Fetching metadata: ${url}`);
		const res = await fetch(url);
		const data = await res.json() as { id: number }[];
		if (!data) throw "getOpenSubData error getting data"
		return data;
	} catch (e) {
		logger.error(e);
	}
};

const getSubtitlesForPath = async (path: string) => {
	try {
		const url = BaseURL + path;
		logger.info(`Querying url: ${url}`);
		const res = await fetch(url)
		const data = await res.text();

		if (!data) throw new Error("Failed to get subtitles");

		const html = parse(data)
		let rows = html.querySelectorAll('#search_results > tbody > tr:not(.head)')
		var subs = [];
		for (let i = 0; i < rows.length; i++) {

			let elements = rows[i].querySelectorAll("td");

			const urlElement = elements[4]?.querySelector('a') as HTMLElement;

			const langElement = elements[1]?.childNodes[0] as HTMLElement;
			const langCode = langElement?.querySelector('div')?.classNames.replace('flag ', '');

			if (!langCode || !urlElement) continue;

			subs.push(
				{
					lang: langCode,
					url: BaseURL + urlElement.getAttribute("href"),
					id: langCode
				}
			)
		}
		return (subs)

	} catch (e) {
		logger.error(e)
	}
}

const getShow = async (imdbId: string, openSubId: number) => {
	const url = `${BaseURL}/en/ssearch/sublanguageid-all/imdbid-${imdbId.replace('tt', '')}/idmovie-${openSubId}`;
	logger.info(`Getting show info: ${url}`);
	const res = await fetch(url)
	const data = await res.text();

	if (!data) throw new Error('failed to get data')

	const html = parse(data);
	const rows = html.querySelectorAll('#search_results tr:not(.head)')
	let season = 0;
	const episodes: Record<string, SerieSeason> = {};
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row.childNodes.length !== 1) {
			if (season != 0) {
				const node = row.childNodes[0] as HTMLElement;
				const ep = node.querySelector("span")?.rawText;
				if (node.querySelector("a")) {
					let title = node.querySelector("a")?.rawText;
					let url = node.querySelector("a")?.getAttribute('href');
					if (ep) {
						episodes[String(season)][ep] = { ep: ep, title: title, url: url, season: season }
					}
				}
				else {
					if (ep)
						episodes[String(season)][ep] = { ep: ep, season: season }
				}

			}
		}
		else {
			season++;
			episodes[String(season)] = {};
		}
	}
	return episodes;
}

type PathFn = (lang: string, imdbId: string, openSubId: number) => string

const getSubtitles = async (imdbId: string, openSubId: number, pathFn: PathFn) => {
	const languages = ['pt', 'pb', 'en'];
	const reMap: Record<string, string> = {
		'pt': 'por',
		'pb': 'pob',
		'en': 'eng'
	}

	const langSubs: Record<string, Subtitle[]> = {};

	const formatSubtitle = (subtitle: Subtitle, index: number) => {
		return {
			id: `${reMap[subtitle.id]}-${index}`,
			lang: reMap[subtitle.lang],
			url: subtitle.url
		}
	}

	for (let i = 0; i < languages.length; i++) {
		const lang = languages[i];
		const path = pathFn(reMap[lang], imdbId.replace('tt', ''), openSubId);
		const subtitles = await getSubtitlesForPath(path);
		if (subtitles) {
			langSubs[lang] = subtitles.map(formatSubtitle);
		}
	}

	// if no pb, set as pt
	if (!('pb' in langSubs) && 'pt' in langSubs) {
		logger.info('No BR portuguese, setting as PT');
		langSubs['pb'] = langSubs['pt'];
	}

	// delete pt
	if ('pt' in langSubs) {
		delete langSubs['pt'];
	}

	return getLinks(Object.values(langSubs).flat(1));
}

const getEpisodeUrl = async (imdbId: string, openSubId: number, season: string, episode: string) => {
	const episodes = await getShow(imdbId, openSubId);
	return episodes?.[season]?.[episode]?.url;
}

const getSeriesSubtitles = async (imdbId: string, openSubId: number, season: string, episode: string) => {
	const episodeUrl = await getEpisodeUrl(imdbId, openSubId, season, episode);
	const pathFn: PathFn = (lang, imdbId, openSubId) => episodeUrl?.replace('sublanguageid-all', `sublanguageid-${lang}`) ?? "";
	return getSubtitles(imdbId, openSubId, pathFn);
}

const getLinks = (subtitles: Subtitle[]) => {
	return subtitles.map(subtitle => {

		const link = subtitle.url;
		const url = `${BASE_URL}:${PORT}/sub.vtt?from=${encodeURIComponent(link)}`;

		return {
			...subtitle,
			url
		}

	});
}

const getMovieSubtitles = async (imdbId: string, openSubId: number) => {
	const pathFn: PathFn = (lang, imdbId, openSubId) => `/en/search/sublanguageid-${lang}/imdbid-${imdbId}/idmovie-${openSubId}`
	return getSubtitles(imdbId, openSubId, pathFn);
}

export default { getMetaData, getSeriesSubtitles, getMovieSubtitles };