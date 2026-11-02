# Changelog

All significant changes to this project are documented in this file.

## 2026-11-01

### Added

- Added an endpoint for users to list their upcoming bookings, including service and professional details.
- Added an integration guide for the frontend team.

### Changed

- Extended working hours for slot generation until 18:00.

### Fixed

- Fixed JWT verification rejecting real tokens: the user identifier is now read from the `id` claim issued by the Users API.

## 2026-10-30

### Added

- Added project README with setup, endpoints, data model and documented flows.
- Added CLAUDE.md with project context and working conventions.
- Added JWT authentication and role-based authorization middleware.
- Added request validation and centralized error handling.
- Added appointment booking, modification and cancellation endpoints for authenticated users.
- Added professional registration for administrators, validated against the Users API.
- Added optional date, professional and service filters to the available slots listing.
- Added database constraints for slot states, duplicate slots and duplicate professionals.

### Changed

- Slot generation now requires an administrator JWT.
- Generated slots no longer carry a service; the service is assigned when the slot is booked, as defined in the data model.
- User identifiers are now stored as text, to match the MongoDB identifiers of the Users API.
- Professionals are now linked to their Users API account through `usuario_id`.
- Renamed the misspelled professional specialty column to `especialidad`.
- Booking modifications run in a single database transaction, so a failure never leaves a user with two slots.
- The available slots listing and bookings exclude slots from past dates.

### Removed

- Removed test services (those not lasting 60 minutes) and their professional assignments.

### Fixed

- Fixed slot generation creating overlapping slots for the same professional when generating for different services on the same date.

### Security

- Unhandled errors no longer expose internal details to clients.
