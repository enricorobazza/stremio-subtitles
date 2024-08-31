import { addonBuilder, publishToCentral, Subtitle } from 'stremio-addon-sdk';
import SubtitlesService from './services/subtitles';
import pino from 'pino';
import serveHTTP from './services/serveHTTP';

const logger = pino();

const builder = new addonBuilder({
	id: 'org.enricorobazza.stremio-subtitles',
	version: '1.0.0',

	logo: undefined,
	name: 'Stremio Subtitles',
	description: 'PT-BR Subtitles',

	types: ['movie', 'series'],
	catalogs: [],
	resources: [
		'subtitles'
	]
})

const handleSubtitles = (args: { id: string }) => new Promise<{ subtitles: Subtitle[] }>(async (resolve, reject) => {
	logger.info(`Fetching subtitles with args: ${JSON.stringify(args)}`)
	const dataID = args.id.split(':')
	if ((dataID[0]).slice(0, 2) === 'tt' && dataID[0].length <= 12) {
		try {
			const subtitles = await SubtitlesService.getSubtitles(args.id);
			if (subtitles)
				return resolve({ subtitles })
		} catch (error) {
			logger.error(error);
			return resolve({ subtitles: [] })
		}
	} else {
		return resolve({ subtitles: [] })
	}
})

builder.defineSubtitlesHandler(handleSubtitles);

export default builder.getInterface();

// serveHTTP(builder.getInterface(), {
// 	port: (process.env.PORT ?? 3010) as number
// })

// handleSubtitles({ id: "tt1190634:1:7" });

// If you want this addon to appear in the addon catalogs, call .publishToCentral() with the publically available URL to your manifest
// publishToCentral('https://my-addon.com/manifest.json')