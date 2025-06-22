BAKSUFX ?=

projdir != basename "$$PWD"
bakdir  := ../.backup/$(projdir)

backup: suffix := $(if $(value BAKSUFX),_$(BAKSUFX),)
backup: f      := $(shell date "+%Y-%m-%d_%H.%M.%S")$(suffix).tgz
backup:
	@[ -d "$(bakdir)" ] || { echo no dir "$(bakdir)"; exit 1; }
	gtar czf "$(bakdir)/$f" --exclude-ignore=.backupignore -C .. "$(projdir)"
	@echo '\ncreated archive:' && ls -lh "$(bakdir)/$f"
