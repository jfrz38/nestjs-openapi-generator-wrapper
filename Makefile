# Paths
CODE_PATH=$(CURDIR)/wrapper

.PHONY: help
help: ## show make targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {sub("\\\\n",sprintf("\n%22c"," "), $$2);printf " \033[36m%-20s\033[0m  %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## install project dependencies
	cd $(CODE_PATH) && pnpm install

.PHONY: build
build: ## compile the wrapper package
	cd $(CODE_PATH) && pnpm run build

.PHONY: test
test: ## run unit tests in the wrapper
	cd $(CODE_PATH) && pnpm exec jest --runInBand

.PHONY: test-integration
test-integration: ## run integration tests against example OpenAPI input
	cd $(CODE_PATH) && RUN_OPENAPI_INTEGRATION=true pnpm exec jest tests/integration/api-template.integration.spec.ts --runInBand

.PHONY: test-integration-keep
test-integration-keep: ## run integration test and preserve generated output
	cd $(CODE_PATH) && RUN_OPENAPI_INTEGRATION=true KEEP_OPENAPI_INTEGRATION_OUTPUT=true pnpm exec jest tests/integration/api-template.integration.spec.ts --runInBand

.PHONY: generate-example
generate-example: ## build the wrapper and generate example client code
	cd $(CODE_PATH) && pnpm run build && node ./dist/src/bin/generate.js -i ../example/openapi.yml -o ../example/generated

.PHONY: clean-example-generated 
clean-example-generated: ## remove generated example output
	rm -rf example/generated
