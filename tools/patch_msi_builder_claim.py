from pathlib import Path

path = Path('/home/ubuntu/monitoring-platform-dash/backend/go/internal/api/msi_builder.go')
text = path.read_text()
needle = '&job.ID, &job.OrganizationID, &job.AgentVersion, &job.SignMode, &job.AutomaticEnrollment, &job.Status, &errMessage,'
replacement = '&job.ID, &job.OrganizationID, &job.AgentVersion, &job.SignMode, &job.AutomaticEnrollment, &job.Status,\n\t\t\t&bootstrapAPIBaseURL, &bootstrapEndpointID, &bootstrapEnrollmentToken, &errMessage,'
count = text.count(needle)
if count != 3:
    raise SystemExit(f'expected three scanner occurrences before targeted replacement, found {count}')
first = text.find(needle)
text = text[:first] + replacement + text[first + len(needle):]
path.write_text(text)
print('patched first scanner occurrence; remaining occurrences:', text.count(needle))
