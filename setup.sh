#!/bin/bash
set -euo pipefail

# CSYE6225 A03 - Server Bootstrap Script (Ubuntu 24.04)
# - Installs required packages
# - Installs & enables PostgreSQL
# - Creates application DB + DB user
# - Creates Linux system group + non-login user
# - Creates /opt/csye6225 with correct ownership/permissions
#
# Idempotent: safe to run multiple times.

APP_DIR="/opt/csye6225"
APP_GROUP="csye6225"
APP_USER="csye6225"

DB_NAME="${DB_NAME:-webapp}"
DB_USER="${DB_USER:-webappuser}"
DB_PASSWORD="${DB_PASSWORD:-}"

log() { echo "[setup.sh] $*"; }

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "ERROR: Please run as root (use sudo)."
    exit 1
  fi
}

install_packages() {
  log "Updating apt indexes..."
  apt-get update -y

  log "Upgrading installed packages..."
  DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

  log "Installing base packages..."
  apt-get install -y curl unzip ca-certificates gnupg lsb-release

  log "Installing PostgreSQL..."
  apt-get install -y postgresql postgresql-contrib
}

enable_postgres() {
  log "Enabling and starting PostgreSQL..."
  systemctl enable postgresql
  systemctl start postgresql
  systemctl status postgresql --no-pager >/dev/null || true
}

create_group_user() {
  log "Ensuring Linux group '${APP_GROUP}' exists..."
  if ! getent group "${APP_GROUP}" >/dev/null; then
    groupadd --system "${APP_GROUP}"
  fi

  log "Ensuring Linux user '${APP_USER}' exists..."
  if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin --gid "${APP_GROUP}" "${APP_USER}"
  fi
}

create_app_dir() {
  log "Ensuring ${APP_DIR} exists with correct ownership/permissions..."
  mkdir -p "${APP_DIR}"
  chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
  chmod 750 "${APP_DIR}"
}

create_db_and_user() {
  log "Ensuring database '${DB_NAME}' and user '${DB_USER}' exist..."

  # Create DB user if missing
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
    if [[ -z "${DB_PASSWORD}" ]]; then
      log "No DB_PASSWORD provided. Creating DB user '${DB_USER}' WITHOUT a password (local auth only)."
      sudo -u postgres psql -c "CREATE USER ${DB_USER};"
    else
      sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
    fi
  else
    log "DB user '${DB_USER}' already exists."
  fi

  # Create DB if missing (owned by DB_USER)
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  else
    log "Database '${DB_NAME}' already exists."
  fi

  # Ensure privileges
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null || true
}

main() {
  need_root
  install_packages
  enable_postgres
  create_group_user
  create_app_dir
  create_db_and_user

  log "DONE."
  log "Next: place your app zip into ${APP_DIR} (or copy repo there) and run npm install/build as needed."
}

main "$@"