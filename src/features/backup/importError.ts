export type ImportErrorCode = 'notJson' | 'notBackup' | 'unsupportedVersion' | 'invalidRecord'

/**
 * Why a backup file was refused. Lives in its own file so importJson and
 * migrateBackup can both use it without importing each other.
 */
export class ImportError extends Error {
  readonly code: ImportErrorCode

  constructor(code: ImportErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.code = code
  }
}
