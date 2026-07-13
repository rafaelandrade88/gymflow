// Fonte única de versão — lida do package.json em build time.
import pkg from '../package.json';

export const APP_VERSION: string = pkg.version;
