package main

import (
	"database/sql"
	"fmt"
	"time"
)

type EndpointModel struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Hostname       string    `json:"hostname"`
	SerialNumber   string    `json:"serial_number"`
	OSVersion      string    `json:"os_version"`
	AgentVersion   string    `json:"agent_version"`
	Status         string    `json:"status"`
	LastSeenAt     time.Time `json:"last_seen_at"`
}

type EndpointRepository struct {
	db *sql.DB
}

func NewEndpointRepository(db *sql.DB) *EndpointRepository {
	return &EndpointRepository{db: db}
}

func (r *EndpointRepository) UpsertEndpoint(e EndpointModel) error {
	if r.db == nil {
		return fmt.Errorf("database connection is nil")
	}

	query := `
		INSERT INTO endpoints (id, organization_id, hostname, serial_number, os_version, agent_version, status, last_seen_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			hostname = EXCLUDED.hostname,
			os_version = EXCLUDED.os_version,
			agent_version = EXCLUDED.agent_version,
			status = EXCLUDED.status,
			last_seen_at = EXCLUDED.last_seen_at
	`
	_, err := r.db.Exec(query, e.ID, e.OrganizationID, e.Hostname, e.SerialNumber, e.OSVersion, e.AgentVersion, e.Status, e.LastSeenAt)
	return err
}

func (r *EndpointRepository) ListEndpoints(orgID string) ([]EndpointModel, error) {
	if r.db == nil {
		return nil, fmt.Errorf("database connection is nil")
	}

	rows, err := r.db.Query(
		`SELECT id, organization_id, hostname, serial_number, os_version, agent_version, status, last_seen_at FROM endpoints WHERE organization_id = $1`,
		orgID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var endpoints []EndpointModel
	for rows.Next() {
		var ep EndpointModel
		if err := rows.Scan(&ep.ID, &ep.OrganizationID, &ep.Hostname, &ep.SerialNumber, &ep.OSVersion, &ep.AgentVersion, &ep.Status, &ep.LastSeenAt); err == nil {
			endpoints = append(endpoints, ep)
		}
	}
	return endpoints, nil
}
