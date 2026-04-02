# Paths
CODE_PATH=$(CURDIR)/wrapper

.PHONY: help
help: ## show make targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {sub("\\\\n",sprintf("\n%22c"," "), $$2);printf " \033[36m%-20s\033[0m  %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install:
	cd $(CODE_PATH) && pnpm install

.PHONY: build
build:
	cd $(CODE_PATH) && pnpm run build

.PHONY: test
test:
	cd $(CODE_PATH) && pnpm exec jest --runInBand

.PHONY: test-integration
test-integration:
	cd $(CODE_PATH) && RUN_OPENAPI_INTEGRATION=true pnpm exec jest tests/integration/api-template.integration.spec.ts --runInBand

.PHONY: test-integration-keep
test-integration-keep:
	cd $(CODE_PATH) && RUN_OPENAPI_INTEGRATION=true KEEP_OPENAPI_INTEGRATION_OUTPUT=true pnpm exec jest tests/integration/api-template.integration.spec.ts --runInBand

.PHONY: generate-example
generate-example:
	cd $(CODE_PATH) && pnpm run build && node ./dist/src/bin/generate.js -i ../example/openapi.yml -o ../example/generated

.PHONY: clean-example-generated 
clean-example-generated:
	rm -rf example/generated
