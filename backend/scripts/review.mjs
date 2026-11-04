import {readFileSync} from 'node:fs';
import {qualityReview} from '../src/quality.js';
const file=process.argv[2];if(!file||!file.endsWith('.json'))throw Error('Provide an explicit debate JSON file; no env files accepted');
const bytes=readFileSync(file);if(bytes.length>65536)throw Error('Debate exceeds bounded review input');
const value=JSON.parse(bytes);if(!Array.isArray(value.messages)||!value.summary)throw Error('Expected messages and summary');
console.log(JSON.stringify(qualityReview(value),null,2));
