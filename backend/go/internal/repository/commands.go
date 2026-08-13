package repository

import (
	"context"
	"database/sql"
	"time"
)

type EndpointCommand struct {
	ID           string    `json:"id"`
	OrganizationID string  `json:"organization_id"`
	EndpointID   string    `json:"endpoint_id"`
	CommandType  string    `json:"command_type"` // e.g., "QUARANTINE", "ISOLATE", "REBOOT"
	Payload      string    `json:"payload"`
	Status       string    `json:"status"` // "PENDING", "ACKNOWLEDGED", "COMPLETED", "FAILED"
	IssuedBy     string    `json:"issued_by"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func CreateEndpointCommand(ctx context.Context, db *sql.DB, orgID, endpointID, cmdType, payload, issuedBy string) (*EndpointCommand, error) {
	cmdID := "cmd_" + time.Now().Format("20060102150405") + "_" + endpointID[:min(8, len(endpointID))]
	now := time.Now()

	query := `
		INSERT INTO endpoint_commands (id, organization_id, endpoint_id, command_type, payload, status, issued_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, $8)
	`
	_, err := db.ExecContext(ctx, query, cmdID, orgID, endpointID, cmdType, payload, issuedBy, now, now)
	if err != nil {
		return nil, err
	}

	return &EndpointCommand{
		ID:             cmdID,
		OrganizationID: orgID,
		EndpointID:     endpointID,
		CommandType:    cmdType,
		Payload:        payload,
		Status:         "PENDING",
		IssuedBy:       issuedBy,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
