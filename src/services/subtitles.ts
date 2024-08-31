import OpenSubtitlesApi from './opensubtitles';

const getSubtitles = async (id: string) => {
	const dataId = id.split(':');

	const imdbId = dataId[0];

	const openSubMetaData = await OpenSubtitlesApi.getMetaData(imdbId);

	if (!openSubMetaData || openSubMetaData.length === 0) {
		return
	}

	const openSubId = openSubMetaData?.[0]?.id;

	if (dataId.length > 1) { // series
		const season = dataId[1];
		const episode = dataId[2];
		return await OpenSubtitlesApi.getSeriesSubtitles(imdbId, openSubId, season, episode);
	}
	else { // movies
		return await OpenSubtitlesApi.getMovieSubtitles(imdbId, openSubId);
	}

	return [];
}


export default { getSubtitles }