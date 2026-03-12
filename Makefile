SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

E2E_SUPABASE_WORKDIR ?= testing/supabase-e2e
E2E_SEED_DIR ?= testing/supabase-e2e/supabase/storage-seed
E2E_BUCKET ?= subtitles
INGEST_CONFIG ?= $(CURDIR)/cli/config/sources.json
INGEST_WORKSPACE_ROOT ?= /tmp/kcontext_ingest_runs
INGEST_MAX_SOURCES ?= 999
SYNC_STATE_DB ?= $(CURDIR)/cli/.state/remote_sync.sqlite
SYNC_BATCH_SIZE ?= 20
SYNC_MAX_VIDEOS ?= 200
SYNC_DRY_RUN ?= 0

.PHONY: \
	e2e-up \
	e2e-reset \
	e2e-smoke \
	e2e-real \
	e2e-down \
	ingest-local \
	sync-remote \
	sync-all \
	sync-status

e2e-up:
	supabase start --workdir "$(E2E_SUPABASE_WORKDIR)" --exclude logflare,imgproxy,vector,supavisor

e2e-reset: e2e-up
	supabase db reset --workdir "$(E2E_SUPABASE_WORKDIR)" --yes
	./scripts/reset-e2e-storage.sh \
		--workdir "$(E2E_SUPABASE_WORKDIR)" \
		--seed-dir "$(E2E_SEED_DIR)" \
		--bucket "$(E2E_BUCKET)"
	@status_env="$$(supabase status --workdir "$(E2E_SUPABASE_WORKDIR)" -o env)"; \
		api_url="$$(echo "$$status_env" | awk -F= '$$1=="API_URL"{print $$2}' | sed 's/^"//; s/"$$//')"; \
		anon_key="$$(echo "$$status_env" | awk -F= '$$1=="ANON_KEY"{print $$2}' | sed 's/^"//; s/"$$//')"; \
		video_count="$$(curl --fail --silent --show-error \
			"$${api_url}/rest/v1/video?select=id&id=like.test_%" \
			-H "apikey: $${anon_key}" \
			-H "Authorization: Bearer $${anon_key}" \
			-H "Content-Type: application/json" | \
			python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')"; \
		if [[ "$$video_count" != "3" ]]; then \
			echo "Expected 3 seeded test videos, got $$video_count" >&2; \
			exit 1; \
		fi

e2e-smoke: e2e-reset
	@status_env="$$(supabase status --workdir "$(E2E_SUPABASE_WORKDIR)" -o env)"; \
		eval "$$(echo "$$status_env" | grep -E '^[A-Z0-9_]+=')"; \
		export NEXT_PUBLIC_SUPABASE_URL="$$API_URL"; \
		export NEXT_PUBLIC_SUPABASE_ANON_KEY="$$ANON_KEY"; \
		export NEXT_PUBLIC_CDN_URL="$$API_URL/storage/v1/object/public"; \
		export PLAYWRIGHT_BASE_URL="http://localhost:3100"; \
		export CI="true"; \
		pnpm -C web test:e2e:smoke

e2e-real:
	./scripts/integration-test.sh

e2e-down:
	supabase stop --workdir "$(E2E_SUPABASE_WORKDIR)" --no-backup || true

ingest-local:
	./scripts/run-local-ingest.sh \
		--config "$(INGEST_CONFIG)" \
		--workspace-root "$(INGEST_WORKSPACE_ROOT)" \
		--max-sources "$(INGEST_MAX_SOURCES)" \
		--continue-on-error

sync-remote:
	@dry_flag=""; \
		if [[ "$(SYNC_DRY_RUN)" == "1" ]]; then \
			dry_flag="--dry-run"; \
		fi; \
		./scripts/run-remote-sync.sh \
			--state-db "$(SYNC_STATE_DB)" \
			--batch-size "$(SYNC_BATCH_SIZE)" \
			--max-videos "$(SYNC_MAX_VIDEOS)" \
			$$dry_flag

sync-all: ingest-local sync-remote

sync-status:
	./scripts/run-remote-sync.sh \
		--state-db "$(SYNC_STATE_DB)" \
		--status
