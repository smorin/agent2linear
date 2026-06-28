# Project shortcuts for local development.

alias link-local := install-symlink
alias unlink-local := uninstall-symlink

@default:
    just --list --unsorted

build:
    npm run build:task

dev:
    npm run dev:task

install-symlink: build
    npm link

uninstall-symlink:
    npm unlink -g agent2linear
