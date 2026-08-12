package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
)

type Migrator struct {
	db          *sql.DB
	migrationsDir string
}

func NewMigrator(db *sql.DB, migrationsDir string) *Migrator {
	return &Migrator{
		db:            db,
		migrationsDir: migrationsDir,
	}
}

func (m *Migrator) EnsureSchemaTable() error {
	if m.db == nil {
		return fmt.Errorf("database connection is nil")
	}
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
		);
	`
	_, err := m.db.Exec(query)
	return err
}

func (m *Migrator) Up() error {
	if m.db == nil {
		return fmt.Errorf("database connection is nil")
	}

	if err := m.EnsureSchemaTable(); err != nil {
		return err
	}

	files, err := os.ReadDir(m.migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory %s: %v", m.migrationsDir, err)
	}

	var sqlFiles []string
	for _, f := range files {
		if !f.IsDir() && filepath.Ext(f.Name()) == ".sql" {
			sqlFiles = append(sqlFiles, f.Name())
		}
	}
	sort.Strings(sqlFiles)

	for _, filename := range sqlFiles {
		version := filename
		var exists bool
		err := m.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&exists)
		if err != nil {
			return err
		}

		if exists {
			log.Printf("[Migrator] Migration %s already applied.", version)
			continue
		}

		fullPath := filepath.Join(m.migrationsDir, filename)
		content, err := os.ReadFile(fullPath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %v", fullPath, err)
		}

		log.Printf("[Migrator] Applying migration %s...", version)
		tx, err := m.db.Begin()
		if err != nil {
			return err
		}

		if _, err := tx.Exec(string(content)); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed executing migration %s: %v", version, err)
		}

		if _, err := tx.Exec(`INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed recording migration version %s: %v", version, err)
		}

		if err := tx.Commit(); err != nil {
			return err
		}
		log.Printf("[Migrator] Successfully applied migration %s.", version)
	}

	return nil
}
