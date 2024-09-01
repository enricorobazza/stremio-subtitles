import fs from 'fs';
import unzipper from 'unzipper';
import path from 'path';
import util from 'util';
import axios from 'axios';
import pino from 'pino';
import chardet from 'chardet';
import OpenSubtitlesComApi from './opensubtitles-com';
const logger = pino();

// @ts-ignore
import { convert } from 'subtitle-converter';

const readdir = util.promisify(fs.readdir);

async function listSrtFiles(directoryPath: string) {
	try {
		// Read the contents of the directory
		const files = await readdir(directoryPath);

		// Filter the files to include only those with the .srt extension
		const srtFiles = files.filter(file => path.extname(file).toLowerCase() === '.srt');

		return srtFiles;
	} catch (err) {
		console.error('Error reading the directory:', err);
		return [];
	}
}

export async function downloadAndUnzip(url: string, downloadPath: string, outputPath: string) {
	logger.info(`Getting data from ${url}`);

	const response = await axios({
		url,
		method: 'GET',
		responseType: 'stream', // Important to set response type to stream
	});

	const fileStream = fs.createWriteStream(downloadPath);

	response.data.pipe(fileStream);

	await new Promise((resolve, reject) => {
		fileStream.on('finish', resolve);
		fileStream.on('error', () => {
			logger.error(`Failed to download file to ${downloadPath}`)
			reject();
		});
	});

	logger.info(`Zip file downloaded to ${downloadPath}, trying to unzip to ${outputPath}`);

	// Unzip the file
	await fs.createReadStream(downloadPath)
		.pipe(unzipper.Extract({ path: outputPath }))
		.promise();

	logger.info(`Sucessfully unziped to ${outputPath}, deleting ${downloadPath}`);

	fs.unlinkSync(downloadPath);

	const filePath = `${outputPath}/${(await listSrtFiles(outputPath))[0]}`;

	logger.info(`SRT file: ${filePath}`);

	const data = fs.readFileSync(filePath);

	const encoding = chardet.detect(data);

	const encodingMap: Record<string, BufferEncoding> = {
		'UTF-8': 'utf-8',
		'ISO-8859-1': 'latin1',
		'windows-1252': 'utf-8',
		'UTF-16LE': 'utf16le', // Node.js uses 'utf16le' for both LE and BE
		'UTF-16BE': 'utf16le'
	};

	logger.info(`Enconding of the file is: ${encoding}`);

	const content = data.toString((encodingMap[encoding ?? 'UTF-8'] ?? 'utf-8') as BufferEncoding);

	logger.info(`Converting to UTF-8`);

	const utf8Content = Buffer.from(content, 'utf-8');

	logger.info(`Converting file to vtt: ${filePath}`);

	const { subtitle } = convert(utf8Content.toString(), '.vtt', { removeTextFormatting: true });

	logger.info(`Deleting folder: ${outputPath}`);

	fs.rmSync(outputPath, { recursive: true, force: true });

	logger.info(`Returning subtitle`);

	return subtitle;
}

export const downloadAndConvert = async (url: string) => {
	const downloadLink = await OpenSubtitlesComApi.getDownloadLink(url);

	logger.info(`Getting data from ${downloadLink}`);

	const response = await axios({
		url,
		method: 'GET',
		responseType: 'text', // Important to set response type to stream
	});

	logger.info('Converting file to vtt}');

	const { subtitle } = convert(response.data, '.vtt', { removeTextFormatting: true });

	return subtitle;
}