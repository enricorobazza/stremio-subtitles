import OpenSubtitlesApi from './opensubtitles';
import OpenSubtitlesComApi from './opensubtitles-com';

const getSubtitles = async (id: string) => {
	const dataId = id.split(':');

	const imdbId = dataId[0];

	if (dataId.length > 1) { // series
		const season = dataId[1];
		const episode = dataId[2];

		let subtitles = await OpenSubtitlesApi.getSeriesSubtitles(imdbId, season, episode);

		if (!subtitles || subtitles.length === 0) {
			return await OpenSubtitlesComApi.getSeriesSubtitles(imdbId, season, episode);
		}

		return subtitles;
	}
	else { // movies

		let subtitles = await OpenSubtitlesApi.getMovieSubtitles(imdbId);

		if (!subtitles || subtitles.length === 0) {
			return await OpenSubtitlesComApi.getMovieSubtitles(imdbId);
		}

		return subtitles;
	}
}


export default { getSubtitles }