// Image URLs for the bitmap art in ./img (see art-images.gen.js). The site build
// serves them as files next to the page, so the browser only fetches the art that
// is drawn and caches it; build.mjs swaps this module for inlined data URIs when
// it writes the single-file artifact page.
import { IMAGE_FILES } from './art-images.gen.js';

export const IMAGES = IMAGE_FILES.map((f) => 'art/' + f);
