import fs from 'fs';
import unzipper from 'unzipper';
import fetch from 'node-fetch';
import path from 'path';
import util from 'util';

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

async function downloadAndUnzip(url: string, downloadPath: string, outputPath: string) {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to download file: ${response.statusText}`);
	}

	const fileStream = fs.createWriteStream(downloadPath);
	await new Promise((resolve, reject) => {
		response?.body?.pipe(fileStream);
		response?.body?.on('error', reject);
		fileStream.on('finish', resolve);
	});

	// Unzip the file
	await fs.createReadStream(downloadPath)
		.pipe(unzipper.Extract({ path: outputPath }))
		.promise();

	fs.unlinkSync(downloadPath);

	const filePath = `${outputPath}/${(await listSrtFiles(outputPath))[0]}`;

	const file = path.join(process.cwd(), filePath);
	const data = fs.readFileSync(file, 'utf8');

	const { subtitle } = convert(data, '.vtt', { removeTextFormatting: true });

	fs.rmSync(outputPath, { recursive: true, force: true });

	return subtitle;
}

export default downloadAndUnzip;