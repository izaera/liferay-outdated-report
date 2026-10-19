#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

#
# Generates an outdated packages report for liferay-portal's modules directory
# and for every workspace with its own yarn.lock, plus an index page.
#
# Usage: generate_reports.sh <liferay-portal dir> <node-scripts dir> <site dir>
#

function generate_report {
	local lock_dir=${1}
	local name=${2}

	echo "Generating the report of ${name}."

	mkdir -p "${lock_dir}/build/node-scripts/report-outdated"

	ln -fns "${REGISTRY_CACHE_DIR}" "${lock_dir}/build/node-scripts/report-outdated/registry"

	if ! (cd "${lock_dir}" && node "${NODE_SCRIPTS_DIR}/bin.js" report:outdated "--output=${SITE_DIR}/${name}.html")
	then
		echo "Unable to generate the report of ${name}."

		FAILED_REPORTS+=("${name}")
	fi
}

function install_dependencies {

	#
	# The report only needs these packages, so install the versions that
	# node-scripts declares instead of its whole dependency tree.
	#

	local dependencies_dir

	dependencies_dir=$(mktemp -d)

	local package

	local packages=()

	for package in execa fast-glob semver
	do
		packages+=("${package}@$(node --print "require('${NODE_SCRIPTS_DIR}/package.json').dependencies['${package}']")")
	done

	npm install --no-audit --no-fund --no-package-lock --prefix "${dependencies_dir}" "${packages[@]}"

	ln -fns "${dependencies_dir}/node_modules" "${NODE_SCRIPTS_DIR}/node_modules"
}

function main {
	if [[ ${#} -ne 3 ]]
	then
		echo "Usage: ${0} <liferay-portal dir> <node-scripts dir> <site dir>"

		exit 1
	fi

	LIFERAY_PORTAL_DIR=$(realpath "${1}")
	NODE_SCRIPTS_DIR=$(realpath "${2}")

	mkdir -p "${3}"

	SITE_DIR=$(realpath "${3}")

	FAILED_REPORTS=()
	REGISTRY_CACHE_DIR=$(mktemp -d)

	install_dependencies

	generate_report "${LIFERAY_PORTAL_DIR}/modules" "modules"

	local lock_file

	for lock_file in "${LIFERAY_PORTAL_DIR}"/workspaces/*/yarn.lock
	do
		local workspace_dir

		workspace_dir=$(dirname "${lock_file}")

		if [[ -f ${workspace_dir}/package.json ]]
		then
			generate_report "${workspace_dir}" "$(basename "${workspace_dir}")"
		fi
	done

	node "$(dirname "${0}")/build_index.mjs" "${SITE_DIR}" "${LIFERAY_PORTAL_DIR}" "${FAILED_REPORTS[@]}"

	if [[ ${#FAILED_REPORTS[@]} -gt 0 ]]
	then
		echo "Unable to generate ${#FAILED_REPORTS[@]} reports: ${FAILED_REPORTS[*]}."
	fi
}

main "${@}"
