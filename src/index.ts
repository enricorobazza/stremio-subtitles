import app from './app';

// @ts-ignore
import opn from 'opn';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1';
const PORT = process.env.PORT ?? 3010;

const server = app.listen(PORT)

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
})
