import type { AddonInterface } from "stremio-addon-sdk"

import express from 'express';
import fs from 'fs';
import path from 'path';
import landingTemplate from 'stremio-addon-sdk/src/landingTemplate';
import crypto from 'crypto';

// @ts-ignore
import getRouter from 'stremio-addon-sdk/src/getRouter';

// @ts-ignore
import opn from 'opn';
import downloadAndUnzip from "./downloader";

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1';
const PORT = process.env.PORT ?? 3010;

function serveHTTP(addonInterface: AddonInterface, options: {
	port?: number | undefined;
	/**
	 * (in seconds) cacheMaxAge means the Cache-Control header being set to max-age=$cacheMaxAge
	 */
	cacheMaxAge?: number | undefined;
	/**
	 * Static directory to serve.
	 */
	static?: string | undefined;
}) {
	if (addonInterface.constructor.name !== 'AddonInterface') {
		throw new Error('first argument must be an instance of AddonInterface')
	}

	const cacheMaxAge = options.cacheMaxAge ?? 60 * 60;

	if (cacheMaxAge > 365 * 24 * 60 * 60)
		console.warn('cacheMaxAge set to more then 1 year, be advised that cache times are in seconds, not milliseconds.')

	const app = express()
	app.use((_: any, res: { getHeader: (arg0: string) => any; setHeader: (arg0: string, arg1: string) => void }, next: () => void) => {
		if (cacheMaxAge && !res.getHeader('Cache-Control'))
			res.setHeader('Cache-Control', 'max-age=' + cacheMaxAge + ', public')
		next()
	})
	app.use(getRouter(addonInterface))

	// serve static dir
	if (options.static) {
		const location = path.join(process.cwd(), options.static)
		if (!fs.existsSync(location)) throw new Error('directory to serve does not exist')
		app.use(options.static, express.static(location))
	}

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
			if (req?.query?.from) url = req.query.from as string

			res.setHeader('Content-Type', 'text/vtt;charset=UTF-8');

			if (url) {
				console.log('trying to download', url);
				const hash = generateHash(url);
				const data = await downloadAndUnzip(url as string, `./files/${hash}.zip`, `./files/${hash}`)
				res.send(data);
			}

			res.end()

		} catch (err) {
			res.setHeader('Content-Type', 'application/json');
			res.end()

			console.error(err);
		}
	})

	if (hasConfig)
		app.get('/configure', (_: any, res: { setHeader: (arg0: string, arg1: string) => void; end: (arg0: any) => void }) => {
			res.setHeader('content-type', 'text/html')
			res.end(landingHTML)
		})

	const server = app.listen(options.port)
	return new Promise(function (resolve, reject) {
		server.on('listening', function () {
			const url = `${BASE_URL}:${PORT}/manifest.json`
			console.log('HTTP addon accessible at:', url)
			if (process.argv.includes('--launch')) {
				const base = 'https://staging.strem.io#'
				//const base = 'https://app.strem.io/shell-v4.4#'
				const installUrl = `${base}?addonOpen=${encodeURIComponent(url)}`
				opn(installUrl)
			}
			if (process.argv.includes('--install')) {
				opn(url.replace('http://', 'stremio://'))
			}
			resolve({ url, server })
		})
		server.on('error', reject)
	})
}

function generateHash(inputString: string, algorithm = 'sha256') {
	return crypto
		.createHash(algorithm)
		.update(inputString)
		.digest('hex');
}

export default serveHTTP;