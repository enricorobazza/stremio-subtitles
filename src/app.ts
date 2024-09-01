import express from 'express';
import landingTemplate from 'stremio-addon-sdk/src/landingTemplate';
import crypto from 'crypto';
import addonInterface from './builder';
import cors from 'cors';
import pino from 'pino';
import os from 'os';
import path from 'path';
const logger = pino();

// @ts-ignore
import getRouter from 'stremio-addon-sdk/src/getRouter';

import { downloadAndUnzip, downloadAndConvert } from "./services/downloader";

function generateHash(inputString: string, algorithm = 'sha256') {
	return crypto
		.createHash(algorithm)
		.update(inputString)
		.digest('hex');
}

if (addonInterface.constructor.name !== 'AddonInterface') {
	throw new Error('first argument must be an instance of AddonInterface')
}

const cacheMaxAge = 60 * 60;

if (cacheMaxAge > 365 * 24 * 60 * 60)
	console.warn('cacheMaxAge set to more then 1 year, be advised that cache times are in seconds, not milliseconds.')

const app = express()
app.use((_: any, res: { getHeader: (arg0: string) => any; setHeader: (arg0: string, arg1: string) => void }, next: () => void) => {
	if (cacheMaxAge && !res.getHeader('Cache-Control'))
		res.setHeader('Cache-Control', 'max-age=' + cacheMaxAge + ', public')
	next()
})
app.use(getRouter(addonInterface))

app.use(cors());

const hasConfig = !!(addonInterface.manifest.config || []).length

// landing page
const landingHTML = landingTemplate(addonInterface.manifest)
app.get('/', (_: any, res: { redirect: (arg0: string) => void; setHeader: (arg0: string, arg1: string) => void; end: (arg0: any) => void }) => {
	if (hasConfig) {
		res.redirect('/configure')
	} else {
		res.setHeader('content-type', 'text/html')
		res.end(landingHTML)
	}
})

app.get('/sub.vtt', async (req, res) => {
	try {
		res.setHeader('Cache-Control', 'max-age=86400,staleRevalidate=stale-while-revalidate, staleError=stale-if-error, public');
		let url: string | undefined;
		let source: string | undefined;
		if (req?.query?.from) url = req.query.from as string
		if (req?.query?.source) {
			source = req.query.source as string
		}
		else {
			source = 'com';
		}

		res.setHeader('Content-Type', 'text/vtt;charset=UTF-8');

		logger.info(`Received request: ${url}`);

		if (url) {
			if (source === 'org') {
				const hash = generateHash(url);
				const tempDir = os.tmpdir();
				const zipLocation = path.join(tempDir, `${hash}.zip`);
				const unzipLocation = path.join(tempDir, `${hash}`);

				const data = await downloadAndUnzip(url as string, zipLocation, unzipLocation)
				res.send(data);
			}
			else {
				const data = await downloadAndConvert(url as string);
				res.send(data);
			}
		}

		res.end()

	} catch (err) {
		logger.error(err);
		res.setHeader('Content-Type', 'application/json');
		res.status(500)
		res.end()
	}
})

if (hasConfig)
	app.get('/configure', (_: any, res: { setHeader: (arg0: string, arg1: string) => void; end: (arg0: any) => void }) => {
		res.setHeader('content-type', 'text/html')
		res.end(landingHTML)
	})

export default app;