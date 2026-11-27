/**
 * Response types of the v2 backend.
 *
 * Every number shown in the UI originates from one of these payloads: either a
 * result file read by the backend or the score of a real forward pass. The UI
 * never computes a metric of its own and never substitutes a placeholder value.
 */

/* ------------------------------------------------------------------ config */

export interface DecisionSemantics {
  threshold: number;
  threshold_source: string;
  score_semantics: string;
  positive_label: string;
}

export interface IndexingConfig {
  time_segment: string;
  period: string;
  dense_filter: number;
  sparse_filter: number;
  max_attention_cells: number;
}

export interface HealthResponse {
  status: string;
  device: string;
  device_request: string;
  loaded_pairs: number;
  configured_pairs: number;
  load_seconds: number;
  config_path: string;
  pairs: Record<string, { status: string; error: string | null; seed: string }>;
}

export interface ConfigResponse {
  version: string;
  decision: DecisionSemantics;
  indexing: IndexingConfig;
  device: string;
  device_request: string;
  config_path: string;
  paths: Record<string, string>;
  training_performed_by_this_service: boolean;
}

/* --------------------------------------------------------------- platforms */

export interface PlatformPairLink {
  combo_id: string;
  role: "dense" | "sparse";
  partner: string;
  partner_name: string;
  available: boolean;
  status: string;
}

export interface PlatformInfo {
  key: string;
  name: string;
  subtitle: string;
  csv: string;
  configured_rows: number;
  roles: string[];
  pairs: PlatformPairLink[];
  users: number | null;
  usable_users: number | null;
}

/* ------------------------------------------------------------ index / model */

export interface TrajectoryLengthStats {
  min: number;
  max: number;
  mean: number;
  median: number;
}

export interface IndexStats {
  platform: string;
  role: string;
  branch?: string;
  users: number;
  usable_users: number;
  unusable_users: number;
  tokens: number;
  trajectory_length?: TrajectoryLengthStats;
  max_loc_id: number;
  loc_size: number;
  unusable_examples?: UserSummary[];
}

export interface PreprocessingPlatform {
  platform: string;
  platform_name: string;
  role: string;
  csv: string;
  branch: string | null;
  applied_max_sequence_length: number | null;
  csv_rows_configured: number;
  users_in_index: number | null;
  users_usable_by_checkpoint: number | null;
  paper_table1_users: number | null;
  difference_vs_paper_users?: number;
}

export interface PreprocessingReport {
  time_segment: string;
  period: string;
  dense_filter: number;
  sparse_filter: number;
  branch: string;
  platforms: PreprocessingPlatform[];
  note: string;
}

export interface LoadedModelInfo {
  family: string;
  seed?: string;
  embed_size: number;
  hidden_size: number;
  num_layers: number;
  num_layers_mask: number;
  num_layers_attn: number;
  loc_size: number;
  num_heads: number | null;
  threshold: number | null;
  p_drop: number | null;
  prob: number | null;
  classifier_type: string | null;
  mask_strategy: string | null;
}

export interface SeedInfo {
  seed: string;
  checkpoint: string;
  exists: boolean;
  available: boolean;
  error: string | null;
  loaded: boolean;
  is_default: boolean;
  loc_size: number | null;
  num_layers_mask: number | null;
  num_layers_attn: number | null;
  usable_users: { platform_a: number; platform_b: number };
  possible_pairs: number;
}

export interface ComboMetadata {
  id: string;
  label: string;
  dense_platform: string;
  sparse_platform: string;
  platform_a: string;
  platform_b: string;
  model_family: string;
  model_note: string;
  status: string;
  available: boolean;
  error: string | null;
  seed: string;
  available_seeds: string[];
  usable_seeds?: string[];
  seeds?: SeedInfo[];
  seed_cache_size?: number;
  loaded_seeds?: string[];
  index_loc_size?: number;
  default_seed_counts?: {
    seed: string;
    platform_a_users: number;
    platform_b_users: number;
    possible_pairs: number;
  };
  timings: Record<string, number>;
  index_from_cache: Record<string, boolean>;
  platform_a_index?: IndexStats;
  platform_b_index?: IndexStats;
  possible_pairs?: number;
  possible_pairs_any_seed?: number;
  loaded_model?: LoadedModelInfo;
  model_source_file?: string;
  model_runtime_warnings?: string[];
  preprocessing?: PreprocessingReport;
  stored_sample_list?: {
    path: string;
    loaded: boolean;
    error: string | null;
    pair_count: number;
    dense_user_count: number;
    sparse_user_count: number;
  };
}

/* ------------------------------------------------------------------- users */

export interface UserSummary {
  platform: string;
  user_id: number;
  trajectory_length: number;
  source_rows: number;
  max_loc_id: number;
  time_id_range: [number, number];
  usable: boolean;
  unusable_reason: string | null;
  coordinate_source?: string | null;
  coordinate_count?: number;
}

export interface UserPage {
  combo_id: string;
  side: "a" | "b";
  role: "dense" | "sparse";
  platform: string;
  seed?: string;
  loc_size?: number;
  query: string;
  /** Whether the picker is restricted to the test split or shows the full index. */
  scope?: "test" | "all";
  total: number;
  offset: number;
  limit: number;
  users: UserSummary[];
}

export interface TrajectoryStep {
  step: number;
  loc_id: number;
  time_id: number;
  /** Hour slot for ISP/Weibo, Unix seconds for the XSiteTraj platforms. */
  timestamp: number;
  /** Display-only geography; null when the released files carry no coordinate. */
  lon: number | null;
  lat: number | null;
}

export interface UserDetail extends UserSummary {
  combo_id: string;
  side: "a" | "b";
  seed?: string;
  loc_size?: number;
  preview: TrajectoryStep[];
}

export interface SuggestedPairs {
  combo_id: string;
  platform_a: string;
  platform_b: string;
  seed?: string;
  loc_size?: number;
  shared_user_id_count: number;
  selection_rule: Record<string, string>;
  note: string;
  matched_examples: { user_a: number; user_b: number }[];
  unmatched_examples: { user_a: number; user_b: number }[];
  random_examples: { user_a: number; user_b: number }[];
}

/* ------------------------------------------------------------------- match */

export interface CoOccurrenceSide {
  step: number;
  locId: number;
  slot: number;
  lon: number | null;
  lat: number | null;
}

/**
 * One spatio-temporal co-occurrence point: a check-in of platform A and a check-in
 * of platform B that fall in the same time bucket and within 2 km of each other.
 * The same `index` is drawn as `C{index+1}` on both maps.
 */
export interface CoOccurrencePair {
  index: number;
  slot: number;
  distanceM: number;
  a: CoOccurrenceSide;
  b: CoOccurrenceSide;
}

export interface AttentionMatrix {
  shape: [number, number];
  downsampled: boolean;
  stride: number;
  values: number[][];
  downsampled_shape?: [number, number];
  downsample_method?: string;
}

export interface AttentionPayload {
  a_to_b: AttentionMatrix;
  b_to_a: AttentionMatrix;
  labels: { a_to_b: string; b_to_a: string; a_axis: string; b_axis: string };
}

export interface MaskPayload {
  a: number[];
  b: number[];
  a_indices: number[];
  b_indices: number[];
  a_count: number;
  b_count: number;
  a_ratio: number;
  b_ratio: number;
  mask_ratio_setting: number;
}

export interface PipelineStage {
  stage: string;
  name: string;
  status: string;
  a_shape?: number[];
  b_shape?: number[];
  attention_shapes?: { a_to_b: number[]; b_to_a: number[] };
  a_mask_count?: number;
  b_mask_count?: number;
  output_shape?: number[];
  extra_model_outputs?: number;
  a_detail?: { padded_shape: number[]; valid_tokens: number };
  b_detail?: { padded_shape: number[]; valid_tokens: number };
}

export interface TimingBreakdown {
  user_lookup: number;
  feature_build: number;
  model_forward: number;
  postprocess: number;
  model_load?: number;
  total: number;
}

export interface Evidence {
  pair_looked_up_in_stored_sample_list: boolean | "unknown";
  index_scope: string;
  platform_a_users_in_index?: number;
  platform_b_users_in_index?: number;
  possible_pairs?: number;
  stored_sample_pair_count?: number;
  platform_a_user_in_stored_samples?: boolean;
  platform_b_user_in_stored_samples?: boolean;
  stored_sample_list_path?: string;
  note?: string;
}

export interface DatasetHint {
  same_numeric_user_id: boolean;
  how_positive_pairs_were_built: string;
  used_by_the_model: boolean;
  stored_label: number | null;
  dataset_level_expectation?: string;
  explanation?: string;
  in_stored_sample_list?: boolean;
  stored_label_note?: string;
}

export interface TokenLocation {
  step: number;
  index: number;
  loc_id: number;
  time_id: number;
  timestamp: number;
  lon: number | null;
  lat: number | null;
}

export interface MatchResponse {
  combo_id: string;
  combo_label: string;
  platform_a: { key: string; name: string; role: string; user: UserSummary };
  platform_b: { key: string; name: string; role: string; user: UserSummary };
  prediction: {
    score: number;
    predicted_label: number;
    is_match: boolean;
    decision_threshold: number;
    score_semantics: string | null;
    positive_label: string | null;
    threshold_source: string | null;
  };
  model: {
    combo_id: string;
    runtime_warnings: string[];
    family: string;
    family_label: string;
    checkpoint: string;
    seed: string;
    default_seed: string;
    is_default_seed: boolean;
    loaded_seeds: string[];
    source_file: string;
    config: LoadedModelInfo;
  };
  attention: AttentionPayload | null;
  /** Full trajectory token -> location/time/coordinate mapping. */
  tokens?: { a: TokenLocation[]; b: TokenLocation[] };
  /** Present when this pass removed specific tokens (evidence removal). */
  intervention?: { drop_a: number[]; drop_b: number[] } | null;
  mask: MaskPayload;
  representations: Record<string, unknown>;
  pipeline: PipelineStage[];
  timing_ms: TimingBreakdown;
  device: string;
  evidence: Evidence;
  dataset_hint: DatasetHint;
  /**
   * Read-only dataset label for this pair, looked up after the forward pass.
   * `verdict` is 'match' | 'non_match' | 'unknown'; `label` is null when the
   * release simply has no answer for the pair (never guessed to be 0).
   */
  ground_truth?: GroundTruthPayload | null;
}

/* --------------------------------------------------------- ground truth */

export interface GroundTruthPayload {
  platform_a: string;
  platform_b: string;
  user_a: number;
  user_b: number;
  combo_id?: string | null;
  verdict: "match" | "non_match" | "unknown";
  has_label: boolean;
  label: number | null;
  label_human: string;
  reason: string;
  rule: string;
  rule_explanation: string;
  data_source: string;
  same_user_id: boolean;
  present_on_platform_a: boolean;
  present_on_platform_b: boolean;
  available?: boolean;
  used_by_model: boolean;
  note?: string;
}

/* -------------------------------------------------------------- experiments */

export interface SourceInfo {
  available: boolean;
  path?: string;
  reason?: string;
  kind?: string;
  files?: string[];
  note?: string;
}

export interface MetricBlock {
  mean: number | null;
  std: number | null;
  values: number[];
  count: number;
}

export interface ExperimentRun {
  seed: string;
  source?: string;
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1?: number | null;
  auc?: number | null;
  test_loss?: number | null;
}

export interface ConsistencyReport {
  checkpoint_config: Record<string, number | string | null>;
  reported_experiment_config: Record<string, number | string | null>;
  differences: { field: string; checkpoint: number | string; reported_experiment: number | string }[];
  matches_reported_experiment: boolean | null;
  note?: string;
}

export interface PaperReference {
  available: boolean;
  reason?: string;
  source?: Record<string, string>;
  protocol?: Record<string, unknown>;
  columns?: string[];
  published?: Record<string, Record<string, number>>;
  mt_link?: Record<string, number> | null;
  caveats?: string[];
  ablation?: Record<string, number[]>;
  note?: string;
}

export interface ExperimentPayload {
  combo_id: string;
  label: string;
  kind: string;
  /** Usually a SourceInfo object; the backend also emits plain-string notes. */
  source: Record<string, SourceInfo | string>;
  runs: ExperimentRun[];
  metrics: Record<string, MetricBlock>;
  last_run: Record<string, number | null> | null;
  experiment_config: Record<string, number | string> | null;
  reported_configuration?: Record<string, number | string> | null;
  excluded_runs?: { seed: number; reason: string }[];
  metric_definition?: string;
  consistency_notes?: string[];
  warnings: string[];
  provenance: string;
  curves: {
    available: boolean;
    /**
     * `training_logs` means the per-epoch curves were parsed from the run's
     * training.log because no train_metrics.json exists; the plotted series is then
     * the element-wise mean over the seeds listed in `seeds`.
     */
    kind?: "training_logs" | "train_metrics_json";
    train_loss: (number | null)[];
    valid_loss: (number | null)[];
    train_accuracy?: (number | null)[];
    val_accuracy?: (number | null)[];
    by_seed?: Record<
      string,
      {
        source?: string;
        epochs_logged?: number;
        completed?: boolean;
        train_loss: number[];
        valid_loss: number[];
      }
    >;
    seeds?: string[];
    epoch_count?: Record<string, number>;
    contributors?: number[];
    superseded?: { seed: string; source: string; epochs_logged: number; note: string }[];
    test_loss_from_logs?: Record<string, number>;
    failed_reason?: string;
  };
  parsed_training_logs?: {
    seeds: string[];
    epoch_count: Record<string, number>;
    completed_rounds: string[];
    test_loss_from_logs: Record<string, number>;
    superseded_rounds: { seed: string; source: string; epochs_logged: number; note: string }[];
  };
  curve_images?: Record<string, SourceInfo>;
  checkpoint: { path: string | null; exists: boolean; seed: string; loaded: boolean };
  consistency: ConsistencyReport;
  paper_reference: PaperReference;
}

/* ------------------------------------------------- mask-ratio experiment */

/** One row of the frozen-weight mask-ratio sweep. */
export interface MaskSweepRow {
  mask_ratio: number;
  status: "ok" | "error";
  effective_mask_ratio?: number;
  f1?: number;
  auc?: number;
  precision?: number;
  recall?: number;
  accuracy?: number;
  evaluated_samples?: number;
  predicted_positive?: number;
  mean_score?: number;
  samples_with_masking_dense?: number;
  samples_with_masking_sparse?: number;
  seconds?: number;
  error?: string;
}

export interface MaskSweepResult {
  combo_id: string;
  combo_label: string;
  seed: string;
  checkpoint: string;
  model_family: string;
  family_note: string;
  mask_strategy: string;
  baseline_ratio: number;
  loc_size: number;
  loc_embedding_rows: number;
  device: string;
  device_note: string;
  test_set_path: string;
  test_samples: number;
  test_samples_in_file: number;
  test_positives: number;
  batch_size: number;
  average: string;
  metric_source: string;
  scores_are_probabilities: boolean;
  extra_sigmoid_applied: boolean;
  results: MaskSweepRow[];
  warnings: string[];
  seconds: number;
  trained: boolean;
  weights_modified: boolean;
  files_written: string[];
}

/** Availability of the experiment per platform pair. */
export interface MaskSweepStatus {
  candidate_ratios: number[];
  combos: { combo_id: string; label: string; has_test_set: boolean; seeds: string[] }[];
  note: string;
}

/** Candidate ratios plus the exact fixed test set a sweep would use. */
export interface MaskSweepHarness {
  candidate_ratios: number[];
  min_ratio: number;
  max_ratio: number;
  batch_size: number;
  average: string;
  mask_strategy: string | null;
  baseline_ratio: number | null;
  family: string;
  default_seed: string;
  available_seeds: string[];
  test_set_available: boolean;
  test_set_error?: string;
  test_set_path?: string;
  test_samples: number;
  test_samples_in_file?: number;
  test_positives: number;
  dense_length_median?: number;
  sparse_length_median?: number;
  dense_length_min?: number;
  sparse_length_min?: number;
  masking_by_ratio?: {
    mask_ratio: number;
    dense_samples_masked: number;
    sparse_samples_masked: number;
    dense_share: number;
    sparse_share: number;
  }[];
}
