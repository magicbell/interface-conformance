#! /usr/bin/env tsx

import { Readable, Stream } from 'stream';
import { finished } from 'stream/promises';
import { ReadableStream } from 'stream/web';
import * as tar from 'tar';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseSignature, InterfaceMethod } from '../src/lib/parse-signature';

function streamToString(stream: Stream): Promise<string> {
  return new Promise((resolve, reject) => {
      let data = '';
      stream.on('data', (chunk) => data += chunk);
      stream.on('end', () => resolve(data));
      stream.on('error', (err) => reject(err));
  });
}

const InterfaceRegexp = /type\s+([A-Z]\w*)\s+interface\s*{([^}]*)}/g;

function raise(message: string): never;
function raise(condition: any, message: string): asserts condition;
function raise(messageOrCondition: any, message?: string): asserts messageOrCondition {
	if (!message) {
		throw new Error(String(messageOrCondition));
	}

	if (!messageOrCondition) {
		throw new Error(message);
	}

	return;
}


async function fetchAndExtract(url: string) {
	const response = await fetch(url);

	raise(response.ok, `Failed to fetch the archive: ${response.status} ${response.statusText}`);
	raise(response.body, 'Response has no body');

  const results: Array<InterfaceMethod> = [];

	const extract = tar.list({
    onentry: async (entry) => {
      // first slice is ref like `go-go1.20.12/` or `go-master/`
      const [root, ...segments] = entry.path.split('/').slice(1); 

      // ignore files outside of /src folder
      if (!segments.length || root !== 'src') return;
      // ignore some directories
      if (['testdata', 'cmd', 'vendor', 'internal', 'test'].some((segment) => segments.includes(segment))) return;
      
    
      // ignore some file patterns
      const filename = segments[segments.length - 1];
      if (!filename.endsWith('.go')) return;
      if (filename === 'doc.go') return;
      if (filename.endsWith('_test.go')) return;

      const contents = await streamToString(entry);
      const pkg = segments.slice(0, -1).join('/');

      let match;
      while ((match = InterfaceRegexp.exec(contents)) !== null) {
        const iface = match[1];
        
        const methods = match[2].trim().split('\n')
          .map(x => x.trim())
          .filter(line => line.length > 0) // empty lines
          .filter(line => !line.startsWith('//')) // comments
          .map(line => line.split('//')[0].trim()) // remove comments

        for (const signature of methods) {
          const method = parseSignature(signature);
          if (!method.name) continue;
          if (!method.params.length) continue;

          results.push({ 
            package: pkg, 
            interface: iface, 
            ...method,
           });
        }      
      }

    }
	});

	const stream = Readable.fromWeb(response.body as ReadableStream<any>);
	stream.pipe(extract);

	await finished(stream);

  return results;
}

async function main(version: string, outfile: string) {
  raise(version, 'Version is required');
  raise(outfile, 'Outfile is required');

  const source = version === 'HEAD' 
    ? `https://github.com/golang/go/archive/refs/heads/master.tar.gz` 
    : `https://github.com/golang/go/archive/refs/tags/go${version}.tar.gz`;

  const methods = await fetchAndExtract(source);
  await fs.mkdir(path.dirname(outfile), { recursive: true });
  await fs.writeFile(outfile, JSON.stringify(methods, null, 2));
}

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .example('$0 --version 1.17.1', 'Fetch interfaces from the Go 1.17.1 release')
  .example('$0 --version HEAD', 'Fetch interfaces from the latest commit on master')
  .example('$0 --version 1.17.1 --outfile ./go-interfaces.json', 'Fetch interfaces from the Go 1.17.1 release and write them to ./go-interfaces.json')
	.version(false)
  .option('version', { description: 'The version of Go to fetch interfaces from', type: 'string', default: 'HEAD' })
	.option('outfile', { description: 'The file to write the interfaces to', type: 'string', default: './go-interfaces.json' })
  .parseSync();

main(argv.version, argv.outfile)
  .then(() => {
    console.log(`Interfaces for ${argv.version} written to ${argv.outfile}`);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
