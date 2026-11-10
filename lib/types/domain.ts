// =============================================================================
// AEMS Core Domain Types & Enumerations (Blueprint R.02 Bab 14 & Bab 15)
// =============================================================================

export type AppRole = "ACCOUNTING" | "MAINTENANCE" | "ADMIN";

export type EquipmentKind = "WHOLE_UNIT" | "COMPONENT" | "OTHER";

export type AssetStatus = "ACTIVE" | "INACTIVE" | "DISPOSED";

export type EquipmentStatus = "ACTIVE" | "INACTIVE" | "RETIRED";

export type EquipmentCondition =
  | "BAIK"
  | "RUSAK_RINGAN"
  | "RUSAK_BERAT"
  | "DALAM_PERBAIKAN"
  | "TIDAK_DIKETAHUI";

export type MappingStatus = "MAPPED" | "UNMAPPED";

export type ParentKind = "ASSET" | "EQUIPMENT";

export type MappingRequestType = "LINK" | "MOVE" | "UNLINK" | "BATCH";

export type MappingRequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "APPLIED"
  | "FAILED_VALIDATION"
  | "CANCELLED";

export type MappingEventType =
  | "LINK_ASSET"
  | "LINK_EQUIPMENT"
  | "MOVE"
  | "UNLINK"
  | "RETIRE_CLOSE";

export type ImportType = "ASSET_MASTER" | "EQUIPMENT_MASTER" | "MAPPING";

export type ImportBatchStatus =
  | "UPLOADED"
  | "PARSING"
  | "PARSE_FAILED"
  | "VALIDATING"
  | "READY_FOR_REVIEW"
  | "READY"
  | "COMMITTING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED"
  | "CANCELLED";

export type CommitMode = "ATOMIC" | "PARTIAL";

export type DuplicateDecision = "SKIP" | "REPLACE";
export type DuplicateRowDecision = DuplicateDecision;

export type ReconciliationStatus = "OPEN" | "RESOLVED" | "IGNORED";

export type ReportName =
  | "ASSET_EQUIPMENT_MATRIX"
  | "EQUIPMENT_BY_ASSET"
  | "UNMAPPED_EQUIPMENT"
  | "ASSETS_WITHOUT_EQUIPMENT"
  | "EQUIPMENT_BY_LOCATION"
  | "HIERARCHY_LINEAGE"
  | "MAPPING_CHANGE_HISTORY"
  | "RECONCILIATION_SUMMARY";

export interface HierarchyNode {
  id: string;
  type: "ASSET" | "EQUIPMENT";
  code: string;
  name: string;
  kind?: EquipmentKind;
  status: string;
  condition?: EquipmentCondition;
  depth: number;
  specs?: EquipmentSpecItem[];
  children: HierarchyNode[];
}

export type ImportRowMatchStatus =
  | "NEW"
  | "IDENTICAL"
  | "DUPLICATE_DIFF"
  | "DUPLICATE_IN_FILE";

export type ReconciliationFindingType =
  | "INACTIVE_ASSET_ACTIVE_EQUIPMENT"
  | "UNMAPPED_EQUIPMENT"
  | "INACTIVE_PARENT_ACTIVE_CHILD"
  | "SIMILAR_BUSINESS_KEY"
  | "STALE_ROOT_CACHE"
  | "MISSING_FROM_SAP_EXPORT";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole | null;
  is_active: boolean;
  department: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferenceItem {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
}

export interface Asset {
  id: string;
  company_code: string;
  sap_asset_no: string;
  sap_sub_no: string;
  asset_key_norm: string;
  name: string;
  description: string | null;
  asset_category_id: string | null;
  category_name?: string;
  location_id: string | null;
  location_name?: string;
  cost_center: string | null;
  acquisition_date: string | null;
  acquisition_value: number | null;
  currency: string;
  serial_no: string | null;
  manufacturer: string | null;
  model: string | null;
  status: AssetStatus;
  attributes: Record<string, unknown>;
  source_type: string;
  source_batch_id: string | null;
  row_version: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
}

export interface Equipment {
  id: string;
  source_system: string;
  equipment_no: string;
  equipment_key_norm: string;
  kind: EquipmentKind;
  name: string;
  specification: string | null;
  equipment_category_id: string | null;
  category_name?: string;
  manufacturer: string | null;
  model: string | null;
  serial_no: string | null;
  condition: EquipmentCondition;
  location_id: string | null;
  location_name?: string;
  install_date: string | null;
  status: EquipmentStatus;
  root_asset_id: string | null;
  root_asset_no?: string | null;
  root_asset_name?: string | null;
  active_parent_kind?: ParentKind | null;
  active_parent_id?: string | null;
  active_parent_no?: string | null;
  active_parent_name?: string | null;
  depth: number;
  path_ids: string[];
  attributes: Record<string, unknown>;
  source_type: string;
  source_batch_id: string | null;
  row_version: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
}

export interface AssetEquipmentMapping {
  id: string;
  asset_id: string;
  equipment_id: string;
  valid_from: string;
  valid_to: string | null;
  end_reason: string | null;
  change_request_id: string | null;
  created_by: string | null;
  ended_by: string | null;
}

export interface EquipmentRelationship {
  id: string;
  parent_equipment_id: string;
  child_equipment_id: string;
  valid_from: string;
  valid_to: string | null;
  end_reason: string | null;
  change_request_id: string | null;
  created_by: string | null;
  ended_by: string | null;
}

export interface EquipmentActiveParent {
  equipment_id: string;
  parent_kind: ParentKind;
  parent_id: string;
  link_id: string;
}

export interface EquipmentSpecItem {
  id: string;
  asset_id: string | null;
  equipment_id: string | null;
  spec_name: string;
  spec_value: string;
  spec_group: string | null;
  quantity: number;
  serial_no: string | null;
  promoted_equipment_id: string | null;
  promoted_equipment_no?: string | null;
  promoted_at: string | null;
  promoted_by: string | null;
  created_at: string;
  created_by: string | null;
}

export interface MappingChangeItem {
  id: string;
  change_request_id: string;
  equipment_id: string;
  equipment_no: string;
  equipment_name: string;
  action_type: "LINK" | "MOVE" | "UNLINK";
  from_parent_kind: ParentKind | null;
  from_parent_id: string | null;
  from_parent_no: string | null;
  from_root_asset_id: string | null;
  from_root_asset_no: string | null;
  to_parent_kind: ParentKind | null;
  to_parent_id: string | null;
  to_parent_no: string | null;
  to_root_asset_id: string | null;
  to_root_asset_no: string | null;
  descendant_count: number;
  status: "OPEN" | "APPLIED" | "REJECTED" | "FAILED_VALIDATION" | "CANCELLED";
}

export interface MappingChangeRequest {
  id: string;
  request_code: string;
  request_type: MappingRequestType;
  status: MappingRequestStatus;
  requested_by: string;
  requester_name: string;
  requester_role: AppRole;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reason: string;
  review_note: string | null;
  effective_at: string;
  batch_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  items: MappingChangeItem[];
}

export interface MappingHistoryRecord {
  id: string;
  equipment_id: string;
  equipment_no: string;
  equipment_name: string;
  event_type: MappingEventType;
  change_request_id: string | null;
  request_code: string | null;
  from_parent_kind: ParentKind | null;
  from_parent_id: string | null;
  from_parent_no: string | null;
  to_parent_kind: ParentKind | null;
  to_parent_id: string | null;
  to_parent_no: string | null;
  from_asset_id: string | null;
  from_asset_no: string | null;
  to_asset_id: string | null;
  to_asset_no: string | null;
  actor_id: string | null;
  actor_name: string;
  approved_by: string | null;
  approver_name: string | null;
  reason: string | null;
  occurred_at: string;
}

export interface ImportRowRecord {
  id: string;
  batch_id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  mapped_data: Record<string, unknown>;
  key_norm: string;
  display_key: string;
  validation_status: "VALID" | "INVALID";
  errors: Array<{ code: string; field?: string; message: string }>;
  match_status: ImportRowMatchStatus;
  action: "INSERT" | "SKIP" | "REPLACE" | "NONE";
  diff: Record<string, { old: unknown; new: unknown }>;
  base_row_version: number | null;
  result_status:
    | "INSERTED"
    | "REPLACED"
    | "SKIPPED"
    | "FAILED"
    | "CONFLICT"
    | "PENDING_APPROVAL"
    | null;
  result_message: string | null;
}

export interface ImportBatchRecord {
  id: string;
  import_type: ImportType;
  source_type: string;
  file_name: string;
  file_sha256: string;
  idempotency_key: string | null;
  status: ImportBatchStatus;
  commit_mode: CommitMode;
  default_action: DuplicateDecision;
  column_map: Record<string, string>;
  total_count: number;
  new_count: number;
  dup_count: number;
  identical_count: number;
  invalid_count: number;
  inserted_count: number;
  replaced_count: number;
  skipped_count: number;
  failed_count: number;
  uploaded_by: string;
  uploader_name: string;
  uploader_role: AppRole;
  started_at: string;
  finished_at: string | null;
  rows?: ImportRowRecord[];
}

export interface AuditLogRecord {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: AppRole | null;
  entity_type: string;
  entity_id: string | null;
  entity_code?: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[];
  request_id: string;
  ip_address: string;
  user_agent: string;
  import_batch_id: string | null;
}

export interface ReconciliationFinding {
  id: string;
  finding_type: ReconciliationFindingType;
  severity: "HIGH" | "MEDIUM" | "LOW";
  entity_type: "ASSET" | "EQUIPMENT" | "MAPPING";
  entity_id: string;
  entity_code: string;
  entity_name: string;
  description: string;
  details: Record<string, unknown>;
  status: "OPEN" | "RESOLVED" | "IGNORED";
  resolution_note: string | null;
  resolved_by: string | null;
  resolver_name: string | null;
  resolved_at: string | null;
  detected_at: string;
}

export interface AppSettingsConfig {
  hierarchy: {
    max_depth: number;
    require_approval_first_link: boolean;
    maker_checker: boolean;
  };
  normalization: {
    pad_numeric_sap_asset: boolean;
    sap_asset_pad_length: number;
    default_company_code: string;
    default_sub_no: string;
    default_source_system: string;
  };
  imports: {
    max_file_mb: number;
    max_rows: number;
    blank_overwrites: boolean;
  };
  security: {
    maintenance_can_view_financial_values: boolean;
    audit_retention_years: number;
  };
}

export interface EquipmentTreeNode {
  id: string;
  equipment_no: string;
  name: string;
  kind: EquipmentKind;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  serial_no: string | null;
  depth: number;
  descendant_count: number;
  spec_items: EquipmentSpecItem[];
  children: EquipmentTreeNode[];
}

export interface BreadcrumbNode {
  kind: "ASSET" | "EQUIPMENT";
  id: string;
  code: string;
  name: string;
  status: string;
}
