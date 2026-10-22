/**
 * Builds the index page of the outdated packages reports.
 *
 * Usage: node build_index.mjs <site dir> <liferay-portal dir> [failed report...]
 */

import {execFileSync} from 'child_process';
import fs from 'fs';
import path from 'path';

const [siteDir, liferayPortalDir, ...failedReports] = process.argv.slice(2);

const commit = execFileSync('git', ['-C', liferayPortalDir, 'rev-parse', 'HEAD'], {
	encoding: 'utf8',
}).trim();

const getOwners = readCodeowners(liferayPortalDir);

const reports = fs
	.readdirSync(siteDir)
	.filter((file) => file.endsWith('.html') && file !== 'index.html')
	.map((file) => {
		const html = fs.readFileSync(path.join(siteDir, file), 'utf8');

		const match = html.match(
			/<script type="application\/json" id="data">([\s\S]*?)<\/script>/
		);

		const data = JSON.parse(match[1]);

		const outdatedNodes = data.outdated.map((entry) => data.nodes[entry.node]);

		return {
			duplicates: outdatedNodes.filter((node) => node.duplicateOf).length,
			file,
			majors: outdatedNodes.filter((node) => node.diff === 'major').length,
			name: file.replace(/\.html$/, ''),
			owners:
				file === 'modules.html'
					? null
					: getOwners(`workspaces/${file.replace(/\.html$/, '')}`),
			outdated: outdatedNodes.length,
			packages: data.packageCount,
			roots: data.roots.length,
		};
	})
	.sort((a, b) => {
		if (a.name === 'modules') {
			return -1;
		}

		if (b.name === 'modules') {
			return 1;
		}

		return a.name.localeCompare(b.name);
	});

const escape = (text) =>
	String(text).replace(
		/[&<>"]/g,
		(character) =>
			({'"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;'})[character]
	);

// modules is shared by every team, and a workspace that CODEOWNERS does not
// list has no owner

function describeOwners(owners) {
	if (!owners) {
		return '';
	}

	return owners.length
		? owners.map(escape).join(', ')
		: '<span class="muted">unowned</span>';
}

/**
 * Reads .github/CODEOWNERS, which maps repository paths (no globs) to teams,
 * and returns a function that gives the owners of a path from its most
 * specific listed ancestor.
 */
function readCodeowners(repositoryDir) {
	const owners = new Map();

	const content = fs.readFileSync(
		path.join(repositoryDir, '.github', 'CODEOWNERS'),
		'utf8'
	);

	for (const line of content.split(/\r?\n/)) {
		const [pattern, ...teams] = line.trim().split(/\s+/);

		if (pattern && !pattern.startsWith('#')) {
			owners.set(pattern.replace(/^\/|\/$/g, ''), teams);
		}
	}

	return (relativePath) => {
		while (relativePath) {
			if (owners.has(relativePath)) {
				return owners.get(relativePath);
			}

			relativePath = relativePath.substring(
				0,
				Math.max(relativePath.lastIndexOf('/'), 0)
			);
		}

		return [];
	};
}

const rows = reports
	.map(
		(report) => `<tr>
<td><a href="${escape(report.file)}">${escape(report.name)}</a></td>
<td>${describeOwners(report.owners)}</td>
<td class="number">${report.packages}</td>
<td class="number">${report.outdated}</td>
<td class="number">${report.majors}</td>
<td class="number">${report.duplicates}</td>
<td class="number">${report.roots}</td>
</tr>`
	)
	.join('\n');

const failed = failedReports.length
	? `<p class="failed">Unable to generate the reports of ${failedReports.map(escape).join(', ')}.</p>`
	: '';

fs.writeFileSync(
	path.join(siteDir, 'index.html'),
	`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Outdated Packages Reports</title>
<style>
:root {
	--bg: #fff;
	--fg: #1c1c24;
	--muted: #6b6c7e;
	--border: #e7e7ed;
	--row: #f7f8f9;
	--link: #0b5fff;
	--failed: #da1414;
	color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
	:root {
		--bg: #18191d;
		--fg: #e7e7ed;
		--muted: #a7a9bc;
		--border: #33353d;
		--row: #212227;
		--link: #6ea8ff;
		--failed: #ff6b6b;
	}
}

body {
	background: var(--bg);
	color: var(--fg);
	font: 14px/1.5 system-ui, sans-serif;
	margin: 0 auto;
	max-width: 1000px;
	padding: 0 16px 24px;
}

h1 {
	font-size: 22px;
	margin: 24px 0 4px;
}

p {
	color: var(--muted);
}

.failed {
	color: var(--failed);
}

.table-wrapper {
	overflow-x: auto;
}

table {
	border-collapse: collapse;
	width: 100%;
}

th, td {
	border-bottom: 1px solid var(--border);
	padding: 6px 8px;
	text-align: left;
}

tbody tr:nth-child(odd) {
	background: var(--row);
}

.muted {
	color: var(--muted);
}

.number {
	text-align: right;
}

a {
	color: var(--link);
}
</style>
</head>
<body>
<h1>Outdated Packages Reports</h1>
<p>Generated ${escape(new Date().toISOString().replace('T', ' ').replace(/\..*/, ''))} UTC from <a href="https://github.com/liferay/liferay-portal/tree/${commit}">liferay/liferay-portal@${commit.substring(0, 12)}</a>, one report per <code>yarn.lock</code>.</p>
${failed}
<div class="table-wrapper">
<table>
<thead>
<tr>
<th>Lockfile</th>
<th>Team</th>
<th class="number">Locked packages</th>
<th class="number">Outdated</th>
<th class="number">Major behind</th>
<th class="number">Duplicates</th>
<th class="number">Top-level dependencies involved</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</div>
</body>
</html>
`
);
