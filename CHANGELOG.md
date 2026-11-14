# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- git-cliff: end of header -->
## [Unreleased]


### Added
- Safely replace generated output
- Enforce generated controller contracts


### Fixed
- Correct package distribution
- Pin OpenAPI Generator configuration
- Normalize Windows spec paths
- Enforce generated DTO validation
- Generate SWC-compatible UUID types
- Support NestJS 12 ESM integration


### Changed
- Bump version to 1.2.0

## [1.1.9] - 2026-08-24


### Changed
- Bump version to 1.1.9

## [1.1.8] - 2026-05-19


### Added
- Add bump version action
- Add cooldown for dependency updates

Added cooldown period of 7 days for npm and GitHub Actions updates.
- Add pull request types to workflow trigger


### Changed
- [iss-68] remove optional request and response generation
- [iss-68] upgrade node version
- [iss-68] fix tests removing optional req and res
- Bump version to 1.1.8

## [1.1.7] - 2026-04-25


### Added
- Add tests
- Add workflow and url to package.json
- Add copyfiles dependency to copy templates
- Add provenance to npm publish
- Add dependency groups to dependabot configuration
- Add commands comments
- Add GitHub Actions to Dependabot configuration
- Add IT tests
- Add code quality
- Add workflow_dispatch trigger for integration tests
- Add develop branch to pull request triggers


### Fixed
- Fix default config generation
- Fix folder remove when clean output flag exist
- Fix package.json repo name
- Fix document example
- Fix tests compiler options
- Fix tests
- Fix path separator int test


### Changed
- Initial commit
- Update README.md
- Generate files from openapi generator cli
- Update action node version and bin name
- Update package lock
- Update index path
- Update Github action
- Uses GitHub packages
- Update workflow to run on push to master
- Use command instead of program to read cli
- Update workflow to generate package
- Restore workflow to generate package on release published
- Update workflow to generate package
- Recover workflow to package on release
- [iss-11] Add CODEOWNERS
- [iss-11] Upgrade actions version
- [iss-11] Add workflow to protect branches
- [iss-7] create readme and documentation
- [iss-7] update  readme
- [iss-6] update gitignore
- [iss-6] create workflow to publish to npm
- [iss-6] improve workflow
- [iss-6] add working directory
- [iss-6] add manually workflow dispatch
- [iss-6] update workflow
- [iss-6] add --provenance flag when publish
- [iss-6] remove --provenance flag when publish
- Update readme to add in npm publish
- Update readme
- Replace CODEOWNERS file
- [iss-16] Add deploy to npm on push to main
- [iss-19] remove caret
- [iss-19] upgrade dependency versions
- Update action versions
- Configure Dependabot for npm updates in /wrapper

Updated Dependabot configuration to target npm packages in the /wrapper directory with a monthly update schedule.
- Update version
- [iss-5] Add clean output flag
- [iss-5] Improve flag default values
- [iss-5] Improve clean output flag definition
- Upgrade version from 1.0.4 to 1.1.0
- Format code
- Update dependencies adding class-validator as peer dependency
- Update readme
- Update example readme
- Update publish workflow
- Update node version to 24
- Update to version 1.1.1
- Update to version 1.1.1
- Update publish action
- Update publish action
- Update publish action fixing package.json repo name
- Update publish action
- Update npm publish action
- Upgrade version
- Enhance README badges for visibility and tracking

Updated badge links in README for better visibility and added NPM downloads badge.
- Upgrade patch version
- [iss-46] fix type import
- [iss-46] improve readme
- [iss-46] improve uuid import
- [iss-46] update examples
- [iss-46] allow enum type
- [iss-46] fix single quote example
- [iss-46] create IT tests
- [iss-46] create makefile
- [iss-46] upgrade version
- [iss-46] use make in workflows
- [hotfix] fix enum generator removing namespaces
- [hotfix] update readme
- [iss-50] migrate to pnpm
- [iss-50] lock dependency version
- [hotfix] fix oneOf type export
- Improve npmrc file
- Improve readme
- Upgrade patch version
- Potential fix for code scanning alert no. 13: Workflow does not contain permissions

Co-authored-by: Copilot Autofix powered by AI <62310815+github-advanced-security[bot]@users.noreply.github.com>
- Potential fix for code scanning alert no. 6: Unsafe shell command constructed from library input

Co-authored-by: Copilot Autofix powered by AI <62310815+github-advanced-security[bot]@users.noreply.github.com>
- Improve tests
- Upgrade version
- Update pnpm lock file
- Use generator cli
- Improve release and publish flow


### Removed
- Remove duplicate CODEOWNERS
- Remove redundant build job
- Remove shell command
- Remove unused internal publish action
